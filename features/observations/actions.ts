"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";

import { createClient } from "@/infrastructure/supabase/server";
import { getSessionContext } from "@/infrastructure/session/session-context";
import { toActionError } from "@/shared/errors/action-error";
import { getReportBranding } from "@/features/reports/data";
import { downloadReportLogo } from "@/features/reports/storage";

import { observationTagsSchema, participantObservationSchema, experienceObservationSchema } from "./schema";
import { getExperienceContextForReport, type FacilitatorReport } from "./data";
import { buildFacilitatorReportContext } from "./report-context";
import { generateFacilitatorReportPdf } from "./report";
import { uploadFacilitatorReportPdf, getFacilitatorReportSignedUrl } from "./storage";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function resolveFacilitatorId(supabase: SupabaseServerClient, email: string): Promise<string | null> {
  if (!email) {
    return null;
  }

  const { data } = await supabase.from("facilitators").select("id").ilike("email", email).maybeSingle();
  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// Observation tags
// ---------------------------------------------------------------------------

export type SaveObservationTagsResult = { success: true } | { success: false; error: string };

/**
 * Full replace, not a diff/upsert — the same approach question-list-editor's
 * reorderQuestions takes for this exact shape of "small, freely reorderable
 * per-parent config list" (see migration 0027's header comment for why this
 * table has no deleted_at to soft-delete into).
 */
export async function saveObservationTags(
  experienceId: string,
  tags: { label: string; color: string }[]
): Promise<SaveObservationTagsResult> {
  const parsed = observationTagsSchema.safeParse(tags);

  if (!parsed.success) {
    return { success: false, error: "Please correct the highlighted tags." };
  }

  const session = await getSessionContext();
  const supabase = await createClient();

  const { error: deleteError } = await supabase.from("observation_tags").delete().eq("experience_id", experienceId);

  if (deleteError) {
    return { success: false, error: toActionError(deleteError, "observations") };
  }

  if (parsed.data.length > 0) {
    const { error: insertError } = await supabase.from("observation_tags").insert(
      parsed.data.map((tag, index) => ({
        organization_id: session.organizationId,
        workspace_id: session.workspaceId,
        experience_id: experienceId,
        label: tag.label,
        color: tag.color,
        order_index: index,
      }))
    );

    if (insertError) {
      return { success: false, error: toActionError(insertError, "observations") };
    }
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Participant observations — one Server Action for both the debounced notes
// textarea and the immediate tag toggle (see components), since both write
// the same row and always send its full current state.
// ---------------------------------------------------------------------------

export type SaveParticipantObservationResult = { success: true } | { success: false; error: string };

export async function saveParticipantObservation(
  experienceId: string,
  participantId: string,
  notes: string,
  tags: string[],
  facilitatorName: string
): Promise<SaveParticipantObservationResult> {
  const parsed = participantObservationSchema.safeParse({
    experienceId,
    participantId,
    notes,
    tags,
    facilitatorName,
  });

  if (!parsed.success) {
    return { success: false, error: "Enter a facilitator name before saving." };
  }

  const session = await getSessionContext();
  const supabase = await createClient();
  const facilitatorId = await resolveFacilitatorId(supabase, session.email);

  const { error } = await supabase.from("participant_observations").upsert(
    {
      organization_id: session.organizationId,
      workspace_id: session.workspaceId,
      experience_id: parsed.data.experienceId,
      participant_id: parsed.data.participantId,
      facilitator_id: facilitatorId,
      facilitator_name: parsed.data.facilitatorName,
      notes: parsed.data.notes || null,
      tags: parsed.data.tags,
    },
    { onConflict: "experience_id,participant_id,facilitator_name" }
  );

  if (error) {
    return { success: false, error: toActionError(error, "observations") };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Experience-level (overall) observations
// ---------------------------------------------------------------------------

export type SaveExperienceObservationResult = { success: true } | { success: false; error: string };

export async function saveExperienceObservation(
  experienceId: string,
  data: { groupDynamics: string; keyThemes: string; recommendations: string; generalNotes: string },
  facilitatorName: string
): Promise<SaveExperienceObservationResult> {
  const parsed = experienceObservationSchema.safeParse({ experienceId, facilitatorName, ...data });

  if (!parsed.success) {
    return { success: false, error: "Enter a facilitator name before saving." };
  }

  const session = await getSessionContext();
  const supabase = await createClient();
  const facilitatorId = await resolveFacilitatorId(supabase, session.email);

  const { error } = await supabase.from("experience_observations").upsert(
    {
      organization_id: session.organizationId,
      workspace_id: session.workspaceId,
      experience_id: parsed.data.experienceId,
      facilitator_id: facilitatorId,
      facilitator_name: parsed.data.facilitatorName,
      group_dynamics: parsed.data.groupDynamics || null,
      key_themes: parsed.data.keyThemes || null,
      recommendations: parsed.data.recommendations || null,
      general_notes: parsed.data.generalNotes || null,
    },
    { onConflict: "experience_id,facilitator_name" }
  );

  if (error) {
    return { success: false, error: toActionError(error, "observations") };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// AI-assisted final report
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1400;

const SYSTEM_PROMPT = `You are assisting a professional facilitator in drafting a post-program report for a client.

Your role is to synthesize the facilitator's observations into a coherent, professional report.

CRITICAL RULES:
1. Never identify individual participants by name — use general language ("several participants", "one participant noted", "the group")
2. Write in a professional, consultative tone appropriate for corporate clients
3. Base every claim on the observations provided — never add information not in the context
4. Structure the report exactly as specified in the output format
5. Keep the report between 400 and 600 words
6. Write as if the facilitator is speaking — use "I observed", "The group demonstrated", "It is recommended"

OUTPUT FORMAT — use exactly these section headings:
## Program Overview
## Group Dynamics and Engagement
## Key Learning Outcomes
## Individual Participation Patterns
## Recommendations
## Conclusion`;

export type GenerateFacilitatorReportResult =
  | { success: true; report: FacilitatorReport }
  | { success: false; error: string };

const GENERIC_AI_ERROR = "CapabilityOS was unable to draft a report right now. Please try again in a moment.";

export async function generateFacilitatorReport(experienceId: string): Promise<GenerateFacilitatorReportResult> {
  try {
    const session = await getSessionContext();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("generateFacilitatorReport: ANTHROPIC_API_KEY is not configured");
      return { success: false, error: GENERIC_AI_ERROR };
    }

    const context = await buildFacilitatorReportContext(experienceId);
    if (!context) {
      return { success: false, error: "Experience not found." };
    }

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: `${SYSTEM_PROMPT}\n\nCONTEXT (JSON — the only source of information about this program; never invent facts beyond it):\n${JSON.stringify(context)}`,
      messages: [{ role: "user", content: "Draft the facilitator report now." }],
    });

    const draftContent = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("\n")
      .trim();

    if (!draftContent) {
      return { success: false, error: GENERIC_AI_ERROR };
    }

    const facilitatorName = session.fullName ?? "Facilitator";
    const supabase = await createClient();
    const facilitatorId = await resolveFacilitatorId(supabase, session.email);

    const { data: existing, error: existingError } = await supabase
      .from("facilitator_reports")
      .select("id")
      .eq("experience_id", experienceId)
      .eq("facilitator_name", facilitatorName)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) {
      return { success: false, error: toActionError(existingError, "observations") };
    }

    // Regenerating only replaces draft_content — a facilitator's own edits
    // (edited_content) and the report's status must survive a "Regenerate"
    // click untouched, so this is a targeted update, not a blind upsert.
    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from("facilitator_reports")
        .update({ draft_content: draftContent, generated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select(
          "id, facilitator_name, draft_content, edited_content, status, generated_at, approved_at, exported_at"
        )
        .single();

      if (updateError || !updated) {
        return { success: false, error: toActionError(updateError, "observations") };
      }

      revalidatePath(`/dashboard/experiences`);
      return { success: true, report: toFacilitatorReport(updated) };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("facilitator_reports")
      .insert({
        organization_id: session.organizationId,
        workspace_id: session.workspaceId,
        experience_id: experienceId,
        facilitator_id: facilitatorId,
        facilitator_name: facilitatorName,
        draft_content: draftContent,
        status: "draft",
      })
      .select("id, facilitator_name, draft_content, edited_content, status, generated_at, approved_at, exported_at")
      .single();

    if (insertError || !inserted) {
      return { success: false, error: toActionError(insertError, "observations") };
    }

    return { success: true, report: toFacilitatorReport(inserted) };
  } catch (error) {
    console.error("generateFacilitatorReport failed", error);
    return { success: false, error: GENERIC_AI_ERROR };
  }
}

type FacilitatorReportRow = {
  id: string;
  facilitator_name: string;
  draft_content: string;
  edited_content: string | null;
  status: FacilitatorReport["status"];
  generated_at: string;
  approved_at: string | null;
  exported_at: string | null;
};

function toFacilitatorReport(row: FacilitatorReportRow): FacilitatorReport {
  return {
    id: row.id,
    facilitatorName: row.facilitator_name,
    draftContent: row.draft_content,
    editedContent: row.edited_content,
    status: row.status,
    generatedAt: row.generated_at,
    approvedAt: row.approved_at,
    exportedAt: row.exported_at,
  };
}

// ---------------------------------------------------------------------------
// Report editing / lifecycle
// ---------------------------------------------------------------------------

export type SaveReportEditResult = { success: true } | { success: false; error: string };

export async function saveReportEdit(reportId: string, editedContent: string): Promise<SaveReportEditResult> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("facilitator_reports")
    .select("status")
    .eq("id", reportId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: toActionError(fetchError, "observations") };
  }

  if (!existing) {
    return { success: false, error: "Report not found." };
  }

  const { error } = await supabase
    .from("facilitator_reports")
    .update({
      edited_content: editedContent,
      status: existing.status === "draft" ? "edited" : existing.status,
    })
    .eq("id", reportId);

  if (error) {
    return { success: false, error: toActionError(error, "observations") };
  }

  return { success: true };
}

export type ApproveReportResult = { success: true } | { success: false; error: string };

export async function approveReport(reportId: string): Promise<ApproveReportResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("facilitator_reports")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", reportId);

  if (error) {
    return { success: false, error: toActionError(error, "observations") };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// PDF export
// ---------------------------------------------------------------------------

export type ExportReportPdfResult = { success: true; url: string } | { success: false; error: string };

export async function exportReportPDF(reportId: string): Promise<ExportReportPdfResult> {
  const session = await getSessionContext();
  const supabase = await createClient();

  const { data: reportRow, error: reportError } = await supabase
    .from("facilitator_reports")
    .select("id, experience_id, facilitator_name, edited_content, draft_content, status")
    .eq("id", reportId)
    .maybeSingle();

  if (reportError) {
    return { success: false, error: toActionError(reportError, "observations") };
  }

  if (!reportRow) {
    return { success: false, error: "Report not found." };
  }

  if (reportRow.status !== "approved" && reportRow.status !== "exported") {
    return { success: false, error: "Approve the report before exporting it." };
  }

  const [experience, branding] = await Promise.all([
    getExperienceContextForReport(reportRow.experience_id),
    getReportBranding(session.workspaceId),
  ]);

  if (!experience) {
    return { success: false, error: "Experience not found." };
  }

  let logoBytes: Uint8Array | null = null;
  if (branding.logoPath) {
    try {
      logoBytes = await downloadReportLogo(branding.logoPath);
    } catch {
      logoBytes = null;
    }
  }

  try {
    const date = new Date().toISOString().slice(0, 10);
    const pdfBytes = await generateFacilitatorReportPdf({
      branding: {
        organizationName: branding.organizationName,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        website: branding.website,
        contactEmail: branding.contactEmail,
      },
      logoBytes,
      data: {
        experienceTitle: experience.title,
        clientName: experience.clientName,
        date,
        facilitatorName: reportRow.facilitator_name,
        contentHtml: reportRow.edited_content ?? reportRow.draft_content,
      },
    });

    const path = await uploadFacilitatorReportPdf(reportRow.experience_id, date, pdfBytes);
    const url = await getFacilitatorReportSignedUrl(path);

    const { error: updateError } = await supabase
      .from("facilitator_reports")
      .update({ status: "exported", exported_at: new Date().toISOString() })
      .eq("id", reportId);

    if (updateError) {
      return { success: false, error: toActionError(updateError, "observations") };
    }

    return { success: true, url };
  } catch (error) {
    return { success: false, error: toActionError(error, "observations", "Unable to export the report PDF.") };
  }
}
