"use server";

import { revalidatePath } from "next/cache";

import { requireEnv } from "@/infrastructure/env";
import { getResendClient, getResendFromAddress } from "@/infrastructure/email/resend-client";
import { renderSurveyEmail } from "@/infrastructure/email/survey-email";
import { createClient } from "@/infrastructure/supabase/server";

import { surveyResponseSchema } from "./schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type SendSurveyResult =
  | { success: true; sent: number; skipped: number; failed: number; errors: string[] }
  | { success: false; error: string };

export type SubmitSurveyResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

type WorkshopContext = { id: string; title: string; slug: string };
type ParticipantContext = { id: string; first_name: string; email: string };

async function ensureTokenAndSend(
  supabase: SupabaseServerClient,
  participant: ParticipantContext,
  workshop: WorkshopContext,
  appUrl: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: findError } = await supabase
    .from("survey_tokens")
    .select("id, token, completed_at")
    .eq("participant_id", participant.id)
    .eq("workshop_id", workshop.id)
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
        workshop_id: workshop.id,
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

  const surveyUrl = `${appUrl}/survey/${token}`;
  const { subject, html } = renderSurveyEmail({
    participantFirstName: participant.first_name,
    workshopTitle: workshop.title,
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
  const workshopId = formData.get("workshopId")?.toString();
  const workshopSlug = formData.get("workshopSlug")?.toString();
  const workshopTitle = formData.get("workshopTitle")?.toString();
  const participantId = formData.get("participantId")?.toString();

  if (!workshopId || !workshopSlug || !workshopTitle || !participantId) {
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
    { id: workshopId, title: workshopTitle, slug: workshopSlug },
    appUrl.url
  );

  revalidatePath(`/dashboard/workshops/${workshopSlug}`);

  if (!result.ok) {
    return { success: false, error: result.error };
  }

  return { success: true, sent: 1, skipped: 0, failed: 0, errors: [] };
}

export async function sendSurveyToAllParticipants(
  _prevState: SendSurveyResult | null,
  formData: FormData
): Promise<SendSurveyResult> {
  const workshopId = formData.get("workshopId")?.toString();
  const workshopSlug = formData.get("workshopSlug")?.toString();
  const workshopTitle = formData.get("workshopTitle")?.toString();

  if (!workshopId || !workshopSlug || !workshopTitle) {
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
        .eq("workshop_slug", workshopSlug),
      supabase
        .from("survey_tokens")
        .select("participant_id")
        .eq("workshop_id", workshopId),
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
      { id: workshopId, title: workshopTitle, slug: workshopSlug },
      appUrl.url
    );

    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      errors.push(`${participant.first_name}: ${result.error}`);
    }
  }

  revalidatePath(`/dashboard/workshops/${workshopSlug}`);

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

  return { success: true };
}
