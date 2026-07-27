"use server";

import { revalidatePath } from "next/cache";

import { requireEnv } from "@/infrastructure/env";
import { getResendClient, getResendFromAddress } from "@/infrastructure/email/resend-client";
import { renderMaterialsLinkEmail, renderMaterialsReadyEmail } from "@/infrastructure/email/materials-email";
import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";
import { getSessionContext } from "@/infrastructure/session/session-context";

import { MAX_MATERIAL_FILE_BYTES, materialFormSchema } from "./schema";
import { getFacilitatorMaterialSignedUrl, uploadMaterialFile } from "./storage";
import { toActionError } from "@/shared/errors/action-error";

type SupabaseServiceClient = ReturnType<typeof createServiceRoleClient>;

function resolveAppUrl(): { ok: true; url: string } | { ok: false; error: string } {
  try {
    return { ok: true, url: requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "") };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Missing configuration." };
  }
}

// ---------------------------------------------------------------------------
// Material token minting — uses the service-role client throughout, not the
// cookie-bound one. This token is a bearer credential for the fully public
// /materials/[token] portal ("treat it like a password" per the sprint's
// own architecture rule), and unlike experience_materials there is no anon
// RLS grant on participant_material_tokens at all (see migration 0018's
// header comment) — by design, not oversight. A find-or-create for a
// security-sensitive token belongs on an elevated, deliberately narrow code
// path rather than depending on RLS being exactly right for whichever
// context (anonymous check-in vs. authenticated dashboard) happens to call
// it.
// ---------------------------------------------------------------------------

async function createOrGetMaterialTokenInternal(
  supabase: SupabaseServiceClient,
  participantId: string,
  experienceId: string
): Promise<string | null> {
  const { data: existing, error: findError } = await supabase
    .from("participant_material_tokens")
    .select("token")
    .eq("participant_id", participantId)
    .eq("experience_id", experienceId)
    .maybeSingle();

  if (findError) {
    return null;
  }

  if (existing) {
    return existing.token;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("participant_material_tokens")
    .insert({ participant_id: participantId, experience_id: experienceId })
    .select("token")
    .single();

  if (insertError || !inserted) {
    return null;
  }

  return inserted.token;
}

/**
 * Idempotent: returns the participant's existing token if one exists,
 * otherwise mints one. Cheap (a single find-or-insert, no external I/O),
 * so callers that need the token value immediately (e.g. the check-in
 * success screen's materials link) can safely await it rather than firing
 * it and forgetting.
 */
export async function createOrGetMaterialToken(participantId: string, experienceId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  return createOrGetMaterialTokenInternal(supabase, participantId, experienceId);
}

// ---------------------------------------------------------------------------
// Materials-ready / materials-link emails — shared per-participant sender,
// mirroring ensureTokenAndSend from features/surveys/actions.ts.
// ---------------------------------------------------------------------------

type ExperienceEmailContext = { id: string; title: string };
type ParticipantEmailContext = { id: string; first_name: string; email: string };

async function sendMaterialsEmailToParticipant(
  supabase: SupabaseServiceClient,
  participant: ParticipantEmailContext,
  experience: ExperienceEmailContext,
  appUrl: string,
  variant: "ready" | "link"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = await createOrGetMaterialTokenInternal(supabase, participant.id, experience.id);

  if (!token) {
    return { ok: false, error: "Unable to create a materials token." };
  }

  const materialsUrl = `${appUrl}/materials/${token}`;
  const render = variant === "ready" ? renderMaterialsReadyEmail : renderMaterialsLinkEmail;
  const { subject, html } = render({
    participantFirstName: participant.first_name,
    experienceTitle: experience.title,
    materialsUrl,
  });

  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: getResendFromAddress(),
      to: participant.email,
      subject,
      html,
    });

    if (error) {
      return { ok: false, error: toActionError(error, "materials") };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to send email." };
  }

  return { ok: true };
}

/** Emails every participant of an experience their materials link. Errors are swallowed per-participant — one bad address must not stop the rest. */
async function notifyAllParticipants(experienceId: string, variant: "ready" | "link"): Promise<void> {
  const appUrl = resolveAppUrl();
  if (!appUrl.ok) {
    console.error("Materials email skipped: missing app URL configuration");
    return;
  }

  const supabase = createServiceRoleClient();

  const { data: experience } = await supabase.from("experiences").select("id, title, slug").eq("id", experienceId).maybeSingle();
  if (!experience) {
    return;
  }

  const { data: participants } = await supabase
    .from("participants")
    .select("id, first_name, email")
    .eq("workshop_slug", experience.slug);

  for (const participant of participants ?? []) {
    const result = await sendMaterialsEmailToParticipant(supabase, participant, experience, appUrl.url, variant);
    if (!result.ok) {
      console.error("Materials email failed for participant", { participantId: participant.id, error: result.error });
    }
  }
}

export type SendMaterialsLinkResult = { success: true; sent: number } | { success: false; error: string };

/**
 * "Send Materials Link to All" — an explicit operator action, distinct
 * from releaseMaterial's automatic notification.
 */
export async function sendMaterialsLink(experienceId: string, experienceSlug: string): Promise<SendMaterialsLinkResult> {
  const appUrl = resolveAppUrl();
  if (!appUrl.ok) {
    return { success: false, error: appUrl.error };
  }

  const supabase = createServiceRoleClient();

  const { data: experience, error: experienceError } = await supabase
    .from("experiences")
    .select("id, title, slug")
    .eq("id", experienceId)
    .maybeSingle();

  if (experienceError) {
    return { success: false, error: toActionError(experienceError, "materials") };
  }
  if (!experience) {
    return { success: false, error: "Experience not found." };
  }

  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id, first_name, email")
    .eq("workshop_slug", experience.slug);

  if (participantsError) {
    return { success: false, error: toActionError(participantsError, "materials") };
  }

  let sent = 0;
  for (const participant of participants ?? []) {
    const result = await sendMaterialsEmailToParticipant(supabase, participant, experience, appUrl.url, "link");
    if (result.ok) {
      sent += 1;
    }
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  return { success: true, sent };
}

// ---------------------------------------------------------------------------
// Material CRUD — operator (and facilitator-portal) side, all through the
// cookie-bound client under the "Authenticated users can manage materials"
// RLS policy.
// ---------------------------------------------------------------------------

export type SaveMaterialResult = { success: true; materialId: string } | { success: false; error: string };

type MaterialFormInput = {
  title: FormDataEntryValue | null;
  description: FormDataEntryValue | null;
  materialType: FormDataEntryValue | null;
  url: FormDataEntryValue | null;
  audience: FormDataEntryValue | null;
  availableFrom: FormDataEntryValue | null;
};

function readMaterialForm(formData: FormData): MaterialFormInput {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    materialType: formData.get("materialType"),
    url: formData.get("url"),
    audience: formData.get("audience"),
    availableFrom: formData.get("availableFrom"),
  };
}

export async function addMaterial(
  experienceId: string,
  experienceSlug: string,
  workspaceId: string,
  formData: FormData
): Promise<SaveMaterialResult> {
  const parsed = materialFormSchema.safeParse(readMaterialForm(formData));

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the fields." };
  }

  const data = parsed.data;
  const supabase = await createClient();

  let filePath: string | null = null;
  let fileName: string | null = null;
  let fileSizeBytes: number | null = null;
  let mimeType: string | null = null;

  if (data.materialType === "file") {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Please choose a file to upload." };
    }
    if (file.size > MAX_MATERIAL_FILE_BYTES) {
      return { success: false, error: "File must be under 50MB." };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      filePath = await uploadMaterialFile(
        experienceId,
        file.name,
        bytes,
        file.type || "application/octet-stream",
        data.audience === "facilitator"
      );
    } catch (uploadError) {
      return { success: false, error: uploadError instanceof Error ? uploadError.message : "Unable to upload the file." };
    }

    fileName = file.name;
    fileSizeBytes = file.size;
    mimeType = file.type || null;
  }

  const { data: lastRow, error: lastRowError } = await supabase
    .from("experience_materials")
    .select("order_index")
    .eq("experience_id", experienceId)
    .is("deleted_at", null)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRowError) {
    return { success: false, error: toActionError(lastRowError, "materials") };
  }

  const nextOrderIndex = (lastRow?.order_index ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("experience_materials")
    .insert({
      experience_id: experienceId,
      workspace_id: workspaceId,
      title: data.title,
      description: data.description ?? null,
      material_type: data.materialType,
      file_path: filePath,
      file_name: fileName,
      file_size_bytes: fileSizeBytes,
      mime_type: mimeType,
      url: data.materialType === "link" ? data.url : null,
      audience: data.audience,
      available_from: data.availableFrom,
      is_released: data.availableFrom !== "manual",
      order_index: nextOrderIndex,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: toActionError(error, "materials", "Unable to add material.") };
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  return { success: true, materialId: inserted.id };
}

export async function updateMaterial(
  materialId: string,
  experienceId: string,
  experienceSlug: string,
  formData: FormData
): Promise<SaveMaterialResult> {
  const parsed = materialFormSchema.safeParse(readMaterialForm(formData));

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the fields." };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const updatePayload: Record<string, unknown> = {
    title: data.title,
    description: data.description ?? null,
    material_type: data.materialType,
    audience: data.audience,
    available_from: data.availableFrom,
    url: data.materialType === "link" ? data.url : null,
  };

  if (data.materialType === "file") {
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_MATERIAL_FILE_BYTES) {
        return { success: false, error: "File must be under 50MB." };
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      try {
        const path = await uploadMaterialFile(
          experienceId,
          file.name,
          bytes,
          file.type || "application/octet-stream",
          data.audience === "facilitator"
        );
        updatePayload.file_path = path;
        updatePayload.file_name = file.name;
        updatePayload.file_size_bytes = file.size;
        updatePayload.mime_type = file.type || null;
      } catch (uploadError) {
        return { success: false, error: uploadError instanceof Error ? uploadError.message : "Unable to upload the file." };
      }
    }
    // No new file selected — keep the existing file_path/file_name/etc.
  } else {
    updatePayload.file_path = null;
    updatePayload.file_name = null;
    updatePayload.file_size_bytes = null;
    updatePayload.mime_type = null;
  }

  const { error } = await supabase.from("experience_materials").update(updatePayload).eq("id", materialId);

  if (error) {
    return { success: false, error: toActionError(error, "materials") };
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  return { success: true, materialId };
}

export type DeleteMaterialResult = { success: true } | { success: false; error: string };

export async function deleteMaterial(materialId: string, experienceSlug: string): Promise<DeleteMaterialResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("experience_materials")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", materialId);

  if (error) {
    return { success: false, error: toActionError(error, "materials") };
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  return { success: true };
}

export type ReorderMaterialsResult = { success: true } | { success: false; error: string };

/**
 * Same reasoning as reorderQuestions in features/surveys/actions.ts: one
 * update per row rather than a bulk upsert-by-position helper — material
 * lists are small (single digits to low tens) so this isn't a real cost.
 */
export async function reorderMaterials(experienceSlug: string, materialIds: string[]): Promise<ReorderMaterialsResult> {
  const supabase = await createClient();

  for (let index = 0; index < materialIds.length; index++) {
    const { error } = await supabase
      .from("experience_materials")
      .update({ order_index: index })
      .eq("id", materialIds[index]);

    if (error) {
      return { success: false, error: toActionError(error, "materials") };
    }
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  return { success: true };
}

export type ReleaseMaterialResult = { success: true } | { success: false; error: string };

/**
 * Flips is_released and notifies every participant immediately — the
 * "materials are ready" trigger for manual-release items. Notification is
 * fire-and-forget: the release itself must succeed and be reflected in the
 * UI regardless of whether any individual email send fails.
 */
export async function releaseMaterial(
  materialId: string,
  experienceId: string,
  experienceSlug: string
): Promise<ReleaseMaterialResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("experience_materials").update({ is_released: true }).eq("id", materialId);

  if (error) {
    return { success: false, error: toActionError(error, "materials") };
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);

  void notifyAllParticipants(experienceId, "ready");

  return { success: true };
}

export type GetSignedUrlResult = { success: true; url: string } | { success: false; error: string };

/**
 * The only read path for a facilitator-private file. Requires an
 * authenticated session — storage.ts's signed-URL generation itself runs
 * on the service-role client (bypassing RLS by design, same as every
 * other private-bucket helper in this codebase), so this check is what
 * actually gates it; without it, anyone who could reach this Server
 * Action directly (not just through the gated facilitator-portal page)
 * would be able to mint a signed URL for any facilitator-only file.
 */
export async function getSignedUrl(filePath: string): Promise<GetSignedUrlResult> {
  await getSessionContext();

  try {
    const url = await getFacilitatorMaterialSignedUrl(filePath);
    return { success: true, url };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unable to generate a download link." };
  }
}

// ---------------------------------------------------------------------------
// Facilitator-portal upload — audience is fixed to 'facilitator' and
// attribution goes through uploaded_by_facilitator_id (see migration
// 0018's header comment for why: facilitators have no profiles row, so
// uploaded_by can't identify them).
// ---------------------------------------------------------------------------

export async function addFacilitatorMaterial(
  facilitatorId: string,
  experienceId: string,
  experienceSlug: string,
  workspaceId: string,
  formData: FormData
): Promise<SaveMaterialResult> {
  const title = formData.get("title");
  const description = formData.get("description");
  const file = formData.get("file");

  if (typeof title !== "string" || title.trim().length === 0) {
    return { success: false, error: "Title is required." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Please choose a file to upload." };
  }
  if (file.size > MAX_MATERIAL_FILE_BYTES) {
    return { success: false, error: "File must be under 50MB." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let filePath: string;
  try {
    filePath = await uploadMaterialFile(experienceId, file.name, bytes, file.type || "application/octet-stream", true);
  } catch (uploadError) {
    return { success: false, error: uploadError instanceof Error ? uploadError.message : "Unable to upload the file." };
  }

  const supabase = await createClient();

  const { data: lastRow, error: lastRowError } = await supabase
    .from("experience_materials")
    .select("order_index")
    .eq("experience_id", experienceId)
    .is("deleted_at", null)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRowError) {
    return { success: false, error: toActionError(lastRowError, "materials") };
  }

  const nextOrderIndex = (lastRow?.order_index ?? -1) + 1;

  const { data: inserted, error } = await supabase
    .from("experience_materials")
    .insert({
      experience_id: experienceId,
      workspace_id: workspaceId,
      title: title.trim(),
      description: typeof description === "string" && description.trim().length > 0 ? description.trim() : null,
      material_type: "file",
      file_path: filePath,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type || null,
      audience: "facilitator",
      available_from: "registration",
      is_released: true,
      order_index: nextOrderIndex,
      uploaded_by_facilitator_id: facilitatorId,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: toActionError(error, "materials", "Unable to add resource.") };
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);
  revalidatePath(`/facilitator/${facilitatorId}/materials/${experienceSlug}`);

  return { success: true, materialId: inserted.id };
}

// ---------------------------------------------------------------------------
// Link preview — best-effort page-title fetch for the material form's link
// preview. Never throws: a site that blocks bots, times out, or has no
// <title> just falls back to showing the raw URL, exactly as the sprint
// brief specifies ("fetch title from URL if possible, fallback to URL").
// ---------------------------------------------------------------------------

export type LinkPreviewResult = { title: string | null };

const LINK_PREVIEW_TIMEOUT_MS = 4000;

export async function fetchLinkPreview(url: string): Promise<LinkPreviewResult> {
  try {
    new URL(url); // validates the URL; throws (caught below) if malformed
  } catch {
    return { title: null };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINK_PREVIEW_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CapabilityOS-LinkPreview/1.0)" },
    });

    if (!response.ok) {
      return { title: null };
    }

    // Only look at the first chunk — the <title> tag is always in <head>,
    // no need to read (or parse) a whole multi-megabyte page.
    const reader = response.body?.getReader();
    if (!reader) {
      return { title: null };
    }

    const { value } = await reader.read();
    void reader.cancel();
    const html = new TextDecoder().decode(value ?? new Uint8Array());

    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = match?.[1]?.trim();

    return { title: title && title.length > 0 ? title : null };
  } catch {
    return { title: null };
  } finally {
    clearTimeout(timeout);
  }
}
