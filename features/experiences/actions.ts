"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/infrastructure/supabase/server";
import type { ExperienceStatus } from "@/infrastructure/repositories/dashboard";
import { sendPostTrainingSurveysOnCompletion } from "@/features/surveys/actions";
import { triggerExperienceCompletionMilestones } from "@/features/financial/actions";

import { createExperienceSchema, updateExperienceSchema, EXPERIENCE_STATUS_TRANSITIONS } from "./schema";
import { toActionError } from "@/shared/errors/action-error";

export type ExperienceFormValues = Record<string, string>;

export type CreateExperienceResult =
  | { success: true; slug: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      values: ExperienceFormValues;
    };

const FORM_FIELDS = [
  "title",
  "titleAr",
  "experienceType",
  "description",
  "tags",
  "status",
  "clientId",
  "engagementId",
  "startDate",
  "endDate",
  "venueName",
  "city",
  "country",
  "capacity",
  "dailyCheckinEnabled",
  "facilitatorId",
  "facilitatorNotes",
  "materialsNotes",
  "logisticsNotes",
] as const;

function readRawValues(formData: FormData): ExperienceFormValues {
  const values: ExperienceFormValues = {};

  for (const field of FORM_FIELDS) {
    values[field] = formData.get(field)?.toString() ?? "";
  }

  return values;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The `experiences` table stores facilitator name/email as denormalized
 * text columns (no facilitator_id FK) — the form now selects an existing
 * facilitator record rather than typing free text, so this resolves the
 * selected id to the two text columns server-side. Doing the lookup here
 * (not trusting client-submitted name/email) is what actually prevents the
 * typo/duplicate-facilitator drift the free-text field used to allow.
 */
async function resolveFacilitator(
  supabase: SupabaseServerClient,
  facilitatorId: string | undefined
): Promise<{ name: string | null; email: string | null }> {
  if (!facilitatorId) {
    return { name: null, email: null };
  }

  const { data } = await supabase
    .from("facilitators")
    .select("first_name, last_name, email")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (!data) {
    return { name: null, email: null };
  }

  return { name: `${data.first_name} ${data.last_name}`.trim(), email: data.email };
}

export async function createExperience(
  _prevState: CreateExperienceResult | null,
  formData: FormData
): Promise<CreateExperienceResult> {
  const values = readRawValues(formData);

  const parsed = createExperienceSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const data = parsed.data;

  // No separate city/country columns existed before this sprint's `venue`
  // field alone — city and country now have their own columns, but `venue`
  // stays a combined display string too so existing venue-only readers
  // (dashboard panels, emails) keep working.
  const venue = [data.venueName, data.city, data.country].filter(Boolean).join(", ");

  const supabase = await createClient();

  // An engagement always belongs to exactly one client — if the form set
  // an engagement but left client blank, derive it server-side so the two
  // columns never disagree about which client this experience belongs to.
  let clientId = data.clientId ?? null;
  if (data.engagementId && !clientId) {
    const { data: engagement } = await supabase
      .from("engagements")
      .select("client_id")
      .eq("id", data.engagementId)
      .maybeSingle();
    clientId = engagement?.client_id ?? null;
  }

  const facilitator = await resolveFacilitator(supabase, data.facilitatorId);

  const { data: inserted, error } = await supabase
    .from("experiences")
    .insert({
      title: data.title,
      title_ar: data.titleAr || null,
      experience_type: data.experienceType,
      description: data.description || null,
      tags: data.tags,
      status: data.status,
      client_id: clientId,
      engagement_id: data.engagementId ?? null,
      start_date: data.startDate,
      end_date: data.endDate,
      venue,
      city: data.city || null,
      country: data.country ?? null,
      capacity: data.capacity,
      daily_checkin_enabled: data.dailyCheckinEnabled,
      facilitator_name: facilitator.name,
      facilitator_email: facilitator.email,
      facilitator_notes: data.facilitatorNotes || null,
      materials_notes: data.materialsNotes || null,
      logistics_notes: data.logisticsNotes || null,
    })
    .select("slug")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "An experience with this title already exists. Try a slightly different title.",
        values,
      };
    }

    console.error("Failed to create experience", error);

    return {
      success: false,
      error: "Unable to create the experience. Please try again.",
      values,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/experiences");
  if (data.engagementId && clientId) {
    revalidatePath(`/dashboard/clients/${clientId}/engagements/${data.engagementId}`);
  }
  redirect(`/dashboard/experiences/${inserted.slug}?created=true`);
}

export type UpdateExperienceResult =
  | { success: true; slug: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      values: ExperienceFormValues;
    };

export async function updateExperience(
  experienceId: string,
  experienceSlug: string,
  _prevState: UpdateExperienceResult | null,
  formData: FormData
): Promise<UpdateExperienceResult> {
  const values = readRawValues(formData);

  const parsed = updateExperienceSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const data = parsed.data;
  const supabase = await createClient();

  // Re-check the current status server-side — the edit form only offers
  // valid next statuses in its dropdown, but that's a UI courtesy, not
  // enforcement. A locked (completed/cancelled) experience, or a transition
  // the state machine doesn't allow, gets rejected here regardless of what
  // the client sent.
  const { data: existing, error: fetchError } = await supabase
    .from("experiences")
    .select("status")
    .eq("id", experienceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: toActionError(fetchError, "experiences"), values };
  }

  if (!existing) {
    return { success: false, error: "Experience not found.", values };
  }

  const currentStatus = existing.status as ExperienceStatus;

  if (currentStatus === "completed" || currentStatus === "cancelled") {
    return {
      success: false,
      error: "This experience can no longer be edited.",
      values,
    };
  }

  const allowedNextStatuses = EXPERIENCE_STATUS_TRANSITIONS[currentStatus];

  if (!allowedNextStatuses.includes(data.status)) {
    return {
      success: false,
      error: `Cannot change status from "${currentStatus}" to "${data.status}".`,
      values,
    };
  }

  // Slug is generated once on insert and never re-derived (the trigger
  // only fires `before insert`), so it never changes here — title edits
  // don't move the URL out from under anyone linking to it.
  const venue = [data.venueName, data.city, data.country].filter(Boolean).join(", ");

  // See createExperience for why an engagement's client always wins when
  // the client field was left blank.
  let clientId = data.clientId ?? null;
  if (data.engagementId && !clientId) {
    const { data: engagement } = await supabase
      .from("engagements")
      .select("client_id")
      .eq("id", data.engagementId)
      .maybeSingle();
    clientId = engagement?.client_id ?? null;
  }

  const facilitator = await resolveFacilitator(supabase, data.facilitatorId);

  const { error } = await supabase
    .from("experiences")
    .update({
      title: data.title,
      title_ar: data.titleAr || null,
      experience_type: data.experienceType,
      description: data.description || null,
      tags: data.tags,
      status: data.status,
      client_id: clientId,
      engagement_id: data.engagementId ?? null,
      start_date: data.startDate,
      end_date: data.endDate,
      venue,
      city: data.city || null,
      country: data.country ?? null,
      capacity: data.capacity,
      daily_checkin_enabled: data.dailyCheckinEnabled,
      facilitator_name: facilitator.name,
      facilitator_email: facilitator.email,
      facilitator_notes: data.facilitatorNotes || null,
      materials_notes: data.materialsNotes || null,
      logistics_notes: data.logisticsNotes || null,
    })
    .eq("id", experienceId);

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "An experience with this title already exists. Try a slightly different title.",
        values,
      };
    }

    console.error("Failed to update experience", error);

    return {
      success: false,
      error: "Unable to save changes. Please try again.",
      values,
    };
  }

  // currentStatus is never "completed" here (the early return above already
  // locked out further edits once it is), so reaching "completed" always
  // means this update is the transition into it.
  //
  // Fire-and-forget, same reasoning as the check-in flow's certificate/
  // pre-training-survey hooks: a survey-send hiccup must never block or
  // fail the status update itself.
  if (data.status === "completed") {
    void sendPostTrainingSurveysOnCompletion(experienceId);
    void triggerExperienceCompletionMilestones(experienceId);
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);
  revalidatePath(`/dashboard/experiences/${experienceSlug}/edit`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/experiences");
  redirect(`/dashboard/experiences/${experienceSlug}`);
}

export type DeleteExperienceResult = { success: true } | { success: false; error: string };

export async function deleteExperience(experienceId: string): Promise<DeleteExperienceResult> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("experiences")
    .select("status")
    .eq("id", experienceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: toActionError(fetchError, "experiences") };
  }

  if (!existing) {
    return { success: false, error: "Experience not found." };
  }

  if (existing.status !== "draft" && existing.status !== "cancelled") {
    return { success: false, error: "Only draft or cancelled experiences can be deleted." };
  }

  const { error } = await supabase
    .from("experiences")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", experienceId);

  if (error) {
    return { success: false, error: toActionError(error, "experiences") };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/experiences");
  redirect("/dashboard");
}

export type UpdateLogisticsTaskResult = { success: true } | { success: false; error: string };

export async function updateLogisticsTask(
  taskId: string,
  completed: boolean,
  experienceSlug: string
): Promise<UpdateLogisticsTaskResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("logistics_tasks")
    .update({
      status: completed ? "completed" : "pending",
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) {
    return { success: false, error: toActionError(error, "experiences") };
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);
  return { success: true };
}
