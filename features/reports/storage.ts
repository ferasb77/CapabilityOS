import { randomUUID } from "node:crypto";

import { requireEnv } from "@/infrastructure/env";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";

const REPORT_ASSETS_BUCKET = "report-assets";

let bucketEnsured = false;

/**
 * Public, same reasoning as the certificates bucket — a report PDF embeds
 * the logo at generation time (server-side download, not a browser fetch),
 * but the branding settings preview and any future "view logo" affordance
 * need a bare URL that works without an authenticated session.
 */
async function ensureReportAssetsBucket(): Promise<void> {
  if (bucketEnsured) {
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(listError.message);
  }

  const existing = (buckets ?? []).find((bucket) => bucket.name === REPORT_ASSETS_BUCKET);

  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(REPORT_ASSETS_BUCKET, {
      public: true,
      fileSizeLimit: "2MB",
    });

    if (createError) {
      throw new Error(createError.message);
    }
  } else if (!existing.public) {
    const { error: updateError } = await supabase.storage.updateBucket(REPORT_ASSETS_BUCKET, { public: true });

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  bucketEnsured = true;
}

function extensionFor(contentType: string): string {
  return contentType === "image/png" ? "png" : "jpg";
}

/**
 * `[workspaceId]/logo-[uuid].[ext]` — a fresh uuid per upload means
 * replacing the logo never collides with the previous file, so a report
 * mid-generation that already downloaded the old path can't have it yanked
 * out from under it.
 */
export async function uploadReportLogo(
  workspaceId: string,
  bytes: Uint8Array,
  contentType: string
): Promise<string> {
  await ensureReportAssetsBucket();

  const supabase = createServiceRoleClient();
  const path = `${workspaceId}/logo-${randomUUID()}.${extensionFor(contentType)}`;

  const { error } = await supabase.storage.from(REPORT_ASSETS_BUCKET).upload(path, Buffer.from(bytes), {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

export function getReportLogoPublicUrl(path: string): string {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1/object/public/${REPORT_ASSETS_BUCKET}/${path}`;
}

export async function downloadReportLogo(path: string): Promise<Buffer> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage.from(REPORT_ASSETS_BUCKET).download(path);

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to download the report logo.");
  }

  return Buffer.from(await data.arrayBuffer());
}
