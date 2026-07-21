"use server";

import { participantSchema } from "./schema";
import type { CheckInResult } from "./types";
import { createClient } from "@/infrastructure/supabase/server";

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

  const supabase = await createClient();

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

  const { error } = await supabase.from("participants").insert({
    workshop_slug: parsed.data.workshopSlug,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    email: parsed.data.email,
    mobile: parsed.data.mobile,
    company: parsed.data.company,
    job_title: parsed.data.jobTitle,
    checked_in: true,
    source: "QR",
  });

  if (error) {
    console.error(error);

    return {
      success: false,
      message: "Unable to complete check-in. Please try again.",
    };
  }

  return {
    success: true,
    message: "Check-in completed successfully.",
  };
}