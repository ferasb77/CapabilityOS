"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/infrastructure/supabase/server";

import { createFacilitatorSchema, updateFacilitatorSchema } from "./schema";

export type FacilitatorFormValues = Record<string, string | string[]>;

export type CreateFacilitatorResult =
  | { success: true; id: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      values: FacilitatorFormValues;
    };

const SINGLE_VALUE_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "title",
  "organization",
  "yearsExperience",
  "bio",
  "expertiseAreas",
  "certifications",
  "languages",
  "willingToTravel",
  "travelNotes",
  "passportExpiry",
  "availabilityStatus",
  "availabilityNotes",
] as const;

function readRawValues(formData: FormData): FacilitatorFormValues {
  const values: FacilitatorFormValues = {};

  for (const field of SINGLE_VALUE_FIELDS) {
    values[field] = formData.get(field)?.toString() ?? "";
  }

  values.regions = formData.getAll("regions").map(String);
  values.visaCountries = formData.getAll("visaCountries").map(String);

  return values;
}

export async function createFacilitator(
  _prevState: CreateFacilitatorResult | null,
  formData: FormData
): Promise<CreateFacilitatorResult> {
  const values = readRawValues(formData);

  const parsed = createFacilitatorSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("facilitators")
    .insert({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone || null,
      title: data.title || null,
      organization: data.organization || null,
      years_experience: data.yearsExperience ?? null,
      bio: data.bio || null,
      expertise_areas: data.expertiseAreas,
      certifications: data.certifications,
      languages: data.languages,
      regions: data.regions,
      willing_to_travel: data.willingToTravel,
      travel_notes: data.travelNotes || null,
      passport_expiry: data.passportExpiry || null,
      visa_countries: data.visaCountries,
      availability_status: data.availabilityStatus,
      availability_notes: data.availabilityNotes || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "A facilitator with this email already exists.",
        values,
      };
    }

    console.error("Failed to create facilitator", error);

    return {
      success: false,
      error: "Unable to add facilitator. Please try again.",
      values,
    };
  }

  revalidatePath("/dashboard/facilitators");
  redirect(`/dashboard/facilitators/${inserted.id}`);
}

export type UpdateFacilitatorResult =
  | { success: true }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      values: FacilitatorFormValues;
    };

export async function updateFacilitator(
  facilitatorId: string,
  _prevState: UpdateFacilitatorResult | null,
  formData: FormData
): Promise<UpdateFacilitatorResult> {
  const values = readRawValues(formData);

  const parsed = updateFacilitatorSchema.safeParse(values);

  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("facilitators")
    .update({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      phone: data.phone || null,
      title: data.title || null,
      organization: data.organization || null,
      years_experience: data.yearsExperience ?? null,
      bio: data.bio || null,
      expertise_areas: data.expertiseAreas,
      certifications: data.certifications,
      languages: data.languages,
      regions: data.regions,
      willing_to_travel: data.willingToTravel,
      travel_notes: data.travelNotes || null,
      passport_expiry: data.passportExpiry || null,
      visa_countries: data.visaCountries,
      availability_status: data.availabilityStatus,
      availability_notes: data.availabilityNotes || null,
    })
    .eq("id", facilitatorId);

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: "A facilitator with this email already exists.",
        values,
      };
    }

    console.error("Failed to update facilitator", error);

    return {
      success: false,
      error: "Unable to save changes. Please try again.",
      values,
    };
  }

  revalidatePath(`/dashboard/facilitators/${facilitatorId}`);
  revalidatePath("/dashboard/facilitators");
  redirect(`/dashboard/facilitators/${facilitatorId}`);
}
