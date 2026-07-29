import { z } from "zod";

export const participantSchema = z.object({
  workshopSlug: z
    .string()
    .trim()
    .min(1, "Workshop is required"),

  firstName: z
    .string()
    .trim()
    .min(2, "First name is required"),

  lastName: z
    .string()
    .trim()
    .min(2, "Last name is required"),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),

  mobile: z
    .string()
    .trim()
    .min(6, "Enter a valid mobile number"),

  company: z
    .string()
    .trim()
    .min(2, "Company is required"),

  jobTitle: z
    .string()
    .trim()
    .min(2, "Job title is required"),

  // Optional — only ever populated when the participant checks in with
  // Arabic selected (see the language toggle on /r/[slug]). English name
  // fields above stay required regardless of language.
  firstNameAr: z.preprocess(
    (value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value),
    z.string().trim().optional()
  ),
  lastNameAr: z.preprocess(
    (value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value),
    z.string().trim().optional()
  ),
});

export type ParticipantInput = z.infer<typeof participantSchema>;