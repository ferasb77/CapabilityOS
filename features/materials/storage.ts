import { randomUUID } from "node:crypto";

import { requireEnv } from "@/infrastructure/env";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";

const FACILITATOR_MATERIALS_BUCKET = "experience-materials";
const PARTICIPANT_MATERIALS_BUCKET = "participant-materials";

let facilitatorBucketEnsured = false;
let participantBucketEnsured = false;

/**
 * Private — facilitator-only materials are never fetched by a bare URL,
 * only through getFacilitatorMaterialSignedUrl below.
 */
async function ensureFacilitatorMaterialsBucket(): Promise<void> {
  if (facilitatorBucketEnsured) {
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(listError.message);
  }

  const existing = (buckets ?? []).find((bucket) => bucket.name === FACILITATOR_MATERIALS_BUCKET);

  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(FACILITATOR_MATERIALS_BUCKET, {
      public: false,
      fileSizeLimit: "50MB",
    });

    if (createError) {
      throw new Error(createError.message);
    }
  } else if (existing.public) {
    const { error: updateError } = await supabase.storage.updateBucket(FACILITATOR_MATERIALS_BUCKET, {
      public: false,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  facilitatorBucketEnsured = true;
}

/**
 * Public — anything a participant can see must be reachable by a bare URL
 * (no signed-URL round trip on the portal), so any material whose audience
 * includes "participant" uploads here, including "both" materials.
 */
async function ensureParticipantMaterialsBucket(): Promise<void> {
  if (participantBucketEnsured) {
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(listError.message);
  }

  const existing = (buckets ?? []).find((bucket) => bucket.name === PARTICIPANT_MATERIALS_BUCKET);

  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(PARTICIPANT_MATERIALS_BUCKET, {
      public: true,
      fileSizeLimit: "50MB",
    });

    if (createError) {
      throw new Error(createError.message);
    }
  } else if (!existing.public) {
    const { error: updateError } = await supabase.storage.updateBucket(PARTICIPANT_MATERIALS_BUCKET, {
      public: true,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  participantBucketEnsured = true;
}

function objectPath(experienceId: string, fileName: string): string {
  // uuid prefix (not the original filename alone) so two materials with
  // the same filename in the same experience never collide.
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${experienceId}/${randomUUID()}-${safeName}`;
}

/**
 * `audience === 'facilitator'` uploads go to the private bucket; anything
 * participant-visible ('participant' or 'both') goes to the public bucket
 * so the portal can link straight to it with no signed URL.
 */
export async function uploadMaterialFile(
  experienceId: string,
  fileName: string,
  bytes: Uint8Array,
  contentType: string,
  isFacilitatorOnly: boolean
): Promise<string> {
  const bucket = isFacilitatorOnly ? FACILITATOR_MATERIALS_BUCKET : PARTICIPANT_MATERIALS_BUCKET;

  if (isFacilitatorOnly) {
    await ensureFacilitatorMaterialsBucket();
  } else {
    await ensureParticipantMaterialsBucket();
  }

  const supabase = createServiceRoleClient();
  const path = objectPath(experienceId, fileName);

  const { error } = await supabase.storage.from(bucket).upload(path, Buffer.from(bytes), {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

export function getParticipantMaterialPublicUrl(path: string): string {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1/object/public/${PARTICIPANT_MATERIALS_BUCKET}/${path}`;
}

/**
 * Short-lived signed URL for a facilitator-only file — the private
 * bucket's only read path, per the "always served via 5-minute signed
 * URLs" architecture rule.
 */
export async function getFacilitatorMaterialSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  await ensureFacilitatorMaterialsBucket();

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(FACILITATOR_MATERIALS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to generate a download link for this file.");
  }

  return data.signedUrl;
}
