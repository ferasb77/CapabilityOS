import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";

const FACILITATOR_REPORTS_BUCKET = "facilitator-reports";
const SIGNED_URL_EXPIRY_SECONDS = 24 * 60 * 60;

let bucketEnsured = false;

/** Private — a facilitator report discusses individual participants (even
 * anonymized in the AI prompt, the human-edited version may still name
 * people), so unlike report-assets it has no reason to be reachable by a
 * bare URL. Same pattern as features/attendance/storage.ts. */
async function ensureFacilitatorReportsBucket(): Promise<void> {
  if (bucketEnsured) {
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(listError.message);
  }

  const existing = (buckets ?? []).find((bucket) => bucket.name === FACILITATOR_REPORTS_BUCKET);

  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(FACILITATOR_REPORTS_BUCKET, {
      public: false,
      fileSizeLimit: "10MB",
    });

    if (createError) {
      throw new Error(createError.message);
    }
  } else if (existing.public) {
    const { error: updateError } = await supabase.storage.updateBucket(FACILITATOR_REPORTS_BUCKET, {
      public: false,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  bucketEnsured = true;
}

function objectPath(experienceId: string, date: string): string {
  return `${experienceId}/facilitator-report-${date}.pdf`;
}

export async function uploadFacilitatorReportPdf(
  experienceId: string,
  date: string,
  pdfBytes: Uint8Array
): Promise<string> {
  await ensureFacilitatorReportsBucket();

  const supabase = createServiceRoleClient();
  const path = objectPath(experienceId, date);

  const { error } = await supabase.storage
    .from(FACILITATOR_REPORTS_BUCKET)
    .upload(path, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: true });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

export async function getFacilitatorReportSignedUrl(path: string): Promise<string> {
  await ensureFacilitatorReportsBucket();

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(FACILITATOR_REPORTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to generate a link for this report.");
  }

  return data.signedUrl;
}
