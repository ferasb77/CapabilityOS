"use server";

import { revalidatePath } from "next/cache";

import { requireEnv } from "@/infrastructure/env";
import { getResendClient } from "@/infrastructure/email/resend-client";
import { renderMilestoneTriggeredEmail } from "@/infrastructure/email/financial-email";
import { createClient } from "@/infrastructure/supabase/server";

import { getPrimaryFinanceContactEmail } from "./data";
import { toActionError } from "@/shared/errors/action-error";
import {
  financeContactSchema,
  financeSettingsSchema,
  milestoneFormSchema,
  type MilestoneStatus,
  type MilestoneTriggerType,
} from "./schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function resolveAppUrl(): { ok: true; url: string } | { ok: false; error: string } {
  try {
    return { ok: true, url: requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "") };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Missing configuration." };
  }
}

/** Distinct display name from the participant-facing sender — finance
 * notifications are deliberately not styled as an "Enable My Growth" email
 * (see infrastructure/email/financial-email.ts's header comment). */
function financeFromAddress(): string {
  return `CapabilityOS Finance <${requireEnv("RESEND_FROM_EMAIL")}>`;
}

async function revalidateEngagementFinancial(supabase: SupabaseServerClient, engagementId: string): Promise<void> {
  const { data: engagement } = await supabase.from("engagements").select("client_id").eq("id", engagementId).maybeSingle();
  if (engagement) {
    revalidatePath(`/dashboard/clients/${engagement.client_id}/engagements/${engagementId}`);
  }
  revalidatePath("/dashboard");
}

function triggerReasonFor(triggerType: MilestoneTriggerType, context: { experienceTitle?: string }): string {
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  switch (triggerType) {
    case "experience_completion":
      return `This milestone was triggered because ${context.experienceTitle ?? "the linked experience"} was marked as completed on ${today}.`;
    case "engagement_completion":
      return "This engagement has been fully completed.";
    case "engagement_signing":
      return "This engagement was signed and activated.";
    case "date_based":
      return "The scheduled trigger date for this milestone has been reached.";
    case "manual":
    default:
      return "This milestone was triggered manually.";
  }
}

// ---------------------------------------------------------------------------
// Notification — core send, reused by the auto-trigger path and the
// "Send Invoice Notification" / resend button.
// ---------------------------------------------------------------------------

async function sendMilestoneNotificationCore(
  supabase: SupabaseServerClient,
  milestoneId: string,
  triggerReason: string
): Promise<{ success: true } | { success: false; error: string }> {
  const { data: milestone, error: milestoneError } = await supabase
    .from("payment_milestones")
    .select("id, engagement_id, workspace_id, title, amount, currency, due_date, notes, finance_email")
    .eq("id", milestoneId)
    .maybeSingle();

  if (milestoneError) return { success: false, error: toActionError(milestoneError, "financial") };
  if (!milestone) return { success: false, error: "Milestone not found." };

  const { data: engagementRow, error: engagementError } = await supabase
    .from("engagements")
    .select("id, client_id, title, contract_value, clients(name)")
    .eq("id", milestone.engagement_id)
    .maybeSingle();

  if (engagementError) return { success: false, error: toActionError(engagementError, "financial") };
  if (!engagementRow) return { success: false, error: "Engagement not found." };

  const engagement = engagementRow as unknown as {
    id: string;
    client_id: string;
    title: string;
    contract_value: number | string | null;
    clients: { name: string } | null;
  };

  const { data: siblingMilestones, error: siblingError } = await supabase
    .from("payment_milestones")
    .select("amount, status")
    .eq("engagement_id", milestone.engagement_id)
    .is("deleted_at", null);

  if (siblingError) return { success: false, error: toActionError(siblingError, "financial") };

  const previouslyCollected = (siblingMilestones ?? [])
    .filter((m) => m.status === "collected")
    .reduce((sum, m) => sum + Number(m.amount), 0);

  const contractTotal = Number(engagement.contract_value ?? 0);
  const amount = Number(milestone.amount);
  const percentageOfTotal = contractTotal > 0 ? Math.round((amount / contractTotal) * 1000) / 10 : 0;
  const remainingAfterThis = Math.max(contractTotal - previouslyCollected - amount, 0);

  const primaryContactEmail = await getPrimaryFinanceContactEmail(milestone.workspace_id);
  const recipients = [...new Set([milestone.finance_email, primaryContactEmail].filter((e): e is string => !!e))];

  if (recipients.length === 0) {
    return { success: false, error: "No finance contact email is configured for this milestone or workspace." };
  }

  const appUrl = resolveAppUrl();
  const ctaUrl = appUrl.ok
    ? `${appUrl.url}/dashboard/clients/${engagement.client_id}/engagements/${engagement.id}?tab=financial`
    : "#";

  const { subject, html } = renderMilestoneTriggeredEmail({
    clientName: engagement.clients?.name ?? "Unknown client",
    engagementTitle: engagement.title,
    milestoneTitle: milestone.title,
    amount,
    currency: milestone.currency,
    percentageOfTotal,
    triggerReason,
    contractTotal,
    previouslyCollected,
    remainingAfterThis,
    dueDate: milestone.due_date,
    notes: milestone.notes,
    ctaUrl,
  });

  try {
    const resend = getResendClient();
    const { error: sendError } = await resend.emails.send({
      from: financeFromAddress(),
      to: recipients,
      subject,
      html,
    });

    if (sendError) {
      return { success: false, error: toActionError(sendError, "financial") };
    }
  } catch (sendError) {
    return { success: false, error: sendError instanceof Error ? sendError.message : "Unable to send notification email." };
  }

  await supabase.from("payment_milestones").update({ notification_sent_at: new Date().toISOString() }).eq("id", milestoneId);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Trigger core — flips a pending milestone to triggered and fires the
// notification. Guarded by `.eq("status", "pending")` on the update so
// concurrent callers (e.g. two experiences completing at once, or a manual
// click racing the date-based sweep) can never double-trigger the same row.
// Never calls revalidatePath — callers that need fresh cache (the manual
// "Trigger Manually" button) revalidate themselves after; the automatic
// hooks below are fire-and-forget from contexts where a mid-render or
// already-returned revalidatePath call would be unsafe or pointless.
// ---------------------------------------------------------------------------

async function triggerMilestoneCore(
  supabase: SupabaseServerClient,
  milestoneId: string,
  triggerType: MilestoneTriggerType,
  context: { experienceTitle?: string } = {}
): Promise<boolean> {
  const { data: updated, error } = await supabase
    .from("payment_milestones")
    .update({ status: "triggered", triggered_at: new Date().toISOString() })
    .eq("id", milestoneId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    return false;
  }

  const reason = triggerReasonFor(triggerType, context);
  const result = await sendMilestoneNotificationCore(supabase, milestoneId, reason);

  if (!result.success) {
    console.error("Financial milestone notification failed", { milestoneId, error: result.error });
  }

  return true;
}

// ---------------------------------------------------------------------------
// Automatic triggering — called fire-and-forget from other features'
// Server Actions (and, for date-based, from the dashboard page render).
// Every export here swallows its own errors: a financial-notification
// hiccup must never block the experience/engagement status update that
// triggered it, matching how sendPostTrainingSurveysOnCompletion and
// maybeAutoIssueCertificate are called elsewhere in the codebase.
// ---------------------------------------------------------------------------

export async function triggerExperienceCompletionMilestones(experienceId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: experience } = await supabase
      .from("experiences")
      .select("id, title, engagement_id")
      .eq("id", experienceId)
      .maybeSingle();

    if (!experience) return;

    const { data: pendingByExperience } = await supabase
      .from("payment_milestones")
      .select("id")
      .eq("trigger_type", "experience_completion")
      .eq("trigger_experience_id", experienceId)
      .eq("status", "pending")
      .is("deleted_at", null);

    for (const row of pendingByExperience ?? []) {
      await triggerMilestoneCore(supabase, row.id, "experience_completion", { experienceTitle: experience.title });
    }

    if (!experience.engagement_id) return;

    const { data: siblingExperiences } = await supabase
      .from("experiences")
      .select("status")
      .eq("engagement_id", experience.engagement_id)
      .is("deleted_at", null);

    const experiences = siblingExperiences ?? [];
    const allCompleted = experiences.length > 0 && experiences.every((e) => e.status === "completed");

    if (!allCompleted) return;

    const { data: pendingByEngagement } = await supabase
      .from("payment_milestones")
      .select("id")
      .eq("trigger_type", "engagement_completion")
      .eq("engagement_id", experience.engagement_id)
      .eq("status", "pending")
      .is("deleted_at", null);

    for (const row of pendingByEngagement ?? []) {
      await triggerMilestoneCore(supabase, row.id, "engagement_completion");
    }
  } catch (error) {
    console.error("Financial milestone auto-trigger (experience completion) failed", { experienceId, error });
  }
}

export async function triggerEngagementSigningMilestones(engagementId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: pending } = await supabase
      .from("payment_milestones")
      .select("id")
      .eq("trigger_type", "engagement_signing")
      .eq("engagement_id", engagementId)
      .eq("status", "pending")
      .is("deleted_at", null);

    for (const row of pending ?? []) {
      await triggerMilestoneCore(supabase, row.id, "engagement_signing");
    }
  } catch (error) {
    console.error("Financial milestone auto-trigger (engagement signing) failed", { engagementId, error });
  }
}

export async function triggerDueDateBasedMilestones(workspaceId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: due } = await supabase
      .from("payment_milestones")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("trigger_type", "date_based")
      .eq("status", "pending")
      .lte("trigger_date", today)
      .is("deleted_at", null);

    for (const row of due ?? []) {
      await triggerMilestoneCore(supabase, row.id, "date_based");
    }
  } catch (error) {
    console.error("Financial milestone auto-trigger (date-based) failed", { workspaceId, error });
  }
}

// ---------------------------------------------------------------------------
// User-facing actions
// ---------------------------------------------------------------------------

export type MilestoneActionResult = { success: true } | { success: false; error: string };

export async function triggerMilestone(milestoneId: string): Promise<MilestoneActionResult> {
  const supabase = await createClient();

  const { data: milestone, error } = await supabase
    .from("payment_milestones")
    .select("id, status, trigger_type, engagement_id")
    .eq("id", milestoneId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { success: false, error: toActionError(error, "financial") };
  if (!milestone) return { success: false, error: "Milestone not found." };
  if (milestone.status !== "pending") return { success: false, error: "Only a pending milestone can be triggered." };

  const triggered = await triggerMilestoneCore(supabase, milestoneId, milestone.trigger_type);
  if (!triggered) return { success: false, error: "Unable to trigger this milestone. It may have already been triggered." };

  await revalidateEngagementFinancial(supabase, milestone.engagement_id);
  return { success: true };
}

export async function sendMilestoneNotification(milestoneId: string): Promise<MilestoneActionResult> {
  const supabase = await createClient();

  const { data: milestone, error } = await supabase
    .from("payment_milestones")
    .select("id, engagement_id, trigger_type")
    .eq("id", milestoneId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { success: false, error: toActionError(error, "financial") };
  if (!milestone) return { success: false, error: "Milestone not found." };

  const reason = triggerReasonFor(milestone.trigger_type, {});
  const result = await sendMilestoneNotificationCore(supabase, milestoneId, reason);
  if (!result.success) return { success: false, error: result.error };

  await revalidateEngagementFinancial(supabase, milestone.engagement_id);
  return { success: true };
}

const STATUS_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> = {
  pending: ["triggered"],
  triggered: ["invoiced"],
  invoiced: ["collected"],
  collected: [],
  overdue: ["invoiced", "collected"],
};

export async function updateMilestoneStatus(milestoneId: string, nextStatus: MilestoneStatus): Promise<MilestoneActionResult> {
  const supabase = await createClient();

  const { data: milestone, error } = await supabase
    .from("payment_milestones")
    .select("id, status, engagement_id")
    .eq("id", milestoneId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { success: false, error: toActionError(error, "financial") };
  if (!milestone) return { success: false, error: "Milestone not found." };

  const currentStatus = milestone.status as MilestoneStatus;
  if (!STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
    return { success: false, error: `Cannot change status from "${currentStatus}" to "${nextStatus}".` };
  }

  const updates: Record<string, string> = { status: nextStatus };
  if (nextStatus === "invoiced") updates.invoiced_at = new Date().toISOString();
  if (nextStatus === "collected") updates.collected_at = new Date().toISOString();

  const { error: updateError } = await supabase.from("payment_milestones").update(updates).eq("id", milestoneId);
  if (updateError) return { success: false, error: toActionError(updateError, "financial") };

  await revalidateEngagementFinancial(supabase, milestone.engagement_id);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Milestone CRUD
// ---------------------------------------------------------------------------

export type SaveMilestoneResult =
  | { success: true; milestoneId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

function readMilestoneForm(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    triggerType: formData.get("triggerType"),
    triggerExperienceId: formData.get("triggerExperienceId"),
    triggerDate: formData.get("triggerDate"),
    dueDate: formData.get("dueDate"),
    financeEmail: formData.get("financeEmail"),
    notes: formData.get("notes"),
  };
}

export async function createMilestone(engagementId: string, formData: FormData): Promise<SaveMilestoneResult> {
  const parsed = milestoneFormSchema.safeParse(readMilestoneForm(formData));

  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("workspace_id, client_id")
    .eq("id", engagementId)
    .maybeSingle();

  if (engagementError) return { success: false, error: toActionError(engagementError, "financial") };
  if (!engagement) return { success: false, error: "Engagement not found." };

  const { data: inserted, error } = await supabase
    .from("payment_milestones")
    .insert({
      engagement_id: engagementId,
      workspace_id: engagement.workspace_id,
      title: data.title,
      description: data.description ?? null,
      amount: data.amount,
      currency: data.currency,
      trigger_type: data.triggerType,
      trigger_experience_id: data.triggerType === "experience_completion" ? data.triggerExperienceId : null,
      trigger_date: data.triggerType === "date_based" ? data.triggerDate : null,
      due_date: data.dueDate ?? null,
      finance_email: data.financeEmail ?? null,
      notes: data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) return { success: false, error: toActionError(error, "financial", "Unable to create milestone.") };

  revalidatePath(`/dashboard/clients/${engagement.client_id}/engagements/${engagementId}`);

  return { success: true, milestoneId: inserted.id };
}

export async function updateMilestone(milestoneId: string, formData: FormData): Promise<SaveMilestoneResult> {
  const parsed = milestoneFormSchema.safeParse(readMilestoneForm(formData));

  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("payment_milestones")
    .select("engagement_id, engagements(client_id)")
    .eq("id", milestoneId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) return { success: false, error: toActionError(fetchError, "financial") };
  if (!existing) return { success: false, error: "Milestone not found." };

  const { error } = await supabase
    .from("payment_milestones")
    .update({
      title: data.title,
      description: data.description ?? null,
      amount: data.amount,
      currency: data.currency,
      trigger_type: data.triggerType,
      trigger_experience_id: data.triggerType === "experience_completion" ? data.triggerExperienceId : null,
      trigger_date: data.triggerType === "date_based" ? data.triggerDate : null,
      due_date: data.dueDate ?? null,
      finance_email: data.financeEmail ?? null,
      notes: data.notes ?? null,
    })
    .eq("id", milestoneId);

  if (error) return { success: false, error: toActionError(error, "financial") };

  const clientId = (existing.engagements as unknown as { client_id: string } | null)?.client_id;
  if (clientId) revalidatePath(`/dashboard/clients/${clientId}/engagements/${existing.engagement_id}`);

  return { success: true, milestoneId };
}

export async function deleteMilestone(milestoneId: string): Promise<MilestoneActionResult> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("payment_milestones")
    .select("engagement_id, engagements(client_id)")
    .eq("id", milestoneId)
    .maybeSingle();

  if (fetchError) return { success: false, error: toActionError(fetchError, "financial") };
  if (!existing) return { success: false, error: "Milestone not found." };

  const { error } = await supabase
    .from("payment_milestones")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", milestoneId);

  if (error) return { success: false, error: toActionError(error, "financial") };

  const clientId = (existing.engagements as unknown as { client_id: string } | null)?.client_id;
  if (clientId) revalidatePath(`/dashboard/clients/${clientId}/engagements/${existing.engagement_id}`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Finance contacts + settings
// ---------------------------------------------------------------------------

const FINANCE_SETTINGS_PATH = "/dashboard/settings/finance";

export async function createFinanceContact(workspaceId: string, formData: FormData): Promise<MilestoneActionResult> {
  const parsed = financeContactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    isPrimary: formData.get("isPrimary") === "on" || formData.get("isPrimary") === "true",
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the fields." };
  }

  const supabase = await createClient();

  if (parsed.data.isPrimary) {
    const { error: clearError } = await supabase
      .from("finance_contacts")
      .update({ is_primary: false })
      .eq("workspace_id", workspaceId);
    if (clearError) return { success: false, error: toActionError(clearError, "financial") };
  }

  const { error } = await supabase.from("finance_contacts").insert({
    workspace_id: workspaceId,
    name: parsed.data.name,
    email: parsed.data.email,
    is_primary: parsed.data.isPrimary,
  });

  if (error) return { success: false, error: toActionError(error, "financial") };

  revalidatePath(FINANCE_SETTINGS_PATH);
  return { success: true };
}

export async function setFinanceContactPrimary(contactId: string, workspaceId: string): Promise<MilestoneActionResult> {
  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from("finance_contacts")
    .update({ is_primary: false })
    .eq("workspace_id", workspaceId);
  if (clearError) return { success: false, error: toActionError(clearError, "financial") };

  const { error } = await supabase.from("finance_contacts").update({ is_primary: true }).eq("id", contactId);
  if (error) return { success: false, error: toActionError(error, "financial") };

  revalidatePath(FINANCE_SETTINGS_PATH);
  return { success: true };
}

export async function deleteFinanceContact(contactId: string): Promise<MilestoneActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("finance_contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", contactId);

  if (error) return { success: false, error: toActionError(error, "financial") };

  revalidatePath(FINANCE_SETTINGS_PATH);
  return { success: true };
}

export async function updateFinanceSettings(workspaceId: string, formData: FormData): Promise<MilestoneActionResult> {
  const parsed = financeSettingsSchema.safeParse({
    defaultCurrency: formData.get("defaultCurrency"),
    defaultPaymentTerms: formData.get("defaultPaymentTerms"),
  });

  if (!parsed.success) {
    return { success: false, error: "Please check the fields." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("workspaces")
    .update({
      default_currency: parsed.data.defaultCurrency,
      default_payment_terms: parsed.data.defaultPaymentTerms,
    })
    .eq("id", workspaceId);

  if (error) return { success: false, error: toActionError(error, "financial") };

  revalidatePath(FINANCE_SETTINGS_PATH);
  return { success: true };
}
