import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";

const ATTENDANCE_SHEETS_BUCKET = "attendance-sheets";
const SIGNED_URL_EXPIRY_SECONDS = 24 * 60 * 60;

let bucketEnsured = false;

/**
 * Private — same reasoning as the certificate-templates bucket
 * (features/certificates/storage.ts): an attendance sheet lists every
 * registered participant's name and company, so unlike the public
 * certificates bucket it has no reason to be reachable by a bare URL. The
 * "Generate Sheet" button gets a signed, time-limited link instead.
 */
async function ensureAttendanceSheetsBucket(): Promise<void> {
  if (bucketEnsured) {
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(listError.message);
  }

  const existing = (buckets ?? []).find((bucket) => bucket.name === ATTENDANCE_SHEETS_BUCKET);

  if (!existing) {
    const { error: createError } = await supabase.storage.createBucket(ATTENDANCE_SHEETS_BUCKET, {
      public: false,
      fileSizeLimit: "10MB",
    });

    if (createError) {
      throw new Error(createError.message);
    }
  } else if (existing.public) {
    const { error: updateError } = await supabase.storage.updateBucket(ATTENDANCE_SHEETS_BUCKET, { public: false });

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  bucketEnsured = true;
}

function objectPath(experienceId: string, date: string): string {
  return `${experienceId}/attendance-${date}.pdf`;
}

/**
 * Regenerating the same day's sheet overwrites the previous file at the
 * same path (upsert) — each generation is on-demand and short-lived, unlike
 * a certificate PDF that might be linked from an email, so there's no
 * "in-flight download of the old file" concern to avoid.
 */
export async function uploadAttendanceSheet(
  experienceId: string,
  date: string,
  pdfBytes: Uint8Array
): Promise<string> {
  await ensureAttendanceSheetsBucket();

  const supabase = createServiceRoleClient();
  const path = objectPath(experienceId, date);

  const { error } = await supabase.storage.from(ATTENDANCE_SHEETS_BUCKET).upload(path, Buffer.from(pdfBytes), {
    contentType: "application/pdf",
    upsert: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

export async function getAttendanceSheetSignedUrl(path: string): Promise<string> {
  await ensureAttendanceSheetsBucket();

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(ATTENDANCE_SHEETS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to generate a link for this attendance sheet.");
  }

  return data.signedUrl;
}
