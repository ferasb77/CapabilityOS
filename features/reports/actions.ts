"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/infrastructure/supabase/server";
import { getSessionContext } from "@/infrastructure/session/session-context";
import { toActionError } from "@/shared/errors/action-error";

import { reportBrandingSchema, REPORT_LOGO_ALLOWED_TYPES, REPORT_LOGO_MAX_BYTES } from "./schema";
import { getReportBranding, getSatisfactionReportData } from "./data";
import { generateReportPreviewPdf, generateSatisfactionReportPdf, type ReportBrandingInput } from "./report";
import { downloadReportLogo, uploadReportLogo } from "./storage";

function validateLogoFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!REPORT_LOGO_ALLOWED_TYPES.includes(file.type as (typeof REPORT_LOGO_ALLOWED_TYPES)[number])) {
    return { ok: false, error: "Logo must be a PNG or JPG image." };
  }
  if (file.size > REPORT_LOGO_MAX_BYTES) {
    return { ok: false, error: "Logo must be under 2MB." };
  }
  return { ok: true };
}

function parseBrandingFields(formData: FormData) {
  return reportBrandingSchema.safeParse({
    organizationName: formData.get("organizationName"),
    organizationTagline: formData.get("organizationTagline"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    accentColor: formData.get("accentColor"),
    footerText: formData.get("footerText"),
    website: formData.get("website"),
    contactEmail: formData.get("contactEmail"),
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "experience";
}

// ---------------------------------------------------------------------------
// Save branding settings
// ---------------------------------------------------------------------------

export type SaveReportBrandingResult =
  | { success: true }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function saveReportBranding(
  workspaceId: string,
  _prevState: SaveReportBrandingResult | null,
  formData: FormData
): Promise<SaveReportBrandingResult> {
  const parsed = parseBrandingFields(formData);

  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  let uploadedLogoPath: string | null = null;
  const logoFile = formData.get("logo");

  if (logoFile instanceof File && logoFile.size > 0) {
    const validation = validateLogoFile(logoFile);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    try {
      const bytes = new Uint8Array(await logoFile.arrayBuffer());
      uploadedLogoPath = await uploadReportLogo(workspaceId, bytes, logoFile.type);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Unable to upload logo." };
    }
  }

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("report_branding")
    .select("logo_path")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: toActionError(existingError, "reports") };
  }

  const { error } = await supabase.from("report_branding").upsert(
    {
      workspace_id: workspaceId,
      organization_name: parsed.data.organizationName,
      organization_tagline: parsed.data.organizationTagline ?? null,
      logo_path: uploadedLogoPath ?? existing?.logo_path ?? null,
      primary_color: parsed.data.primaryColor,
      secondary_color: parsed.data.secondaryColor,
      accent_color: parsed.data.accentColor,
      footer_text: parsed.data.footerText ?? null,
      website: parsed.data.website ?? null,
      contact_email: parsed.data.contactEmail ?? null,
    },
    { onConflict: "workspace_id" }
  );

  if (error) {
    return { success: false, error: toActionError(error, "reports") };
  }

  revalidatePath("/dashboard/settings/reports");

  return { success: true };
}

// ---------------------------------------------------------------------------
// Branding preview — a single cover page rendered from whatever the form
// currently holds (saved or not), so an operator can see color/logo/copy
// changes before committing to Save.
// ---------------------------------------------------------------------------

export type PreviewReportBrandingResult = { success: true; base64: string } | { success: false; error: string };

export async function previewReportBranding(formData: FormData): Promise<PreviewReportBrandingResult> {
  const parsed = parseBrandingFields(formData);

  if (!parsed.success) {
    return { success: false, error: "Please correct the highlighted fields before previewing." };
  }

  let logoBytes: Uint8Array | null = null;
  const logoFile = formData.get("logo");
  const existingLogoPath = formData.get("existingLogoPath");

  if (logoFile instanceof File && logoFile.size > 0) {
    const validation = validateLogoFile(logoFile);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }
    logoBytes = new Uint8Array(await logoFile.arrayBuffer());
  } else if (typeof existingLogoPath === "string" && existingLogoPath) {
    try {
      logoBytes = await downloadReportLogo(existingLogoPath);
    } catch {
      logoBytes = null;
    }
  }

  const branding: ReportBrandingInput = {
    organizationName: parsed.data.organizationName,
    organizationTagline: parsed.data.organizationTagline ?? null,
    primaryColor: parsed.data.primaryColor,
    secondaryColor: parsed.data.secondaryColor,
    accentColor: parsed.data.accentColor,
    footerText: parsed.data.footerText ?? null,
    website: parsed.data.website ?? null,
    contactEmail: parsed.data.contactEmail ?? null,
  };

  try {
    const pdfBytes = await generateReportPreviewPdf(branding, logoBytes);
    return { success: true, base64: Buffer.from(pdfBytes).toString("base64") };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to generate preview." };
  }
}

// ---------------------------------------------------------------------------
// Full satisfaction report generation — the "Download Report" action on an
// experience's Surveys tab.
// ---------------------------------------------------------------------------

export type GenerateSatisfactionReportResult =
  | { success: true; base64: string; filename: string }
  | { success: false; error: string };

export async function generateSatisfactionReport(experienceId: string): Promise<GenerateSatisfactionReportResult> {
  const session = await getSessionContext();

  const [branding, reportData] = await Promise.all([
    getReportBranding(session.workspaceId),
    getSatisfactionReportData(experienceId),
  ]);

  if (!reportData) {
    return { success: false, error: "Experience not found." };
  }

  // A missing or corrupt logo file must never block report generation —
  // the report just renders without one, same reasoning as the Cairo font
  // fallback in features/certificates/pdf.ts.
  let logoBytes: Uint8Array | null = null;
  if (branding.logoPath) {
    try {
      logoBytes = await downloadReportLogo(branding.logoPath);
    } catch {
      logoBytes = null;
    }
  }

  try {
    const pdfBytes = await generateSatisfactionReportPdf({
      branding: {
        organizationName: branding.organizationName,
        organizationTagline: branding.organizationTagline,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        footerText: branding.footerText,
        website: branding.website,
        contactEmail: branding.contactEmail,
      },
      logoBytes,
      data: reportData,
    });

    return {
      success: true,
      base64: Buffer.from(pdfBytes).toString("base64"),
      filename: `${slugify(reportData.experienceTitle)}-satisfaction-report.pdf`,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to generate report." };
  }
}
