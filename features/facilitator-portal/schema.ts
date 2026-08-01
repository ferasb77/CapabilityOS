import { z } from "zod";

export const updateFacilitatorProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  title: z.string().optional().nullable(),
  organization: z.string().optional().nullable(),
  yearsExperience: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : Number(val)),
    z.number().nullable().optional()
  ),
  bio: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  expertiseAreas: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  willingToTravel: z.boolean().default(true),
  travelNotes: z.string().optional().nullable(),
  passportExpiry: z.string().optional().nullable(),
  visaCountries: z.array(z.string()).default([]),
});

export type UpdateFacilitatorProfileInput = z.infer<typeof updateFacilitatorProfileSchema>;

export const addUnavailabilitySchema = z
  .object({
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    reason: z.string().optional().nullable(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export type AddUnavailabilityInput = z.infer<typeof addUnavailabilitySchema>;
