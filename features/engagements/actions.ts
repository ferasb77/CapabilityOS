"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/infrastructure/supabase/server";
import { triggerEngagementSigningMilestones } from "@/features/financial/actions";

import { engagementSchema } from "./schema";

export type EngagementFormValues = Record<string, string>;

export type CreateEngagementResult =
  | { success: true; id: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      values: EngagementFormValues;
    };

const FORM_FIELDS = [
  "clientId",
  "title",
  "description",
  "type",
  "status",
  "startDate",
  "endDate",
  "contractValue",
  "currency",
  "notes",
] as const;

function readRawValues(formData: FormData): EngagementFormValues {
  const values: EngagementFormValues = {};

  for (const field of FORM_FIELDS) {
    values[field] = formData.get(field)?.toString() ?? "";
  }

  return values;
}

export async function createEngagement(
  clientId: string,
  _prevState: CreateEngagementResult | null,
  formData: FormData
): Promise<CreateEngagementResult> {
  const values = readRawValues(formData);
  values.clientId = clientId;

  const parsed = engagementSchema.safeParse(values);

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

  const { data: inserted, error } = await supabase
    .from("engagements")
    .insert({
      client_id: data.clientId,
      title: data.title,
      description: data.description || null,
      type: data.type,
      status: data.status,
      start_date: data.startDate ?? null,
      end_date: data.endDate ?? null,
      contract_value: data.contractValue ?? null,
      currency: data.currency,
      notes: data.notes || null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("Failed to create engagement", error);

    return {
      success: false,
      error: "Unable to create the engagement. Please try again.",
      values,
    };
  }

  if (data.status === "active") {
    void triggerEngagementSigningMilestones(inserted.id);
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/clients/${clientId}/engagements/${inserted.id}`);
}

export type UpdateEngagementResult =
  | { success: true }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      values: EngagementFormValues;
    };

export async function updateEngagement(
  engagementId: string,
  clientId: string,
  _prevState: UpdateEngagementResult | null,
  formData: FormData
): Promise<UpdateEngagementResult> {
  const values = readRawValues(formData);
  values.clientId = clientId;

  const parsed = engagementSchema.safeParse(values);

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

  const { data: existing } = await supabase.from("engagements").select("status").eq("id", engagementId).maybeSingle();

  const { error } = await supabase
    .from("engagements")
    .update({
      title: data.title,
      description: data.description || null,
      type: data.type,
      status: data.status,
      start_date: data.startDate ?? null,
      end_date: data.endDate ?? null,
      contract_value: data.contractValue ?? null,
      currency: data.currency,
      notes: data.notes || null,
    })
    .eq("id", engagementId);

  if (error) {
    console.error("Failed to update engagement", error);

    return {
      success: false,
      error: "Unable to save changes. Please try again.",
      values,
    };
  }

  // Only fire on the transition into "active" — without this guard, every
  // subsequent save of an already-active engagement (editing notes, dates,
  // ...) would re-run the query. Harmless either way (triggerMilestoneCore
  // only ever advances a "pending" row), but pointless repeat work.
  if (data.status === "active" && existing?.status !== "active") {
    void triggerEngagementSigningMilestones(engagementId);
  }

  revalidatePath(`/dashboard/clients/${clientId}/engagements/${engagementId}`);
  revalidatePath(`/dashboard/clients/${clientId}`);
  return { success: true };
}
