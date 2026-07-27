"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PDFDocument } from "pdf-lib";

import { requireEnv } from "@/infrastructure/env";
import { getResendClient, getResendFromAddress } from "@/infrastructure/email/resend-client";
import { renderCertificateEmail } from "@/infrastructure/email/certificate-email";
import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";

import { getExperienceCertificates } from "./data";
import { generateCertificateFromUpload, generateCertificatePdf } from "./pdf";
import { toActionError } from "@/shared/errors/action-error";
import {
  certificateTemplateSchema,
  completionCriteriaSchema,
  fieldPlacementsSchema,
  uploadedTemplateBasicsSchema,
  CERTIFICATE_TEMPLATE_TYPES,
  type CertificateTemplateType,
  type CompletionCriteriaFormValues,
  type FieldPlacements,
} from "./schema";
import {
  downloadCertificatePdf,
  getTemplatePdfSignedUrl,
  uploadCertificatePdf,
  uploadTemplatePdf,
} from "./storage";

function resolveAppUrl(): { ok: true; url: string } | { ok: false; error: string } {
  try {
    return { ok: true, url: requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "") };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Missing configuration." };
  }
}

// ---------------------------------------------------------------------------
// Issue certificate
//
// Called two ways: directly from the dashboard (authenticated), and
// internally from the public check-in/survey Server Actions when a
// completion criterion has auto_issue on (see maybeAutoIssueCertificate
// below). The second call site has no user session and no RLS grant on
// certificate_templates/experience_completion_criteria at all (only
// certificates has an anon SELECT policy, and only for unrevoked rows) —
// so every read and write here goes through the service-role client
// rather than the usual cookie-bound one, and workspace_id is derived from
// the resolved template row rather than from session context.
// ---------------------------------------------------------------------------

export type IssueCertificateResult =
  | { success: true; certificateId: string; verificationCode: string }
  | { success: false; error: string };

async function resolveTemplate(
  supabase: ReturnType<typeof createServiceRoleClient>,
  certificateTemplateId: string | null
) {
  const select =
    "id, workspace_id, organization_name, primary_color, secondary_color, background_color, font_family, title_text, body_text, footer_text, signatory_name, signatory_title, template_type, uploaded_pdf_path, field_placements";

  if (certificateTemplateId) {
    return supabase.from("certificate_templates").select(select).eq("id", certificateTemplateId).maybeSingle();
  }

  return supabase.from("certificate_templates").select(select).eq("is_default", true).limit(1).maybeSingle();
}

export async function issueCertificate(participantId: string, experienceId: string): Promise<IssueCertificateResult> {
  const supabase = createServiceRoleClient();

  const [{ data: experience, error: experienceError }, { data: participant, error: participantError }] =
    await Promise.all([
      supabase.from("experiences").select("id, slug, title").eq("id", experienceId).maybeSingle(),
      supabase
        .from("participants")
        .select("id, first_name, last_name, email, checked_in")
        .eq("id", participantId)
        .maybeSingle(),
    ]);

  if (experienceError) {
    return { success: false, error: toActionError(experienceError, "certificates") };
  }
  if (!experience) {
    return { success: false, error: "Experience not found." };
  }
  if (participantError) {
    return { success: false, error: toActionError(participantError, "certificates") };
  }
  if (!participant) {
    return { success: false, error: "Participant not found." };
  }

  const [{ data: existingCertificate, error: existingError }, { data: tokenRow }, { data: criteriaRow }] =
    await Promise.all([
      supabase
        .from("certificates")
        .select("id")
        .eq("participant_id", participantId)
        .eq("experience_id", experienceId)
        .is("revoked_at", null)
        .maybeSingle(),
      supabase
        .from("survey_tokens")
        .select("completed_at")
        .eq("participant_id", participantId)
        .eq("workshop_id", experienceId)
        .eq("survey_type", "satisfaction")
        .maybeSingle(),
      supabase
        .from("experience_completion_criteria")
        .select("require_attendance, require_survey_completion, minimum_attendance_percentage, certificate_template_id")
        .eq("experience_id", experienceId)
        .maybeSingle(),
    ]);

  if (existingError) {
    return { success: false, error: toActionError(existingError, "certificates") };
  }
  if (existingCertificate) {
    return { success: false, error: "A certificate has already been issued for this participant." };
  }

  const criteria = criteriaRow ?? {
    require_attendance: true,
    require_survey_completion: false,
    minimum_attendance_percentage: 100,
    certificate_template_id: null,
  };

  const attendancePercentage = participant.checked_in ? 100 : 0;
  if (criteria.require_attendance && attendancePercentage < criteria.minimum_attendance_percentage) {
    return { success: false, error: "Participant does not meet the attendance requirement." };
  }
  if (criteria.require_survey_completion && !tokenRow?.completed_at) {
    return { success: false, error: "Participant has not completed the survey." };
  }

  const { data: template, error: templateError } = await resolveTemplate(supabase, criteria.certificate_template_id);

  if (templateError) {
    return { success: false, error: toActionError(templateError, "certificates") };
  }
  if (!template) {
    return { success: false, error: "No certificate template is configured. Set one up in Settings first." };
  }
  if (template.template_type === "uploaded" && !template.uploaded_pdf_path) {
    return { success: false, error: "This template has no uploaded PDF yet. Upload one in Settings first." };
  }

  const appUrl = resolveAppUrl();
  if (!appUrl.ok) {
    return { success: false, error: appUrl.error };
  }

  const participantName = `${participant.first_name} ${participant.last_name}`.trim();
  const completionDate = new Date().toISOString().slice(0, 10);

  const { data: inserted, error: insertError } = await supabase
    .from("certificates")
    .insert({
      workspace_id: template.workspace_id,
      participant_id: participantId,
      experience_id: experienceId,
      template_id: template.id,
      participant_name: participantName,
      experience_title: experience.title,
      organization_name: template.organization_name,
      completion_date: completionDate,
      email_address: participant.email,
    })
    .select("id, verification_code")
    .single();

  if (insertError || !inserted) {
    return { success: false, error: toActionError(insertError, "certificates", "Unable to create certificate record.") };
  }

  try {
    const pdfBytes =
      template.template_type === "uploaded"
        ? await generateCertificateFromUpload({
            // Non-null: the "uploaded" + missing-path combination already
            // returned early above, before the certificate row was even
            // inserted.
            uploadedPdfPath: template.uploaded_pdf_path!,
            fieldPlacements: template.field_placements,
            participantName,
            experienceTitle: experience.title,
            organizationName: template.organization_name,
            completionDate,
            verificationCode: inserted.verification_code,
          })
        : await generateCertificatePdf({
            organizationName: template.organization_name,
            primaryColor: template.primary_color,
            secondaryColor: template.secondary_color,
            backgroundColor: template.background_color,
            fontFamily: template.font_family,
            titleText: template.title_text,
            bodyText: template.body_text,
            footerText: template.footer_text,
            signatoryName: template.signatory_name,
            signatoryTitle: template.signatory_title,
            participantName,
            experienceTitle: experience.title,
            completionDate,
            verificationUrl: `${appUrl.url}/verify/${inserted.verification_code}`,
          });

    await uploadCertificatePdf(inserted.verification_code, pdfBytes);
  } catch (error) {
    // No PDF behind the row would leave a dead "Issued" state and, worse,
    // block a retry (the partial unique index only allows one live
    // certificate per participant/experience) — so roll the insert back.
    await supabase.from("certificates").delete().eq("id", inserted.id);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to generate certificate PDF.",
    };
  }

  revalidatePath(`/dashboard/experiences/${experience.slug}`);

  return { success: true, certificateId: inserted.id, verificationCode: inserted.verification_code };
}

export type IssueAllEligibleResult =
  | { success: true; issued: number; skipped: number; failed: number; errors: string[] }
  | { success: false; error: string };

export async function issueAllEligible(experienceId: string): Promise<IssueAllEligibleResult> {
  const rows = await getExperienceCertificates(experienceId);
  const targets = rows.filter((row) => row.eligible && !row.certificate);

  let issued = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of targets) {
    const result = await issueCertificate(row.participantId, experienceId);
    if (result.success) {
      issued += 1;
    } else {
      failed += 1;
      errors.push(`${row.fullName}: ${result.error}`);
    }
  }

  return { success: true, issued, skipped: rows.length - targets.length, failed, errors };
}

/**
 * Best-effort auto-issue, called from checkInParticipant and
 * submitSurveyResponse when their eligibility-affecting field changes.
 * Never throws — a certificate hiccup must not break check-in or survey
 * submission, so every failure is swallowed after a console.error.
 */
export async function maybeAutoIssueCertificate(participantId: string, experienceId: string): Promise<void> {
  try {
    const supabase = createServiceRoleClient();

    const { data: criteria } = await supabase
      .from("experience_completion_criteria")
      .select("auto_issue")
      .eq("experience_id", experienceId)
      .maybeSingle();

    if (!criteria?.auto_issue) {
      return;
    }

    const result = await issueCertificate(participantId, experienceId);

    if (result.success) {
      await emailCertificate(result.certificateId);
    }
  } catch (error) {
    console.error("Auto-issue certificate failed", { participantId, experienceId, error });
  }
}

// ---------------------------------------------------------------------------
// Email certificate
// ---------------------------------------------------------------------------

export type EmailCertificateResult = { success: true } | { success: false; error: string };

/**
 * Uses the service-role client, not the cookie-bound one: this is called
 * both from the authenticated dashboard and, via maybeAutoIssueCertificate,
 * from the anonymous public check-in/survey flows. It happened to also work
 * under the session-bound client because of the "Public can verify
 * certificates" anon SELECT policy (unrevoked rows only) — but relying on
 * that incidental grant for a write-adjacent action is fragile, so this
 * matches issueCertificate's explicit service-role usage instead.
 */
export async function emailCertificate(certificateId: string): Promise<EmailCertificateResult> {
  const supabase = createServiceRoleClient();

  const { data: certificate, error } = await supabase
    .from("certificates")
    .select("participant_name, experience_title, experience_id, verification_code, email_address, revoked_at")
    .eq("id", certificateId)
    .maybeSingle();

  if (error) {
    return { success: false, error: toActionError(error, "certificates") };
  }
  if (!certificate) {
    return { success: false, error: "Certificate not found." };
  }
  if (certificate.revoked_at) {
    return { success: false, error: "This certificate has been revoked." };
  }

  const appUrl = resolveAppUrl();
  if (!appUrl.ok) {
    return { success: false, error: appUrl.error };
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await downloadCertificatePdf(certificate.verification_code);
  } catch (downloadError) {
    return {
      success: false,
      error: downloadError instanceof Error ? downloadError.message : "Unable to fetch certificate PDF.",
    };
  }

  const verificationUrl = `${appUrl.url}/verify/${certificate.verification_code}`;
  const { subject, html } = renderCertificateEmail({
    participantName: certificate.participant_name,
    experienceTitle: certificate.experience_title,
    verificationUrl,
  });

  try {
    const resend = getResendClient();
    const { error: sendError } = await resend.emails.send({
      from: getResendFromAddress(),
      to: certificate.email_address,
      subject,
      html,
      attachments: [
        {
          filename: `${certificate.experience_title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-certificate.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    if (sendError) {
      return { success: false, error: toActionError(sendError, "certificates") };
    }
  } catch (sendError) {
    return {
      success: false,
      error: sendError instanceof Error ? sendError.message : "Unable to send certificate email.",
    };
  }

  const { error: updateError } = await supabase
    .from("certificates")
    .update({ emailed_at: new Date().toISOString() })
    .eq("id", certificateId);

  if (updateError) {
    return { success: false, error: toActionError(updateError, "certificates") };
  }

  const { data: experienceRow } = await supabase
    .from("experiences")
    .select("slug")
    .eq("id", certificate.experience_id)
    .maybeSingle();

  if (experienceRow) {
    revalidatePath(`/dashboard/experiences/${experienceRow.slug}`);
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Revoke certificate
// ---------------------------------------------------------------------------

export type RevokeCertificateResult = { success: true } | { success: false; error: string };

export async function revokeCertificate(certificateId: string, reason: string): Promise<RevokeCertificateResult> {
  const supabase = await createClient();

  const { data: certificate, error: fetchError } = await supabase
    .from("certificates")
    .select("experience_id")
    .eq("id", certificateId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: toActionError(fetchError, "certificates") };
  }
  if (!certificate) {
    return { success: false, error: "Certificate not found." };
  }

  const { error } = await supabase
    .from("certificates")
    .update({ revoked_at: new Date().toISOString(), revocation_reason: reason.trim() || null })
    .eq("id", certificateId);

  if (error) {
    return { success: false, error: toActionError(error, "certificates") };
  }

  const { data: experienceRow } = await supabase
    .from("experiences")
    .select("slug")
    .eq("id", certificate.experience_id)
    .maybeSingle();

  if (experienceRow) {
    revalidatePath(`/dashboard/experiences/${experienceRow.slug}`);
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Completion criteria
// ---------------------------------------------------------------------------

export type SaveCompletionCriteriaResult = { success: true } | { success: false; error: string };

export async function saveCompletionCriteria(
  experienceId: string,
  values: CompletionCriteriaFormValues
): Promise<SaveCompletionCriteriaResult> {
  const parsed = completionCriteriaSchema.safeParse(values);

  if (!parsed.success) {
    return { success: false, error: "Please correct the highlighted fields." };
  }

  const supabase = await createClient();

  const { data: experience, error: experienceError } = await supabase
    .from("experiences")
    .select("slug")
    .eq("id", experienceId)
    .maybeSingle();

  if (experienceError) {
    return { success: false, error: toActionError(experienceError, "certificates") };
  }
  if (!experience) {
    return { success: false, error: "Experience not found." };
  }

  const { error } = await supabase.from("experience_completion_criteria").upsert(
    {
      experience_id: experienceId,
      require_attendance: parsed.data.requireAttendance,
      require_survey_completion: parsed.data.requireSurveyCompletion,
      minimum_attendance_percentage: parsed.data.minimumAttendancePercentage,
      certificate_template_id: parsed.data.certificateTemplateId ?? null,
      auto_issue: parsed.data.autoIssue,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "experience_id" }
  );

  if (error) {
    return { success: false, error: toActionError(error, "certificates") };
  }

  revalidatePath(`/dashboard/experiences/${experience.slug}`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Certificate templates
// ---------------------------------------------------------------------------

export type SaveTemplateResult =
  | { success: true; templateId: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

function parseTemplateForm(formData: FormData) {
  return certificateTemplateSchema.safeParse({
    name: formData.get("name"),
    organizationName: formData.get("organizationName"),
    organizationLogoUrl: formData.get("organizationLogoUrl"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    backgroundColor: formData.get("backgroundColor"),
    fontFamily: formData.get("fontFamily"),
    titleText: formData.get("titleText"),
    bodyText: formData.get("bodyText"),
    footerText: formData.get("footerText"),
    signatoryName: formData.get("signatoryName"),
    signatoryTitle: formData.get("signatoryTitle"),
  });
}

export async function createCertificateTemplate(
  workspaceId: string,
  _prevState: SaveTemplateResult | null,
  formData: FormData
): Promise<SaveTemplateResult> {
  const parsed = parseTemplateForm(formData);

  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("certificate_templates")
    .insert({
      workspace_id: workspaceId,
      name: parsed.data.name,
      organization_name: parsed.data.organizationName,
      organization_logo_url: parsed.data.organizationLogoUrl ?? null,
      primary_color: parsed.data.primaryColor,
      secondary_color: parsed.data.secondaryColor,
      background_color: parsed.data.backgroundColor,
      font_family: parsed.data.fontFamily,
      title_text: parsed.data.titleText,
      body_text: parsed.data.bodyText,
      footer_text: parsed.data.footerText ?? null,
      signatory_name: parsed.data.signatoryName ?? null,
      signatory_title: parsed.data.signatoryTitle ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: toActionError(error, "certificates", "Unable to create template.") };
  }

  revalidatePath("/dashboard/settings/certificates");
  redirect("/dashboard/settings/certificates");
}

export async function updateCertificateTemplate(
  templateId: string,
  _prevState: SaveTemplateResult | null,
  formData: FormData
): Promise<SaveTemplateResult> {
  const parsed = parseTemplateForm(formData);

  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("certificate_templates")
    .update({
      name: parsed.data.name,
      organization_name: parsed.data.organizationName,
      organization_logo_url: parsed.data.organizationLogoUrl ?? null,
      primary_color: parsed.data.primaryColor,
      secondary_color: parsed.data.secondaryColor,
      background_color: parsed.data.backgroundColor,
      font_family: parsed.data.fontFamily,
      title_text: parsed.data.titleText,
      body_text: parsed.data.bodyText,
      footer_text: parsed.data.footerText ?? null,
      signatory_name: parsed.data.signatoryName ?? null,
      signatory_title: parsed.data.signatoryTitle ?? null,
    })
    .eq("id", templateId);

  if (error) {
    return { success: false, error: toActionError(error, "certificates") };
  }

  revalidatePath("/dashboard/settings/certificates");
  redirect("/dashboard/settings/certificates");
}

export type SetDefaultTemplateResult = { success: true } | { success: false; error: string };

export async function setDefaultTemplate(templateId: string, workspaceId: string): Promise<SetDefaultTemplateResult> {
  const supabase = await createClient();

  const { error: clearError } = await supabase
    .from("certificate_templates")
    .update({ is_default: false })
    .eq("workspace_id", workspaceId)
    .neq("id", templateId);

  if (clearError) {
    return { success: false, error: toActionError(clearError, "certificates") };
  }

  const { error } = await supabase.from("certificate_templates").update({ is_default: true }).eq("id", templateId);

  if (error) {
    return { success: false, error: toActionError(error, "certificates") };
  }

  revalidatePath("/dashboard/settings/certificates");

  return { success: true };
}

// ---------------------------------------------------------------------------
// Template preview — generates a sample PDF with placeholder data
// ---------------------------------------------------------------------------

export type PreviewTemplateResult = { success: true; base64: string } | { success: false; error: string };

export async function previewCertificateTemplate(templateId: string): Promise<PreviewTemplateResult> {
  const supabase = await createClient();

  const { data: template, error } = await supabase
    .from("certificate_templates")
    .select(
      "organization_name, primary_color, secondary_color, background_color, font_family, title_text, body_text, footer_text, signatory_name, signatory_title, template_type, uploaded_pdf_path, field_placements"
    )
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    return { success: false, error: toActionError(error, "certificates") };
  }
  if (!template) {
    return { success: false, error: "Template not found." };
  }

  const appUrl = resolveAppUrl();
  if (!appUrl.ok) {
    return { success: false, error: appUrl.error };
  }

  const sampleDate = new Date().toISOString().slice(0, 10);

  if (template.template_type === "uploaded") {
    if (!template.uploaded_pdf_path) {
      return { success: false, error: "Upload a PDF for this template before previewing it." };
    }

    const pdfBytes = await generateCertificateFromUpload({
      uploadedPdfPath: template.uploaded_pdf_path,
      fieldPlacements: template.field_placements,
      participantName: "Sample Participant",
      experienceTitle: "Sample Experience Title",
      organizationName: template.organization_name,
      completionDate: sampleDate,
      verificationCode: "PREVIEW-SAMPLE",
    });

    return { success: true, base64: Buffer.from(pdfBytes).toString("base64") };
  }

  const pdfBytes = await generateCertificatePdf({
    organizationName: template.organization_name,
    primaryColor: template.primary_color,
    secondaryColor: template.secondary_color,
    backgroundColor: template.background_color,
    fontFamily: template.font_family,
    titleText: template.title_text,
    bodyText: template.body_text,
    footerText: template.footer_text,
    signatoryName: template.signatory_name,
    signatoryTitle: template.signatory_title,
    participantName: "Jordan Sample",
    experienceTitle: "Sample Experience Title",
    completionDate: sampleDate,
    verificationUrl: `${appUrl.url}/verify/PREVIEW-SAMPLE`,
  });

  return { success: true, base64: Buffer.from(pdfBytes).toString("base64") };
}

// ---------------------------------------------------------------------------
// Uploaded template configuration (Sprint 18)
// ---------------------------------------------------------------------------

export type SetTemplateTypeResult = { success: true } | { success: false; error: string };

export async function setCertificateTemplateType(
  templateId: string,
  templateType: CertificateTemplateType
): Promise<SetTemplateTypeResult> {
  if (!CERTIFICATE_TEMPLATE_TYPES.includes(templateType)) {
    return { success: false, error: "Invalid template type." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("certificate_templates")
    .update({ template_type: templateType })
    .eq("id", templateId);

  if (error) {
    return { success: false, error: toActionError(error, "certificates") };
  }

  revalidatePath(`/dashboard/settings/certificates/${templateId}/edit`);

  return { success: true };
}

export type SaveUploadedBasicsResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * The "uploaded" mode's name/organization form — kept separate from
 * updateCertificateTemplate (which requires the full generated-layout
 * field set: colors, fonts, title/body text) rather than making those
 * fields optional there just to accommodate a mode that doesn't use them.
 */
export async function updateUploadedTemplateBasics(
  templateId: string,
  _prevState: SaveUploadedBasicsResult | null,
  formData: FormData
): Promise<SaveUploadedBasicsResult> {
  const parsed = uploadedTemplateBasicsSchema.safeParse({
    name: formData.get("name"),
    organizationName: formData.get("organizationName"),
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
    .from("certificate_templates")
    .update({ name: parsed.data.name, organization_name: parsed.data.organizationName })
    .eq("id", templateId);

  if (error) {
    return { success: false, error: toActionError(error, "certificates") };
  }

  revalidatePath(`/dashboard/settings/certificates/${templateId}/edit`);
  revalidatePath("/dashboard/settings/certificates");

  return { success: true };
}

export type UploadTemplatePdfResult =
  | { success: true; path: string; pageWidthPts: number; pageHeightPts: number }
  | { success: false; error: string };

const MAX_TEMPLATE_PDF_BYTES = 10 * 1024 * 1024;

export async function uploadCertificateTemplatePdf(
  templateId: string,
  workspaceId: string,
  formData: FormData
): Promise<UploadTemplatePdfResult> {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { success: false, error: "No file was provided." };
  }
  if (file.type !== "application/pdf") {
    return { success: false, error: "Only PDF files are supported." };
  }
  if (file.size > MAX_TEMPLATE_PDF_BYTES) {
    return { success: false, error: "File must be under 10MB." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let pageWidthPts = 842;
  let pageHeightPts = 595;
  try {
    const pdfDoc = await PDFDocument.load(bytes);
    const page = pdfDoc.getPages()[0];
    if (!page) {
      return { success: false, error: "This PDF has no pages." };
    }
    const size = page.getSize();
    pageWidthPts = Math.round(size.width);
    pageHeightPts = Math.round(size.height);
  } catch {
    return { success: false, error: "Unable to read this file as a PDF." };
  }

  let path: string;
  try {
    path = await uploadTemplatePdf(workspaceId, bytes);
  } catch (uploadError) {
    return {
      success: false,
      error: uploadError instanceof Error ? uploadError.message : "Unable to upload the PDF.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("certificate_templates")
    .update({
      uploaded_pdf_path: path,
      template_type: "uploaded",
      page_width_pts: pageWidthPts,
      page_height_pts: pageHeightPts,
    })
    .eq("id", templateId);

  if (error) {
    return { success: false, error: toActionError(error, "certificates") };
  }

  revalidatePath(`/dashboard/settings/certificates/${templateId}/edit`);

  return { success: true, path, pageWidthPts, pageHeightPts };
}

export type GetTemplatePreviewUrlResult =
  | { success: true; url: string; pageWidthPts: number; pageHeightPts: number }
  | { success: false; error: string };

/**
 * Thin Server Action wrapper — the client-side pdf.js preview (loaded from
 * CDN, see features/certificates/lib/pdfjs-loader.ts) needs an actual URL
 * to fetch, not a Buffer, and the private bucket means that has to be a
 * signed URL minted server-side rather than a public one.
 */
export async function getUploadedTemplatePreviewUrl(templateId: string): Promise<GetTemplatePreviewUrlResult> {
  const supabase = await createClient();

  const { data: template, error } = await supabase
    .from("certificate_templates")
    .select("uploaded_pdf_path, page_width_pts, page_height_pts")
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    return { success: false, error: toActionError(error, "certificates") };
  }
  if (!template?.uploaded_pdf_path) {
    return { success: false, error: "No PDF has been uploaded for this template yet." };
  }

  try {
    const url = await getTemplatePdfSignedUrl(template.uploaded_pdf_path);
    return { success: true, url, pageWidthPts: template.page_width_pts, pageHeightPts: template.page_height_pts };
  } catch (signError) {
    return {
      success: false,
      error: signError instanceof Error ? signError.message : "Unable to generate a preview link.",
    };
  }
}

export type UpdateFieldPlacementsResult = { success: true } | { success: false; error: string };

export async function updateFieldPlacements(
  templateId: string,
  fieldPlacements: FieldPlacements
): Promise<UpdateFieldPlacementsResult> {
  const parsed = fieldPlacementsSchema.safeParse(fieldPlacements);

  if (!parsed.success) {
    return { success: false, error: "Invalid field placement data." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("certificate_templates")
    .update({ field_placements: parsed.data })
    .eq("id", templateId);

  if (error) {
    return { success: false, error: toActionError(error, "certificates") };
  }

  revalidatePath(`/dashboard/settings/certificates/${templateId}/edit`);

  return { success: true };
}
