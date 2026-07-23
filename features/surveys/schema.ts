import { z } from "zod";

const ratingSchema = z.coerce
  .number()
  .int()
  .min(1, "Please select a rating")
  .max(5, "Please select a rating");

export const surveyResponseSchema = z.object({
  token: z.string().trim().min(1, "Missing survey token"),

  contentRating: ratingSchema,
  facilitatorRating: ratingSchema,
  logisticsRating: ratingSchema,
  overallRating: ratingSchema,

  highlights: z
    .string()
    .trim()
    .min(1, "Tell us what you found most valuable"),

  improvements: z
    .string()
    .trim()
    .min(1, "Tell us what could be improved"),

  additionalComments: z.string().trim().optional(),
});

export type SurveyResponseInput = z.infer<typeof surveyResponseSchema>;
