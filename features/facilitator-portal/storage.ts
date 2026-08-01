import { randomUUID } from "node:crypto";

import { requireEnv } from "@/infrastructure/env";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";

const FACILITATOR_PHOTOS_BUCKET = "facilitator-photos";

let bucketEnsured = false;

/**
 * Public — a facilitator's photo is displayed on both the operator-facing
 * directory (<AvatarImage src={facilitator.photoUrl}>) and the portal's own
 * header, neither of which round-trips through a signed URL.
 */
async function ensureFacilitatorPhotosBucket(): Promise<void> {
  if (bucketEnsured) {
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(listError.message);
  }

  const existing = (buckets ?? []).find((bucket) => bucket.name === FACILITATOR_PHOTOS_BUCKET);

  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(FACILITATOR_PHOTOS_BUCKET, {
      public: true,
      fileSizeLimit: "5MB",
    });

    if (createError) {
      throw new Error(createError.message);
    }
  } else if (!existing.public) {
    const { error: updateError } = await supabase.storage.updateBucket(FACILITATOR_PHOTOS_BUCKET, { public: true });

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  bucketEnsured = true;
}

export async function uploadFacilitatorPhoto(
  facilitatorId: string,
  fileName: string,
  bytes: Uint8Array,
  contentType: string
): Promise<string> {
  await ensureFacilitatorPhotosBucket();

  const supabase = createServiceRoleClient();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${facilitatorId}/${randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from(FACILITATOR_PHOTOS_BUCKET).upload(path, Buffer.from(bytes), {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1/object/public/${FACILITATOR_PHOTOS_BUCKET}/${path}`;
}
