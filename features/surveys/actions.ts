"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireEnv } from "@/infrastructure/env";
import { getResendClient, getResendFromAddress } from "@/infrastructure/email/resend-client";
import {
  renderPostTrainingSurveyEmail,
  renderPreTrainingSurveyEmail,
  renderSurveyEmail,
  renderSurveyReminderEmail,
} from "@/infrastructure/email/survey-email";
import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";
import { maybeAutoIssueCertificate } from "@/features/certificates/actions";

import {
  surveyResponseSchema,
  surveyQuestionSchema,
  surveyTemplateSchema,
  type SurveyQuestionFormValues,
  type SurveyType,
} from "./schema";
import { getSurveyTemplate, type SurveyTemplateWithQuestions } from "./data";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type SendSurveyResult =
  | { success: true; sent: number; skipped: number; failed: number; errors: string[] }
  | { success: false; error: string };

export type SubmitSurveyResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

type ExperienceContext = { id: string; title: string; slug: string };
type ParticipantContext = { id: string; first_name: string; email: string };

const SURVEY_EMAIL_RENDERERS: Record<SurveyType, typeof renderSurveyEmail> = {
  satisfaction: renderSurveyEmail,
  pre_training: renderPreTrainingSurveyEmail,
  post_training: renderPostTrainingSurveyEmail,
};

async function ensureTokenAndSend(
  supabase: SupabaseServerClient,
  participant: ParticipantContext,
  experience: ExperienceContext,
  appUrl: string,
  surveyType: SurveyType = "satisfaction"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: findError } = await supabase
    .from("survey_tokens")
    .select("id, token, completed_at")
    .eq("participant_id", participant.id)
    .eq("workshop_id", experience.id)
    .eq("survey_type", surveyType)
    .maybeSingle();

  if (findError) {
    return { ok: false, error: findError.message };
  }

  if (existing?.completed_at) {
    return { ok: false, error: `${participant.first_name} already completed the survey.` };
  }

  let token = existing?.token as string | undefined;

  if (existing) {
    const { error } = await supabase
      .from("survey_tokens")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { data: inserted, error } = await supabase
      .from("survey_tokens")
      .insert({
        participant_id: participant.id,
        workshop_id: experience.id,
        survey_type: surveyType,
        sent_at: new Date().toISOString(),
      })
      .select("token")
      .single();

    if (error || !inserted) {
      return { ok: false, error: error?.message ?? "Unable to create survey token." };
    }

    token = inserted.token;
  }

  if (!token) {
    return { ok: false, error: "Unable to resolve survey token." };
  }

  const surveyUrl =
    surveyType === "satisfaction" ? `${appUrl}/survey/${token}` : `${appUrl}/survey/${token}?type=${surveyType}`;
  const { subject, html } = SURVEY_EMAIL_RENDERERS[surveyType]({
    participantFirstName: participant.first_name,
    experienceTitle: experience.title,
    surveyUrl,
  });

  try {
    const resend = getResendClient();
    const { error: sendError } = await resend.emails.send({
      from: getResendFromAddress(),
      to: participant.email,
      subject,
      html,
    });

    if (sendError) {
      return { ok: false, error: sendError.message };
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to send survey email.",
    };
  }

  return { ok: true };
}

function resolveAppUrl(): { ok: true; url: string } | { ok: false; error: string } {
  try {
    return { ok: true, url: requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "") };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Missing configuration." };
  }
}

export async function sendSurveyToParticipant(
  _prevState: SendSurveyResult | null,
  formData: FormData
): Promise<SendSurveyResult> {
  const experienceId = formData.get("experienceId")?.toString();
  const experienceSlug = formData.get("experienceSlug")?.toString();
  const experienceTitle = formData.get("experienceTitle")?.toString();
  const participantId = formData.get("participantId")?.toString();

  if (!experienceId || !experienceSlug || !experienceTitle || !participantId) {
    return { success: false, error: "Missing required fields." };
  }

  const appUrl = resolveAppUrl();
  if (!appUrl.ok) {
    return { success: false, error: appUrl.error };
  }

  const supabase = await createClient();

  const { data: participant, error: participantError } = await supabase
    .from("participants")
    .select("id, first_name, email")
    .eq("id", participantId)
    .single();

  if (participantError || !participant) {
    return { success: false, error: "Participant not found." };
  }

  const result = await ensureTokenAndSend(
    supabase,
    participant,
    { id: experienceId, title: experienceTitle, slug: experienceSlug },
    appUrl.url
  );

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return { success: true, sent: 1, skipped: 0, failed: 0, errors: [] };
}

export async function sendSurveyToAllParticipants(
  _prevState: SendSurveyResult | null,
  formData: FormData
): Promise<SendSurveyResult> {
  const experienceId = formData.get("experienceId")?.toString();
  const experienceSlug = formData.get("experienceSlug")?.toString();
  const experienceTitle = formData.get("experienceTitle")?.toString();

  if (!experienceId || !experienceSlug || !experienceTitle) {
    return { success: false, error: "Missing required fields." };
  }

  const appUrl = resolveAppUrl();
  if (!appUrl.ok) {
    return { success: false, error: appUrl.error };
  }

  const supabase = await createClient();

  const [{ data: participants, error: participantsError }, { data: tokens, error: tokensError }] =
    await Promise.all([
      supabase
        .from("participants")
        .select("id, first_name, email")
        .eq("workshop_slug", experienceSlug),
      supabase
        .from("survey_tokens")
        .select("participant_id")
        .eq("workshop_id", experienceId)
        .eq("survey_type", "satisfaction"),
    ]);

  if (participantsError) {
    return { success: false, error: participantsError.message };
  }

  if (tokensError) {
    return { success: false, error: tokensError.message };
  }

  const participantIdsWithTokens = new Set((tokens ?? []).map((token) => token.participant_id));
  const targets = (participants ?? []).filter((participant) => !participantIdsWithTokens.has(participant.id));

  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const participant of targets) {
    const result = await ensureTokenAndSend(
      supabase,
      participant,
      { id: experienceId, title: experienceTitle, slug: experienceSlug },
      appUrl.url
    );

    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      errors.push(`${participant.first_name}: ${result.error}`);
    }
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  return {
    success: true,
    sent,
    skipped: (participants?.length ?? 0) - targets.length,
    failed,
    errors,
  };
}

export async function submitSurveyResponse(
  _prevState: SubmitSurveyResult | null,
  formData: FormData
): Promise<SubmitSurveyResult> {
  const parsed = surveyResponseSchema.safeParse({
    token: formData.get("token"),
    contentRating: formData.get("contentRating"),
    facilitatorRating: formData.get("facilitatorRating"),
    logisticsRating: formData.get("logisticsRating"),
    overallRating: formData.get("overallRating"),
    highlights: formData.get("highlights"),
    improvements: formData.get("improvements"),
    additionalComments: formData.get("additionalComments"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Please complete all required fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_survey_response", {
    p_token: parsed.data.token,
    p_content_rating: parsed.data.contentRating,
    p_facilitator_rating: parsed.data.facilitatorRating,
    p_logistics_rating: parsed.data.logisticsRating,
    p_overall_rating: parsed.data.overallRating,
    p_highlights: parsed.data.highlights,
    p_improvements: parsed.data.improvements,
    p_additional_comments: parsed.data.additionalComments || null,
  });

  if (error) {
    if (error.message.includes("already_completed")) {
      return { success: false, error: "This survey has already been completed." };
    }

    if (error.message.includes("invalid_token")) {
      return { success: false, error: "This survey link is invalid." };
    }

    return { success: false, error: "Unable to submit your response. Please try again." };
  }

  // Fire-and-forget, same reasoning as the check-in flow: a certificate
  // hiccup must never surface as a survey-submission failure.
  const { data: tokenRow } = await supabase
    .from("survey_tokens")
    .select("participant_id, workshop_id")
    .eq("token", parsed.data.token)
    .maybeSingle();

  if (tokenRow) {
    void maybeAutoIssueCertificate(tokenRow.participant_id, tokenRow.workshop_id);
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Non-responder resend (bulk) — reuses the original invite email/template,
// unlike sendSurveyReminder below, which is the shorter, per-participant
// nudge described in the Sprint 15 brief.
// ---------------------------------------------------------------------------

export async function sendToNonResponders(
  experienceSlug: string,
  workshopId: string
): Promise<SendSurveyResult> {
  const appUrl = resolveAppUrl();
  if (!appUrl.ok) {
    return { success: false, error: appUrl.error };
  }

  const supabase = await createClient();

  const { data: experience, error: experienceError } = await supabase
    .from("experiences")
    .select("id, title, slug")
    .eq("id", workshopId)
    .maybeSingle();

  if (experienceError) {
    return { success: false, error: experienceError.message };
  }

  if (!experience) {
    return { success: false, error: "Experience not found." };
  }

  const [{ data: participants, error: participantsError }, { data: tokens, error: tokensError }] =
    await Promise.all([
      supabase
        .from("participants")
        .select("id, first_name, email")
        .eq("workshop_slug", experienceSlug),
      supabase
        .from("survey_tokens")
        .select("participant_id, completed_at")
        .eq("workshop_id", workshopId)
        .eq("survey_type", "satisfaction"),
    ]);

  if (participantsError) {
    return { success: false, error: participantsError.message };
  }

  if (tokensError) {
    return { success: false, error: tokensError.message };
  }

  const tokenByParticipantId = new Map((tokens ?? []).map((token) => [token.participant_id, token]));

  // Non-responders: a token exists (they were sent one) but it's not
  // completed. Participants with no token at all belong to "Send to all
  // unsent" (sendSurveyToAllParticipants above), not this action.
  const targets = (participants ?? []).filter((participant) => {
    const token = tokenByParticipantId.get(participant.id);
    return Boolean(token) && !token?.completed_at;
  });

  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const participant of targets) {
    const result = await ensureTokenAndSend(
      supabase,
      participant,
      { id: experience.id, title: experience.title, slug: experience.slug },
      appUrl.url
    );

    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      errors.push(`${participant.first_name}: ${result.error}`);
    }
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  return {
    success: true,
    sent,
    skipped: (participants?.length ?? 0) - targets.length,
    failed,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Individual reminder — shorter email, gated to tokens sent >48h ago that
// still haven't completed (the UI only shows this action once that's true,
// but it's re-checked here too since a Server Action can be invoked
// directly regardless of what the client currently renders).
// ---------------------------------------------------------------------------

export type SendReminderResult = { success: true } | { success: false; error: string };

const REMINDER_ELIGIBLE_HOURS = 48;

export async function sendSurveyReminder(tokenId: string): Promise<SendReminderResult> {
  const appUrl = resolveAppUrl();
  if (!appUrl.ok) {
    return { success: false, error: appUrl.error };
  }

  const supabase = await createClient();

  const { data: token, error: tokenError } = await supabase
    .from("survey_tokens")
    .select("id, token, participant_id, workshop_id, sent_at, completed_at")
    .eq("id", tokenId)
    .maybeSingle();

  if (tokenError) {
    return { success: false, error: tokenError.message };
  }

  if (!token) {
    return { success: false, error: "Survey token not found." };
  }

  if (token.completed_at) {
    return { success: false, error: "This participant already completed the survey." };
  }

  if (token.sent_at) {
    const hoursSinceSent = (Date.now() - new Date(token.sent_at).getTime()) / 3_600_000;
    if (hoursSinceSent < REMINDER_ELIGIBLE_HOURS) {
      return {
        success: false,
        error: `Reminders can only be sent ${REMINDER_ELIGIBLE_HOURS} hours after the original invite.`,
      };
    }
  }

  const [{ data: participant, error: participantError }, { data: experience, error: experienceError }] =
    await Promise.all([
      supabase.from("participants").select("first_name, email").eq("id", token.participant_id).maybeSingle(),
      supabase.from("experiences").select("title, slug").eq("id", token.workshop_id).maybeSingle(),
    ]);

  if (participantError || !participant) {
    return { success: false, error: "Participant not found." };
  }

  if (experienceError || !experience) {
    return { success: false, error: "Experience not found." };
  }

  const surveyUrl = `${appUrl.url}/survey/${token.token}`;
  const { subject, html } = renderSurveyReminderEmail({
    participantFirstName: participant.first_name,
    experienceTitle: experience.title,
    surveyUrl,
  });

  try {
    const resend = getResendClient();
    const { error: sendError } = await resend.emails.send({
      from: getResendFromAddress(),
      to: participant.email,
      subject,
      html,
    });

    if (sendError) {
      return { success: false, error: sendError.message };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to send reminder email.",
    };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("survey_tokens")
    .update({ sent_at: now, reminder_sent_at: now })
    .eq("id", tokenId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath(`/dashboard/experiences/${experience.slug}`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Flag for follow-up
// ---------------------------------------------------------------------------

export type FlagSurveyResponseResult = { success: true; flagged: boolean } | { success: false; error: string };

export async function flagSurveyResponse(
  responseId: string,
  flagged: boolean
): Promise<FlagSurveyResponseResult> {
  const supabase = await createClient();

  const { data: response, error: fetchError } = await supabase
    .from("survey_responses")
    .select("workshop_id")
    .eq("id", responseId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  if (!response) {
    return { success: false, error: "Survey response not found." };
  }

  const { error } = await supabase.from("survey_responses").update({ flagged }).eq("id", responseId);

  if (error) {
    return { success: false, error: error.message };
  }

  const { data: experience } = await supabase
    .from("experiences")
    .select("slug")
    .eq("id", response.workshop_id)
    .maybeSingle();

  if (experience) {
    revalidatePath(`/dashboard/experiences/${experience.slug}`);
  }

  return { success: true, flagged };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(values: string[]): string {
  return values.map(csvEscape).join(",");
}

function formatCsvDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const SURVEY_CSV_HEADER = [
  "Participant Name",
  "Company",
  "Content Rating",
  "Facilitator Rating",
  "Logistics Rating",
  "Overall Rating",
  "Highlights",
  "Improvements",
  "Additional Comments",
  "Submitted At",
];

export async function downloadSurveyResults(experienceId: string): Promise<string> {
  const supabase = await createClient();

  const { data: responseRows, error } = await supabase
    .from("survey_responses")
    .select(
      "participant_id, content_rating, facilitator_rating, logistics_rating, overall_rating, highlights, improvements, additional_comments, submitted_at"
    )
    .eq("workshop_id", experienceId)
    .eq("survey_type", "satisfaction")
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = responseRows ?? [];
  const participantIds = [...new Set(rows.map((row) => row.participant_id))];

  const { data: participantRows, error: participantsError } =
    participantIds.length > 0
      ? await supabase.from("participants").select("id, first_name, last_name, company").in("id", participantIds)
      : { data: [], error: null };

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  const participantById = new Map((participantRows ?? []).map((row) => [row.id, row]));

  const csvRows = rows.map((row) => {
    const participant = participantById.get(row.participant_id);

    return csvRow([
      participant ? `${participant.first_name} ${participant.last_name}` : "",
      participant?.company ?? "",
      row.content_rating === null ? "" : String(row.content_rating),
      row.facilitator_rating === null ? "" : String(row.facilitator_rating),
      row.logistics_rating === null ? "" : String(row.logistics_rating),
      row.overall_rating === null ? "" : String(row.overall_rating),
      row.highlights ?? "",
      row.improvements ?? "",
      row.additional_comments ?? "",
      formatCsvDateTime(row.submitted_at),
    ]);
  });

  return [csvRow(SURVEY_CSV_HEADER), ...csvRows].join("\r\n");
}

// ---------------------------------------------------------------------------
// Survey templates
// ---------------------------------------------------------------------------

export type SaveSurveyTemplateResult =
  | { success: true; templateId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createSurveyTemplate(
  workspaceId: string,
  _prevState: SaveSurveyTemplateResult | null,
  formData: FormData
): Promise<SaveSurveyTemplateResult> {
  const parsed = surveyTemplateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    surveyType: formData.get("surveyType") || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("survey_templates")
    .insert({
      workspace_id: workspaceId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      survey_type: parsed.data.surveyType,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Unable to create template." };
  }

  revalidatePath("/dashboard/settings/surveys");
  redirect(`/dashboard/settings/surveys/${inserted.id}/edit`);
}

export async function updateSurveyTemplate(
  templateId: string,
  _prevState: SaveSurveyTemplateResult | null,
  formData: FormData
): Promise<SaveSurveyTemplateResult> {
  const parsed = surveyTemplateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    surveyType: formData.get("surveyType") || undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("survey_templates")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      survey_type: parsed.data.surveyType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/settings/surveys");
  revalidatePath(`/dashboard/settings/surveys/${templateId}/edit`);

  return { success: true, templateId };
}

export type DeleteSurveyTemplateResult = { success: true } | { success: false; error: string };

export async function deleteSurveyTemplate(templateId: string): Promise<DeleteSurveyTemplateResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("survey_templates").delete().eq("id", templateId);

  if (error) {
    // A template referenced by experience_survey_templates.template_id (no
    // ON DELETE action there) or by a still-live survey_questions row's
    // template_id cascade is fine — but experience_survey_templates has no
    // cascade, so deleting a template an experience explicitly overrides to
    // fails with a foreign key violation. Surface that plainly rather than
    // the raw Postgres error text.
    if (error.message.includes("foreign key")) {
      return {
        success: false,
        error: "This template is assigned to one or more experiences. Unassign it first.",
      };
    }
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/settings/surveys");

  return { success: true };
}

export type SetDefaultSurveyTemplateResult = { success: true } | { success: false; error: string };

export async function setDefaultSurveyTemplate(
  templateId: string,
  workspaceId: string
): Promise<SetDefaultSurveyTemplateResult> {
  const supabase = await createClient();

  // "Default" is scoped per survey_type — setting a new pre-training
  // default must not clear the satisfaction (or post-training) default.
  const { data: template, error: templateError } = await supabase
    .from("survey_templates")
    .select("survey_type")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError) {
    return { success: false, error: templateError.message };
  }
  if (!template) {
    return { success: false, error: "Template not found." };
  }

  const { error: clearError } = await supabase
    .from("survey_templates")
    .update({ is_default: false })
    .eq("workspace_id", workspaceId)
    .eq("survey_type", template.survey_type)
    .neq("id", templateId);

  if (clearError) {
    return { success: false, error: clearError.message };
  }

  const { error } = await supabase.from("survey_templates").update({ is_default: true }).eq("id", templateId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/settings/surveys");

  return { success: true };
}

// ---------------------------------------------------------------------------
// Survey questions
// ---------------------------------------------------------------------------

export type SaveQuestionResult =
  | { success: true; questionId: string }
  | { success: false; error: string };

function questionInsertPayload(templateId: string, orderIndex: number, values: SurveyQuestionFormValues) {
  return {
    template_id: templateId,
    order_index: orderIndex,
    question_type: values.questionType,
    question_text: values.questionText,
    description: values.description ?? null,
    is_required: values.isRequired,
    options: values.options && values.options.length > 0 ? values.options : null,
    low_label: values.lowLabel ?? null,
    high_label: values.highLabel ?? null,
  };
}

export async function addQuestion(templateId: string, values: SurveyQuestionFormValues): Promise<SaveQuestionResult> {
  const parsed = surveyQuestionSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the question fields." };
  }

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("survey_questions")
    .select("order_index")
    .eq("template_id", templateId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  const nextOrderIndex = (existing?.order_index ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("survey_questions")
    .insert(questionInsertPayload(templateId, nextOrderIndex, parsed.data))
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Unable to add question." };
  }

  revalidatePath(`/dashboard/settings/surveys/${templateId}/edit`);

  return { success: true, questionId: inserted.id };
}

export async function updateQuestion(
  questionId: string,
  templateId: string,
  values: SurveyQuestionFormValues
): Promise<SaveQuestionResult> {
  const parsed = surveyQuestionSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the question fields." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("survey_questions")
    .update({
      question_type: parsed.data.questionType,
      question_text: parsed.data.questionText,
      description: parsed.data.description ?? null,
      is_required: parsed.data.isRequired,
      options: parsed.data.options && parsed.data.options.length > 0 ? parsed.data.options : null,
      low_label: parsed.data.lowLabel ?? null,
      high_label: parsed.data.highLabel ?? null,
    })
    .eq("id", questionId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/settings/surveys/${templateId}/edit`);

  return { success: true, questionId };
}

export type DeleteQuestionResult = { success: true } | { success: false; error: string };

export async function deleteQuestion(questionId: string, templateId: string): Promise<DeleteQuestionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("survey_questions").delete().eq("id", questionId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/dashboard/settings/surveys/${templateId}/edit`);

  return { success: true };
}

export type ReorderQuestionsResult = { success: true } | { success: false; error: string };

/**
 * Drag-to-reorder (HTML5 drag events, no library — see
 * question-list-editor.tsx) sends the full ordered id list on every drop;
 * this just re-numbers order_index to match array position. One update per
 * row — supabase-js has no bulk "case when" upsert-by-position helper, and
 * template question counts are small (single digits to low tens), so N
 * sequential updates is not a real cost here.
 */
export async function reorderQuestions(templateId: string, orderedQuestionIds: string[]): Promise<ReorderQuestionsResult> {
  const supabase = await createClient();

  for (let index = 0; index < orderedQuestionIds.length; index++) {
    const { error } = await supabase
      .from("survey_questions")
      .update({ order_index: index + 1 })
      .eq("id", orderedQuestionIds[index])
      .eq("template_id", templateId);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath(`/dashboard/settings/surveys/${templateId}/edit`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Assign a template to an experience (overrides the workspace default)
// ---------------------------------------------------------------------------

export type AssignExperienceSurveyTemplateResult = { success: true } | { success: false; error: string };

export async function assignExperienceSurveyTemplate(
  experienceId: string,
  experienceSlug: string,
  templateId: string | null,
  surveyType: SurveyType = "satisfaction"
): Promise<AssignExperienceSurveyTemplateResult> {
  const supabase = await createClient();

  if (templateId === null) {
    const { error } = await supabase
      .from("experience_survey_templates")
      .delete()
      .eq("experience_id", experienceId)
      .eq("survey_type", surveyType);

    if (error) {
      return { success: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from("experience_survey_templates").upsert(
      { experience_id: experienceId, survey_type: surveyType, template_id: templateId },
      { onConflict: "experience_id,survey_type" }
    );

    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Custom template survey submission — the template-driven sibling of
// submitSurveyResponse above. Kept as a separate action (rather than
// overloading submitSurveyResponse's FormData/useActionState signature)
// because the two forms have fundamentally different shapes: the legacy
// form's four fixed fields fit useActionState/FormData cleanly, while a
// dynamic per-template question list needs controlled client state to
// validate "all required questions answered" before submitting — the same
// reasoning as the completion-criteria form in features/certificates.
// ---------------------------------------------------------------------------

export type CustomSurveyAnswerInput = {
  questionId: string;
  answerNumeric?: number;
  answerText?: string;
  answerArray?: string[];
};

export type SubmitCustomSurveyResult = { success: true } | { success: false; error: string };

export async function submitCustomSurveyResponse(
  token: string,
  answers: CustomSurveyAnswerInput[]
): Promise<SubmitCustomSurveyResult> {
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_custom_survey_response", {
    p_token: token,
    p_answers: answers.map((answer) => ({
      questionId: answer.questionId,
      answerNumeric: answer.answerNumeric ?? null,
      answerText: answer.answerText ?? null,
      answerArray: answer.answerArray ?? null,
    })),
  });

  if (error) {
    if (error.message.includes("already_completed")) {
      return { success: false, error: "This survey has already been completed." };
    }
    if (error.message.includes("invalid_token")) {
      return { success: false, error: "This survey link is invalid." };
    }
    return { success: false, error: "Unable to submit your response. Please try again." };
  }

  return { success: true };
}

/**
 * Thin Server Action wrapper so the template list page's Preview button can
 * load a template's full question set on demand (the list itself only
 * fetches per-template question counts, not the questions) without a
 * dedicated API route.
 */
export async function getTemplateForPreview(templateId: string): Promise<SurveyTemplateWithQuestions | null> {
  return getSurveyTemplate(templateId);
}

// ---------------------------------------------------------------------------
// Pre/post survey configuration — Sprint 19
// ---------------------------------------------------------------------------

export type SaveExperienceSurveyConfigResult = { success: true } | { success: false; error: string };

type SurveyTypeConfigInput = { enabled: boolean; templateId: string | null; autoSend: boolean };

/**
 * Saves both the pre-training and post-training sections of the Surveys
 * tab in one call. "Enabled" has no dedicated column — it's the presence
 * (upsert) or absence (delete) of the (experience, type) row, mirroring the
 * existing satisfaction-override pattern in assignExperienceSurveyTemplate.
 */
export async function saveExperienceSurveyConfig(
  experienceId: string,
  experienceSlug: string,
  config: { preTraining: SurveyTypeConfigInput; postTraining: SurveyTypeConfigInput }
): Promise<SaveExperienceSurveyConfigResult> {
  const supabase = await createClient();

  const sections: [SurveyType, SurveyTypeConfigInput][] = [
    ["pre_training", config.preTraining],
    ["post_training", config.postTraining],
  ];

  for (const [surveyType, section] of sections) {
    if (!section.enabled || !section.templateId) {
      const { error } = await supabase
        .from("experience_survey_templates")
        .delete()
        .eq("experience_id", experienceId)
        .eq("survey_type", surveyType);

      if (error) {
        return { success: false, error: error.message };
      }
      continue;
    }

    const { error } = await supabase.from("experience_survey_templates").upsert(
      {
        experience_id: experienceId,
        survey_type: surveyType,
        template_id: section.templateId,
        auto_send: section.autoSend,
      },
      { onConflict: "experience_id,survey_type" }
    );

    if (error) {
      return { success: false, error: error.message };
    }
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  return { success: true };
}

/**
 * Send the configured pre/post-training survey to every participant who
 * doesn't already have a token for it — the manual "Send to all now"
 * buttons in each config section. Mirrors sendSurveyToAllParticipants'
 * "skip anyone already sent" semantics.
 */
async function sendTypedSurveyToAll(
  experienceId: string,
  experienceSlug: string,
  surveyType: "pre_training" | "post_training"
): Promise<SendSurveyResult> {
  const appUrl = resolveAppUrl();
  if (!appUrl.ok) {
    return { success: false, error: appUrl.error };
  }

  const supabase = await createClient();

  const [{ data: experience, error: experienceError }, { data: config, error: configError }] = await Promise.all([
    supabase.from("experiences").select("id, title, slug").eq("id", experienceId).maybeSingle(),
    supabase
      .from("experience_survey_templates")
      .select("template_id")
      .eq("experience_id", experienceId)
      .eq("survey_type", surveyType)
      .maybeSingle(),
  ]);

  if (experienceError) {
    return { success: false, error: experienceError.message };
  }
  if (!experience) {
    return { success: false, error: "Experience not found." };
  }
  if (configError) {
    return { success: false, error: configError.message };
  }
  if (!config) {
    return { success: false, error: "This survey type isn't configured for this experience yet." };
  }

  const [{ data: participants, error: participantsError }, { data: tokens, error: tokensError }] =
    await Promise.all([
      supabase.from("participants").select("id, first_name, email").eq("workshop_slug", experience.slug),
      supabase
        .from("survey_tokens")
        .select("participant_id")
        .eq("workshop_id", experienceId)
        .eq("survey_type", surveyType),
    ]);

  if (participantsError) {
    return { success: false, error: participantsError.message };
  }
  if (tokensError) {
    return { success: false, error: tokensError.message };
  }

  const participantIdsWithTokens = new Set((tokens ?? []).map((token) => token.participant_id));
  const targets = (participants ?? []).filter((participant) => !participantIdsWithTokens.has(participant.id));

  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const participant of targets) {
    const result = await ensureTokenAndSend(supabase, participant, experience, appUrl.url, surveyType);

    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      errors.push(`${participant.first_name}: ${result.error}`);
    }
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  return {
    success: true,
    sent,
    skipped: (participants?.length ?? 0) - targets.length,
    failed,
    errors,
  };
}

export async function sendPreTrainingSurveyToAll(experienceId: string, experienceSlug: string): Promise<SendSurveyResult> {
  return sendTypedSurveyToAll(experienceId, experienceSlug, "pre_training");
}

export async function sendPostTrainingSurveyToAll(experienceId: string, experienceSlug: string): Promise<SendSurveyResult> {
  return sendTypedSurveyToAll(experienceId, experienceSlug, "post_training");
}

// ---------------------------------------------------------------------------
// Auto-send hooks — called fire-and-forget from other features'
// Server Actions (participant registration, experience status update).
// Each swallows its own errors the same way maybeAutoIssueCertificate
// does: a survey-send hiccup must never surface as a failure in the action
// that triggered it.
// ---------------------------------------------------------------------------

export async function sendPreTrainingSurveyOnRegistration(participantId: string, experienceId: string): Promise<void> {
  try {
    // Called from the anonymous public check-in flow (features/participants/
    // actions.ts) — there's no session to bind to, and both the lookups
    // below and ensureTokenAndSend's survey_tokens insert require the
    // `authenticated` role under RLS. The service-role client bypasses that,
    // matching maybeAutoIssueCertificate/createOrGetMaterialToken, which
    // already do the same for this exact fire-and-forget path.
    const supabase = createServiceRoleClient();

    const { data: config } = await supabase
      .from("experience_survey_templates")
      .select("template_id, auto_send")
      .eq("experience_id", experienceId)
      .eq("survey_type", "pre_training")
      .maybeSingle();

    if (!config || !config.auto_send) {
      return;
    }

    const appUrl = resolveAppUrl();
    if (!appUrl.ok) {
      console.error("Pre-training auto-send failed: missing app URL configuration");
      return;
    }

    const [{ data: participant }, { data: experience }] = await Promise.all([
      supabase.from("participants").select("id, first_name, email").eq("id", participantId).maybeSingle(),
      supabase.from("experiences").select("id, title, slug").eq("id", experienceId).maybeSingle(),
    ]);

    if (!participant || !experience) {
      return;
    }

    const result = await ensureTokenAndSend(supabase, participant, experience, appUrl.url, "pre_training");

    if (!result.ok) {
      console.error("Pre-training auto-send failed", { participantId, experienceId, error: result.error });
    }
  } catch (error) {
    console.error("Pre-training auto-send failed", { participantId, experienceId, error });
  }
}

export async function sendPostTrainingSurveysOnCompletion(experienceId: string): Promise<void> {
  try {
    const supabase = await createClient();

    const { data: config } = await supabase
      .from("experience_survey_templates")
      .select("template_id, auto_send")
      .eq("experience_id", experienceId)
      .eq("survey_type", "post_training")
      .maybeSingle();

    if (!config || !config.auto_send) {
      return;
    }

    const appUrl = resolveAppUrl();
    if (!appUrl.ok) {
      console.error("Post-training auto-send failed: missing app URL configuration");
      return;
    }

    const { data: experience } = await supabase
      .from("experiences")
      .select("id, title, slug")
      .eq("id", experienceId)
      .maybeSingle();

    if (!experience) {
      return;
    }

    const { data: participants } = await supabase
      .from("participants")
      .select("id, first_name, email")
      .eq("workshop_slug", experience.slug);

    for (const participant of participants ?? []) {
      const result = await ensureTokenAndSend(supabase, participant, experience, appUrl.url, "post_training");

      if (!result.ok) {
        console.error("Post-training auto-send failed for participant", { participantId: participant.id, error: result.error });
      }
    }
  } catch (error) {
    console.error("Post-training auto-send failed", { experienceId, error });
  }
}
