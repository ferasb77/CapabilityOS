import { z } from "zod";

export const REGIONS = [
  "KSA",
  "UAE",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Egypt",
  "Jordan",
  "Lebanon",
  "Other",
] as const;

export const AVAILABILITY_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "partially_available", label: "Partially Available" },
  { value: "unavailable", label: "Unavailable" },
] as const;

function parseTagList(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export const createFacilitatorSchema = z.object({
  // Personal details
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().toLowerCase().min(1, "Email is required").email("Enter a valid email address"),
  phone: z.string().trim().optional(),
  title: z.string().trim().optional(),
  organization: z.string().trim().optional(),
  yearsExperience: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().min(0, "Must be 0 or more").optional()
  ),

  // Bio
  bio: z.string().trim().optional(),

  // Expertise
  expertiseAreas: z.preprocess(parseTagList, z.array(z.string())),
  certifications: z.preprocess(parseTagList, z.array(z.string())),

  // Languages and regions
  languages: z.preprocess(parseTagList, z.array(z.string())),
  regions: z.array(z.enum(REGIONS)).default([]),
  willingToTravel: z.preprocess((value) => value === "on" || value === "true", z.boolean()),
  travelNotes: z.string().trim().optional(),

  // Documents
  passportExpiry: z.string().trim().optional(),
  visaCountries: z.array(z.enum(REGIONS)).default([]),

  // Availability
  availabilityStatus: z
    .enum(["available", "partially_available", "unavailable"])
    .default("available"),
  availabilityNotes: z.string().trim().optional(),
});

export type CreateFacilitatorInput = z.infer<typeof createFacilitatorSchema>;

// Same field set as create — editing doesn't loosen or tighten anything.
// Kept as its own export (rather than every caller importing
// createFacilitatorSchema) to match the create/update schema pairing used
// throughout the rest of this codebase (e.g. features/experiences/schema.ts).
export const updateFacilitatorSchema = createFacilitatorSchema;

export type UpdateFacilitatorInput = z.infer<typeof updateFacilitatorSchema>;
