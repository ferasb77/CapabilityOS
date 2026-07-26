"use server";

import { participantSchema } from "./schema";
import type { CheckInResult } from "./types";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";
import { fetchFilteredParticipants } from "./data";
import type { ParticipantFilters, ParticipantSurveyStatus } from "./data";
import { maybeAutoIssueCertificate } from "@/features/certificates/actions";
import { sendPreTrainingSurveyOnRegistration } from "@/features/surveys/actions";
import { createOrGetMaterialToken } from "@/features/materials/actions";
import { requireEnv } from "@/infrastructure/env";

export async function checkInParticipant(
  _: CheckInResult | null,
  formData: FormData
): Promise<CheckInResult> {
  const values = {
    workshopSlug: formData.get("workshopSlug"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    mobile: formData.get("mobile"),
    company: formData.get("company"),
    jobTitle: formData.get("jobTitle"),
  };

  console.log(values);

  const parsed = participantSchema.safeParse(values);

  if (!parsed.success) {
    console.error(parsed.error.flatten());

    return {
      success: false,
      message: JSON.stringify(parsed.error.flatten().fieldErrors),
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Anonymous check-in visitors have no session, and `participants` grants
  // no SELECT policy to `anon` at all — this duplicate check used to come
  // back empty for every anonymous submission (silently, no error), so
  // re-checking in with the same email never got caught. Separately,
  // `INSERT ... RETURNING` requires the executing role to also satisfy a
  // SELECT policy on the row being returned; since `anon` has none, the
  // insert below would hard-fail with "new row violates row-level security
  // policy" the moment `.select()` is chained after it — confirmed live
  // against the real anon key: identical insert with no `.select()`
  // succeeds (201), the same insert with `.select()` fails (42501).
  // Granting anon broad SELECT on participants would fix both but expose
  // every participant's name/email/mobile/company to any anonymous visitor
  // via the public API, so this uses the service-role client instead,
  // matching maybeAutoIssueCertificate/createOrGetMaterialToken's existing
  // pattern for this same public, session-less flow.
  const supabase = createServiceRoleClient();

  const { data: existing } = await supabase
    .from("participants")
    .select("id")
    .eq("workshop_slug", parsed.data.workshopSlug)
    .ilike("email", parsed.data.email)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message: "This email has already checked in for this workshop.",
    };
  }

  const { data: insertedParticipant, error } = await supabase
    .from("participants")
    .insert({
      workshop_slug: parsed.data.workshopSlug,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      mobile: parsed.data.mobile,
      company: parsed.data.company,
      job_title: parsed.data.jobTitle,
      checked_in: true,
      source: "QR",
    })
    .select("id")
    .single();

  if (error) {
    console.error(error);

    return {
      success: false,
      message: "Unable to complete check-in. Please try again.",
    };
  }

  // Fire-and-forget: PDF generation + email would add multiple seconds to
  // a public check-in submission, and a certificate hiccup here must never
  // block or fail the check-in itself. maybeAutoIssueCertificate already
  // swallows its own errors and is a no-op unless the experience has
  // auto-issue on and this participant is already eligible.
  //
  // The materials token is the one exception to "fire-and-forget": unlike
  // the certificate/survey hooks, it's a single cheap DB find-or-insert
  // with no external I/O, and its result (the token, to build the
  // materials link) is needed immediately for the success screen's
  // "Access Program Materials" button — so it's awaited, not void'd.
  let materialsUrl: string | null = null;

  if (insertedParticipant) {
    // Anonymous check-in visitors have no session, and `experiences`
    // SELECT is restricted to `authenticated` — the ordinary session-bound
    // client silently returns nothing here, which used to skip all three
    // side effects below for every real check-in. get_experience_for_checkin
    // (migration 0022) is a security-definer RPC scoped to just an id;
    // called here via the service-role client (already in use above),
    // matching how maybeAutoIssueCertificate/createOrGetMaterialToken
    // already bypass RLS for this same fire-and-forget path.
    const { data: experienceRow } = await supabase
      .rpc("get_experience_for_checkin", { p_slug: parsed.data.workshopSlug })
      .maybeSingle<{ id: string }>();

    if (experienceRow) {
      void maybeAutoIssueCertificate(insertedParticipant.id, experienceRow.id);
      void sendPreTrainingSurveyOnRegistration(insertedParticipant.id, experienceRow.id);

      const token = await createOrGetMaterialToken(insertedParticipant.id, experienceRow.id);
      if (token) {
        try {
          materialsUrl = `${requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "")}/materials/${token}`;
        } catch {
          materialsUrl = null;
        }
      }
    }
  }

  return {
    success: true,
    message: "Check-in completed successfully.",
    materialsUrl,
  };
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(values: string[]): string {
  return values.map(csvEscape).join(",");
}

const SURVEY_STATUS_LABEL: Record<ParticipantSurveyStatus, string> = {
  not_sent: "Not Sent",
  sent: "Sent",
  completed: "Completed",
};

function formatCsvDateTime(value: string | null): string {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const CSV_HEADER = [
  "First Name",
  "Last Name",
  "Email",
  "Mobile",
  "Company",
  "Job Title",
  "Experience",
  "Client",
  "Checked In",
  "Check-in Time",
  "Survey Status",
  "Registration Date",
];

/**
 * Returns a CSV string; the caller (a Client Component) turns it into a
 * downloadable Blob — no client-side CSV library involved. Lives in this
 * "use server" module (not data.ts) because Next.js doesn't allow an inline
 * "use server" export in a file that a Client Component imports from
 * alongside other, non-action server-only functions.
 */
export async function exportParticipants(filters: ParticipantFilters): Promise<string> {
  const items = await fetchFilteredParticipants(filters);

  const rows = items.map((item) =>
    csvRow([
      item.firstName,
      item.lastName,
      item.email,
      item.mobile,
      item.company ?? "",
      item.jobTitle ?? "",
      item.experienceTitle ?? "",
      item.clientName ?? "",
      item.checkedIn ? "Yes" : "No",
      formatCsvDateTime(item.checkedInAt),
      SURVEY_STATUS_LABEL[item.surveyStatus],
      formatCsvDateTime(item.registeredAt),
    ])
  );

  return [csvRow(CSV_HEADER), ...rows].join("\r\n");
}