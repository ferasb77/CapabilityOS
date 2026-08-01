import { z } from "zod";

import { REGIONS } from "@/features/facilitators/schema";

export { REGIONS };

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function parseTagList(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Invitation acceptance
// ---------------------------------------------------------------------------

export const acceptFacilitatorInvitationSchema = z
  .object({
    token: z.string().trim().min(1, "Invalid invitation link"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type AcceptFacilitatorInvitationInput = z.infer<typeof acceptFacilitatorInvitationSchema>;

// ---------------------------------------------------------------------------
// Self-service profile — one schema per section, matched to the "save per
// section, not per field" UX in the sprint brief.
// ---------------------------------------------------------------------------

export const personalProfessionalSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  title: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  organization: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  yearsExperience: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(0, "Must be 0 or more").optional()
  ),
  bio: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type PersonalProfessionalInput = z.infer<typeof personalProfessionalSchema>;

export const expertiseCertificationsSchema = z.object({
  expertiseAreas: z.preprocess(parseTagList, z.array(z.string())),
  certifications: z.preprocess(parseTagList, z.array(z.string())),
});

export type ExpertiseCertificationsInput = z.infer<typeof expertiseCertificationsSchema>;

export const languagesRegionsSchema = z.object({
  languages: z.preprocess(parseTagList, z.array(z.string())),
  regions: z.array(z.enum(REGIONS)).default([]),
  willingToTravel: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  travelNotes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type LanguagesRegionsInput = z.infer<typeof languagesRegionsSchema>;

export const documentsSchema = z.object({
  passportExpiry: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  visaCountries: z.array(z.enum(REGIONS)).default([]),
});

export type DocumentsInput = z.infer<typeof documentsSchema>;

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");

export const addUnavailabilitySchema = z
  .object({
    startDate: dateString,
    endDate: dateString,
    reason: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export type AddUnavailabilityInput = z.infer<typeof addUnavailabilitySchema>;
