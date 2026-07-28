import { z } from "zod";

// ---------------------------------------------------------------------------
// Legacy hardcoded survey (unchanged) — still used by the legacy branch of
// the public form and submitSurveyResponse when an experience has no
// resolved template.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Survey type — which stage of the experience a template/token belongs to
// ---------------------------------------------------------------------------

export const SURVEY_TYPES = ["satisfaction", "pre_training", "post_training"] as const;

export type SurveyType = (typeof SURVEY_TYPES)[number];

export const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
  satisfaction: "Satisfaction Survey",
  pre_training: "Pre-Training Survey",
  post_training: "Post-Training Survey",
};

// ---------------------------------------------------------------------------
// Custom survey builder
// ---------------------------------------------------------------------------

export const QUESTION_TYPES = [
  "rating_5",
  "rating_10",
  "nps",
  "single_choice",
  "multiple_choice",
  "open_text",
  "yes_no",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  rating_5: "5-Star Rating",
  rating_10: "1-10 Scale",
  nps: "Net Promoter Score (0-10)",
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  open_text: "Open Text",
  yes_no: "Yes / No",
};

const CHOICE_QUESTION_TYPES: QuestionType[] = ["single_choice", "multiple_choice"];
const RATING_QUESTION_TYPES: QuestionType[] = ["rating_5", "rating_10", "nps"];

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const surveyTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  surveyType: z.enum(SURVEY_TYPES).default("satisfaction"),
});

export type SurveyTemplateFormValues = z.infer<typeof surveyTemplateSchema>;

export const surveyQuestionSchema = z
  .object({
    questionType: z.enum(QUESTION_TYPES),
    questionText: z.string().trim().min(1, "Question text is required"),
    description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    isRequired: z.boolean(),
    lowLabel: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    highLabel: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    options: z.array(z.string().trim().min(1)).optional(),
    // Arabic translations — every field here is optional; English is
    // always the fallback (see lib/i18n) when Arabic is left blank.
    questionTextAr: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    descriptionAr: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    lowLabelAr: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    highLabelAr: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    optionsAr: z.array(z.string().trim()).optional(),
  })
  .superRefine((data, ctx) => {
    if (CHOICE_QUESTION_TYPES.includes(data.questionType) && (!data.options || data.options.length < 2)) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Add at least 2 options" });
    }
  });

export type SurveyQuestionFormValues = z.infer<typeof surveyQuestionSchema>;

export function isChoiceQuestionType(type: QuestionType): boolean {
  return CHOICE_QUESTION_TYPES.includes(type);
}

export function isRatingQuestionType(type: QuestionType): boolean {
  return RATING_QUESTION_TYPES.includes(type);
}
