"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/infrastructure/supabase/server";
import type { WorkshopStatus } from "@/infrastructure/repositories/dashboard";

import { createWorkshopSchema, updateWorkshopSchema, WORKSHOP_STATUS_TRANSITIONS } from "./schema";

export type WorkshopFormValues = Record<string, string>;

export type CreateWorkshopResult =
  | { success: true; slug: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      values: WorkshopFormValues;
    };

const FORM_FIELDS = [
  "title",
  "programType",
  "description",
  "tags",
  "status",
  "startDate",
  "endDate",
  "venueName",
  "city",
  "country",
  "capacity",
  "clientName",
  "clientContactName",
  "clientContactEmail",
  "facilitatorName",
  "facilitatorEmail",
  "facilitatorNotes",
  "materialsNotes",
  "logisticsNotes",
] as const;

function readRawValues(formData: FormData): WorkshopFormValues {
  const values: WorkshopFormValues = {};

  for (const field of FORM_FIELDS) {
    values[field] = formData.get(field)?.toString() ?? "";
  }

  return values;
}

export async function createWorkshop(
  _prevState: CreateWorkshopResult | null,
  formData: FormData
): Promise<CreateWorkshopResult> {
  const values = readRawValues(formData);

  const parsed = createWorkshopSchema.safeParse(values);

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
  // field alone — city and country now have their own columns (see
  // migrations/0005), but `venue` stays a combined display string too so
  // existing venue-only readers (dashboard panels, emails) keep working.
  const venue = [data.venueName, data.city, data.country].filter(Boolean).join(", ");

  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("workshops")
    .insert({
      title: data.title,
      description: data.description || null,
      program_type: data.programType ?? null,
      tags: data.tags,
      status: data.status,
      start_date: data.startDate,
      end_date: data.endDate,
      venue,
      city: data.city || null,
      country: data.country ?? null,
      capacity: data.capacity,
      client_name: data.clientName || null,
      client_contact_name: data.clientContactName || null,
      client_contact_email: data.clientContactEmail ?? null,
      facilitator_name: data.facilitatorName || null,
      facilitator_email: data.facilitatorEmail ?? null,
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
        error: "A workshop with this title already exists. Try a slightly different title.",
        values,
      };
    }

    console.error("Failed to create workshop", error);

    return {
      success: false,
      error: "Unable to create the workshop. Please try again.",
      values,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workshops");
  redirect(`/dashboard/workshops/${inserted.slug}?created=true`);
}

export type UpdateWorkshopResult =
  | { success: true; slug: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      values: WorkshopFormValues;
    };

export async function updateWorkshop(
  workshopId: string,
  workshopSlug: string,
  _prevState: UpdateWorkshopResult | null,
  formData: FormData
): Promise<UpdateWorkshopResult> {
  const values = readRawValues(formData);

  const parsed = updateWorkshopSchema.safeParse(values);

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
  // enforcement. A locked (completed/cancelled) workshop, or a transition
  // the state machine doesn't allow, gets rejected here regardless of what
  // the client sent.
  const { data: existing, error: fetchError } = await supabase
    .from("workshops")
    .select("status")
    .eq("id", workshopId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: fetchError.message, values };
  }

  if (!existing) {
    return { success: false, error: "Workshop not found.", values };
  }

  const currentStatus = existing.status as WorkshopStatus;

  if (currentStatus === "completed" || currentStatus === "cancelled") {
    return {
      success: false,
      error: "This workshop can no longer be edited.",
      values,
    };
  }

  const allowedNextStatuses = WORKSHOP_STATUS_TRANSITIONS[currentStatus];

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

  const { error } = await supabase
    .from("workshops")
    .update({
      title: data.title,
      description: data.description || null,
      program_type: data.programType ?? null,
      tags: data.tags,
      status: data.status,
      start_date: data.startDate,
      end_date: data.endDate,
      venue,
      city: data.city || null,
      country: data.country ?? null,
      capacity: data.capacity,
      client_name: data.clientName || null,
      client_contact_name: data.clientContactName || null,
      client_contact_email: data.clientContactEmail ?? null,
      facilitator_name: data.facilitatorName || null,
      facilitator_email: data.facilitatorEmail ?? null,
      facilitator_notes: data.facilitatorNotes || null,
      materials_notes: data.materialsNotes || null,
      logistics_notes: data.logisticsNotes || null,
    })
    .eq("id", workshopId);

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "A workshop with this title already exists. Try a slightly different title.",
        values,
      };
    }

    console.error("Failed to update workshop", error);

    return {
      success: false,
      error: "Unable to save changes. Please try again.",
      values,
    };
  }

  revalidatePath(`/dashboard/workshops/${workshopSlug}`);
  revalidatePath(`/dashboard/workshops/${workshopSlug}/edit`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workshops");
  redirect(`/dashboard/workshops/${workshopSlug}`);
}

export type DeleteWorkshopResult = { success: true } | { success: false; error: string };

export async function deleteWorkshop(workshopId: string): Promise<DeleteWorkshopResult> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("workshops")
    .select("status")
    .eq("id", workshopId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  if (!existing) {
    return { success: false, error: "Workshop not found." };
  }

  if (existing.status !== "draft" && existing.status !== "cancelled") {
    return { success: false, error: "Only draft or cancelled workshops can be deleted." };
  }

  const { error } = await supabase
    .from("workshops")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", workshopId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/workshops");
  redirect("/dashboard");
}

export type UpdateLogisticsTaskResult = { success: true } | { success: false; error: string };

export async function updateLogisticsTask(
  taskId: string,
  completed: boolean,
  workshopSlug: string
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
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/workshops/${workshopSlug}`);
  return { success: true };
}
