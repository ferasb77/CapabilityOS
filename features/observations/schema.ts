import { z } from "zod";

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Enter a hex color like #C9A96E");

export const observationTagInputSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(40, "Keep tags short"),
  color: hexColor,
});

export const observationTagsSchema = z.array(observationTagInputSchema).max(30, "Too many tags");

export type ObservationTagInput = z.infer<typeof observationTagInputSchema>;

export const participantObservationSchema = z.object({
  experienceId: z.string().uuid(),
  participantId: z.string().uuid(),
  notes: z.preprocess((value) => value ?? "", z.string()),
  tags: z.array(z.string()).default([]),
  facilitatorName: z.string().trim().min(1, "Facilitator name is required"),
});

export type ParticipantObservationInput = z.infer<typeof participantObservationSchema>;

export const experienceObservationSchema = z.object({
  experienceId: z.string().uuid(),
  groupDynamics: z.preprocess((value) => value ?? "", z.string()),
  keyThemes: z.preprocess((value) => value ?? "", z.string()),
  recommendations: z.preprocess((value) => value ?? "", z.string()),
  generalNotes: z.preprocess((value) => value ?? "", z.string()),
  facilitatorName: z.string().trim().min(1, "Facilitator name is required"),
});

export type ExperienceObservationInput = z.infer<typeof experienceObservationSchema>;
