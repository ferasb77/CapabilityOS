import { createClient } from "@/infrastructure/supabase/server";
import type { QuestionType, SurveyType } from "./schema";

export type SurveyRowStatus = "not_sent" | "sent" | "completed";

/** Pre/post columns additionally distinguish "no survey set up at all" from "set up but not yet sent." */
export type PrePostSurveyStatus = "not_configured" | "not_sent" | "sent" | "completed";

/**
 * The four hardcoded dimensions are nullable now (migration 0014) — a
 * template-driven response has no concept of them and leaves all four
 * null, storing its answers in survey_answers instead. `null` here means
 * "this response used a custom template — see the Survey Results tab or
 * getSurveyResultsByTemplate for its answers," not "unrated."
 */
export type SurveyResponseDetail = {
  id: string;
  contentRating: number | null;
  facilitatorRating: number | null;
  logisticsRating: number | null;
  overallRating: number | null;
  highlights: string | null;
  improvements: string | null;
  additionalComments: string | null;
  submittedAt: string;
  flagged: boolean;
};

export type SurveyParticipantRow = {
  participantId: string;
  tokenId: string | null;
  fullName: string;
  company: string | null;
  status: SurveyRowStatus;
  sentAt: string | null;
  completedAt: string | null;
  /** Hours since sent_at — drives reminder eligibility (>48h, not completed). */
  hoursSinceSent: number | null;
  response: SurveyResponseDetail | null;
  preSurveyStatus: PrePostSurveyStatus;
  preTokenId: string | null;
  postSurveyStatus: PrePostSurveyStatus;
  postTokenId: string | null;
};

export type SurveyManagementData = {
  experienceId: string;
  experienceSlug: string;
  experienceTitle: string;
  totalParticipants: number;
  surveysSent: number;
  surveysCompleted: number;
  responseRate: number;
  averageOverallScore: number | null;
  preConfigured: boolean;
  postConfigured: boolean;
  rows: SurveyParticipantRow[];
};

type ParticipantRow = {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
};

type TokenRow = {
  id: string;
  participant_id: string;
  survey_type: SurveyType;
  sent_at: string | null;
  completed_at: string | null;
};

type ResponseRow = {
  id: string;
  participant_id: string;
  content_rating: number | null;
  facilitator_rating: number | null;
  logistics_rating: number | null;
  overall_rating: number | null;
  highlights: string | null;
  improvements: string | null;
  additional_comments: string | null;
  submitted_at: string;
  flagged: boolean;
};

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

const MS_PER_HOUR = 3_600_000;

/**
 * Everything the "Surveys" management tab needs in one call: every
 * participant for this experience, their token/response state, and the
 * summary-bar aggregates — the table and the summary bar must always agree
 * on the same numbers, so they're computed from the same rows here rather
 * than separately.
 */
export async function getSurveyManagementData(experienceId: string): Promise<SurveyManagementData | null> {
  const supabase = await createClient();

  const { data: experienceRow, error: experienceError } = await supabase
    .from("experiences")
    .select("id, slug, title")
    .eq("id", experienceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (experienceError) {
    throw new Error(experienceError.message);
  }

  if (!experienceRow) {
    return null;
  }

  const [participantsResult, tokensResult, responsesResult, configResult] = await Promise.all([
    supabase
      .from("participants")
      .select("id, first_name, last_name, company")
      .eq("workshop_slug", experienceRow.slug)
      .order("created_at", { ascending: true }),
    supabase
      .from("survey_tokens")
      .select("id, participant_id, survey_type, sent_at, completed_at")
      .eq("workshop_id", experienceId),
    supabase
      .from("survey_responses")
      .select(
        "id, participant_id, content_rating, facilitator_rating, logistics_rating, overall_rating, highlights, improvements, additional_comments, submitted_at, flagged"
      )
      .eq("workshop_id", experienceId)
      .eq("survey_type", "satisfaction"),
    supabase
      .from("experience_survey_templates")
      .select("survey_type")
      .eq("experience_id", experienceId)
      .in("survey_type", ["pre_training", "post_training"]),
  ]);

  if (participantsResult.error) {
    throw new Error(participantsResult.error.message);
  }
  if (tokensResult.error) {
    throw new Error(tokensResult.error.message);
  }
  if (responsesResult.error) {
    throw new Error(responsesResult.error.message);
  }
  if (configResult.error) {
    throw new Error(configResult.error.message);
  }

  const participantRows: ParticipantRow[] = participantsResult.data ?? [];
  const responseByParticipantId = new Map(
    ((responsesResult.data ?? []) as ResponseRow[]).map((row) => [row.participant_id, row])
  );

  const tokensByParticipantAndType = new Map<string, TokenRow>();
  for (const row of (tokensResult.data ?? []) as TokenRow[]) {
    tokensByParticipantAndType.set(`${row.participant_id}:${row.survey_type}`, row);
  }

  const configuredTypes = new Set((configResult.data ?? []).map((row) => row.survey_type));
  const preConfigured = configuredTypes.has("pre_training");
  const postConfigured = configuredTypes.has("post_training");

  function resolvePrePostStatus(configured: boolean, token: TokenRow | undefined): PrePostSurveyStatus {
    if (!configured) {
      return "not_configured";
    }
    if (token?.completed_at) {
      return "completed";
    }
    if (token?.sent_at) {
      return "sent";
    }
    return "not_sent";
  }

  const now = Date.now();

  const rows: SurveyParticipantRow[] = participantRows.map((participant) => {
    const token = tokensByParticipantAndType.get(`${participant.id}:satisfaction`);
    const preToken = tokensByParticipantAndType.get(`${participant.id}:pre_training`);
    const postToken = tokensByParticipantAndType.get(`${participant.id}:post_training`);
    const response = responseByParticipantId.get(participant.id) ?? null;

    let status: SurveyRowStatus = "not_sent";
    if (token?.completed_at) {
      status = "completed";
    } else if (token?.sent_at) {
      status = "sent";
    }

    return {
      participantId: participant.id,
      tokenId: token?.id ?? null,
      fullName: `${participant.first_name} ${participant.last_name}`.trim(),
      company: participant.company,
      status,
      sentAt: token?.sent_at ?? null,
      completedAt: token?.completed_at ?? null,
      hoursSinceSent: token?.sent_at ? (now - new Date(token.sent_at).getTime()) / MS_PER_HOUR : null,
      response: response
        ? {
            id: response.id,
            contentRating: response.content_rating,
            facilitatorRating: response.facilitator_rating,
            logisticsRating: response.logistics_rating,
            overallRating: response.overall_rating,
            highlights: response.highlights,
            improvements: response.improvements,
            additionalComments: response.additional_comments,
            submittedAt: response.submitted_at,
            flagged: response.flagged,
          }
        : null,
      preSurveyStatus: resolvePrePostStatus(preConfigured, preToken),
      preTokenId: preToken?.id ?? null,
      postSurveyStatus: resolvePrePostStatus(postConfigured, postToken),
      postTokenId: postToken?.id ?? null,
    };
  });

  const surveysSent = rows.filter((row) => row.status === "sent" || row.status === "completed").length;
  const surveysCompleted = rows.filter((row) => row.status === "completed").length;

  return {
    experienceId: experienceRow.id,
    experienceSlug: experienceRow.slug,
    experienceTitle: experienceRow.title,
    totalParticipants: rows.length,
    surveysSent,
    surveysCompleted,
    responseRate: rows.length > 0 ? Math.round((surveysCompleted / rows.length) * 100) : 0,
    averageOverallScore: average(
      rows
        .map((row) => row.response?.overallRating)
        .filter((rating): rating is number => rating !== null && rating !== undefined)
    ),
    preConfigured,
    postConfigured,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Custom survey builder — templates and questions
// ---------------------------------------------------------------------------

export type SurveyQuestion = {
  id: string;
  templateId: string;
  orderIndex: number;
  questionType: QuestionType;
  questionText: string;
  description: string | null;
  isRequired: boolean;
  options: string[] | null;
  lowLabel: string | null;
  highLabel: string | null;
  questionTextAr: string | null;
  descriptionAr: string | null;
  optionsAr: string[] | null;
  lowLabelAr: string | null;
  highLabelAr: string | null;
};

export type SurveyTemplateSummary = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  surveyType: SurveyType;
  isDefault: boolean;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SurveyTemplateWithQuestions = SurveyTemplateSummary & { questions: SurveyQuestion[] };

type TemplateRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  survey_type: SurveyType;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

type QuestionRow = {
  id: string;
  template_id: string;
  order_index: number;
  question_type: QuestionType;
  question_text: string;
  description: string | null;
  is_required: boolean;
  options: string[] | null;
  low_label: string | null;
  high_label: string | null;
  question_text_ar: string | null;
  description_ar: string | null;
  options_ar: string[] | null;
  low_label_ar: string | null;
  high_label_ar: string | null;
};

function mapQuestion(row: QuestionRow): SurveyQuestion {
  return {
    id: row.id,
    templateId: row.template_id,
    orderIndex: row.order_index,
    questionType: row.question_type,
    questionText: row.question_text,
    description: row.description,
    isRequired: row.is_required,
    options: row.options,
    lowLabel: row.low_label,
    highLabel: row.high_label,
    questionTextAr: row.question_text_ar,
    descriptionAr: row.description_ar,
    optionsAr: row.options_ar,
    lowLabelAr: row.low_label_ar,
    highLabelAr: row.high_label_ar,
  };
}

const QUESTION_SELECT =
  "id, template_id, order_index, question_type, question_text, description, is_required, options, low_label, high_label, question_text_ar, description_ar, options_ar, low_label_ar, high_label_ar";

export async function getSurveyTemplates(
  workspaceId: string,
  surveyType?: SurveyType
): Promise<SurveyTemplateSummary[]> {
  const supabase = await createClient();

  let templatesQuery = supabase
    .from("survey_templates")
    .select("id, workspace_id, name, description, survey_type, is_default, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (surveyType) {
    templatesQuery = templatesQuery.eq("survey_type", surveyType);
  }

  const [{ data: templateRows, error: templatesError }, { data: questionRows, error: questionsError }] =
    await Promise.all([templatesQuery, supabase.from("survey_questions").select("template_id")]);

  if (templatesError) {
    throw new Error(templatesError.message);
  }
  if (questionsError) {
    throw new Error(questionsError.message);
  }

  const questionCountByTemplateId = new Map<string, number>();
  for (const row of (questionRows ?? []) as { template_id: string }[]) {
    questionCountByTemplateId.set(row.template_id, (questionCountByTemplateId.get(row.template_id) ?? 0) + 1);
  }

  return ((templateRows ?? []) as TemplateRow[]).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    surveyType: row.survey_type,
    isDefault: row.is_default,
    questionCount: questionCountByTemplateId.get(row.id) ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getSurveyTemplate(templateId: string): Promise<SurveyTemplateWithQuestions | null> {
  const supabase = await createClient();

  const [{ data: templateRow, error: templateError }, { data: questionRows, error: questionsError }] =
    await Promise.all([
      supabase
        .from("survey_templates")
        .select("id, workspace_id, name, description, survey_type, is_default, created_at, updated_at")
        .eq("id", templateId)
        .maybeSingle(),
      supabase
        .from("survey_questions")
        .select(QUESTION_SELECT)
        .eq("template_id", templateId)
        .order("order_index", { ascending: true }),
    ]);

  if (templateError) {
    throw new Error(templateError.message);
  }
  if (!templateRow) {
    return null;
  }
  if (questionsError) {
    throw new Error(questionsError.message);
  }

  const questions = ((questionRows ?? []) as QuestionRow[]).map(mapQuestion);

  return {
    id: templateRow.id,
    workspaceId: templateRow.workspace_id,
    name: templateRow.name,
    description: templateRow.description,
    surveyType: templateRow.survey_type,
    isDefault: templateRow.is_default,
    questionCount: questions.length,
    createdAt: templateRow.created_at,
    updatedAt: templateRow.updated_at,
    questions,
  };
}

export type ExperienceSurveyTemplateResolution = {
  source: "override" | "default" | "none";
  template: SurveyTemplateWithQuestions | null;
};

/**
 * Mirrors the resolution order baked into the get_survey_context() Postgres
 * function that the public /survey/[token] page actually relies on for
 * submission — this dashboard-side copy exists so the Surveys tab can show
 * "which template is active" and let an operator override it, without
 * round-tripping through the public RPC. Scoped by survey type since
 * Sprint 19 — each type resolves its override/default independently.
 */
export async function getExperienceSurveyTemplate(
  experienceId: string,
  surveyType: SurveyType = "satisfaction"
): Promise<ExperienceSurveyTemplateResolution> {
  const supabase = await createClient();

  const { data: overrideRow, error: overrideError } = await supabase
    .from("experience_survey_templates")
    .select("template_id")
    .eq("experience_id", experienceId)
    .eq("survey_type", surveyType)
    .maybeSingle();

  if (overrideError) {
    throw new Error(overrideError.message);
  }

  if (overrideRow) {
    const template = await getSurveyTemplate(overrideRow.template_id);
    return { source: "override", template };
  }

  const { data: defaultRow, error: defaultError } = await supabase
    .from("survey_templates")
    .select("id")
    .eq("survey_type", surveyType)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (defaultError) {
    throw new Error(defaultError.message);
  }

  if (defaultRow) {
    const template = await getSurveyTemplate(defaultRow.id);
    return { source: "default", template };
  }

  return { source: "none", template: null };
}

// ---------------------------------------------------------------------------
// Pre/post survey configuration and comparison — Sprint 19
// ---------------------------------------------------------------------------

export type ExperienceSurveyTypeConfig = {
  enabled: boolean;
  templateId: string | null;
  autoSend: boolean;
};

export type ExperienceSurveyConfig = {
  preTraining: ExperienceSurveyTypeConfig;
  postTraining: ExperienceSurveyTypeConfig;
};

/**
 * Pre/post have no separate "enabled" column — presence of a row in
 * experience_survey_templates for that (experience, type) pair IS "enabled"
 * (mirrors the existing satisfaction override pattern above, where absence
 * means "not configured" rather than "off").
 */
export async function getExperienceSurveyConfig(experienceId: string): Promise<ExperienceSurveyConfig> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("experience_survey_templates")
    .select("survey_type, template_id, auto_send")
    .eq("experience_id", experienceId)
    .in("survey_type", ["pre_training", "post_training"]);

  if (error) {
    throw new Error(error.message);
  }

  const byType = new Map(
    (data ?? []).map((row) => [row.survey_type as SurveyType, row as { template_id: string; auto_send: boolean }])
  );

  function toConfig(type: "pre_training" | "post_training"): ExperienceSurveyTypeConfig {
    const row = byType.get(type);
    return row
      ? { enabled: true, templateId: row.template_id, autoSend: row.auto_send }
      : { enabled: false, templateId: null, autoSend: true };
  }

  return { preTraining: toConfig("pre_training"), postTraining: toConfig("post_training") };
}

export type SurveyTokenSummary = {
  id: string;
  participantId: string;
  sentAt: string | null;
  openedAt: string | null;
  completedAt: string | null;
};

export async function getSurveyTokensByType(experienceId: string, surveyType: SurveyType): Promise<SurveyTokenSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("survey_tokens")
    .select("id, participant_id, sent_at, opened_at, completed_at")
    .eq("workshop_id", experienceId)
    .eq("survey_type", surveyType);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    participantId: row.participant_id,
    sentAt: row.sent_at,
    openedAt: row.opened_at,
    completedAt: row.completed_at,
  }));
}

// ---------------------------------------------------------------------------
// Custom survey results — aggregated per question from survey_answers
// ---------------------------------------------------------------------------

export type QuestionResultRating = {
  kind: "rating";
  questionId: string;
  questionType: "rating_5" | "rating_10" | "nps" | "yes_no";
  questionText: string;
  isRequired: boolean;
  responseCount: number;
  average: number | null;
  distribution: { value: number; count: number }[];
  npsScore: number | null;
};

export type QuestionResultChoice = {
  kind: "choice";
  questionId: string;
  questionType: "single_choice" | "multiple_choice";
  questionText: string;
  isRequired: boolean;
  responseCount: number;
  optionCounts: { option: string; count: number }[];
};

export type QuestionResultText = {
  kind: "text";
  questionId: string;
  questionType: "open_text";
  questionText: string;
  isRequired: boolean;
  responses: string[];
};

export type QuestionResult = QuestionResultRating | QuestionResultChoice | QuestionResultText;

export type CustomSurveyResults = {
  templateId: string;
  templateName: string;
  totalResponses: number;
  questionResults: QuestionResult[];
};

type AnswerRow = {
  response_id: string;
  question_id: string;
  answer_numeric: number | null;
  answer_text: string | null;
  answer_array: string[] | null;
};

function computeNpsScore(scores: number[]): number | null {
  if (scores.length === 0) {
    return null;
  }
  const promoters = scores.filter((score) => score >= 9).length;
  const detractors = scores.filter((score) => score <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

export async function getSurveyResultsByTemplate(
  experienceId: string,
  templateId: string
): Promise<CustomSurveyResults | null> {
  const template = await getSurveyTemplate(templateId);

  if (!template) {
    return null;
  }

  const supabase = await createClient();

  const { data: answerRows, error } = await supabase
    .from("survey_answers")
    .select("response_id, question_id, answer_numeric, answer_text, answer_array, survey_responses!inner(workshop_id)")
    .eq("survey_responses.workshop_id", experienceId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (answerRows ?? []) as unknown as AnswerRow[];
  const answersByQuestionId = new Map<string, AnswerRow[]>();
  for (const row of rows) {
    const bucket = answersByQuestionId.get(row.question_id) ?? [];
    bucket.push(row);
    answersByQuestionId.set(row.question_id, bucket);
  }

  const totalResponses = new Set(rows.map((row) => row.response_id)).size;

  const questionResults: QuestionResult[] = template.questions.map((question) => {
    const answers = answersByQuestionId.get(question.id) ?? [];

    if (question.questionType === "single_choice" || question.questionType === "multiple_choice") {
      const optionCountMap = new Map<string, number>();
      for (const option of question.options ?? []) {
        optionCountMap.set(option, 0);
      }
      for (const answer of answers) {
        if (question.questionType === "single_choice" && answer.answer_text) {
          optionCountMap.set(answer.answer_text, (optionCountMap.get(answer.answer_text) ?? 0) + 1);
        } else if (question.questionType === "multiple_choice" && answer.answer_array) {
          for (const selected of answer.answer_array) {
            optionCountMap.set(selected, (optionCountMap.get(selected) ?? 0) + 1);
          }
        }
      }
      return {
        kind: "choice",
        questionId: question.id,
        questionType: question.questionType,
        questionText: question.questionText,
        isRequired: question.isRequired,
        responseCount: answers.length,
        optionCounts: Array.from(optionCountMap.entries()).map(([option, count]) => ({ option, count })),
      };
    }

    if (question.questionType === "open_text") {
      return {
        kind: "text",
        questionId: question.id,
        questionType: question.questionType,
        questionText: question.questionText,
        isRequired: question.isRequired,
        responses: answers.map((answer) => answer.answer_text).filter((text): text is string => Boolean(text)),
      };
    }

    // rating_5, rating_10, nps, yes_no — all numeric
    const numericAnswers = answers
      .map((answer) => answer.answer_numeric)
      .filter((value): value is number => value !== null);

    const distributionMap = new Map<number, number>();
    for (const value of numericAnswers) {
      distributionMap.set(value, (distributionMap.get(value) ?? 0) + 1);
    }

    return {
      kind: "rating",
      questionId: question.id,
      questionType: question.questionType,
      questionText: question.questionText,
      isRequired: question.isRequired,
      responseCount: numericAnswers.length,
      average: average(numericAnswers),
      distribution: Array.from(distributionMap.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value - b.value),
      npsScore: question.questionType === "nps" ? computeNpsScore(numericAnswers) : null,
    };
  });

  return {
    templateId: template.id,
    templateName: template.name,
    totalResponses,
    questionResults,
  };
}

// ---------------------------------------------------------------------------
// Pre/post comparison — Learning Impact tab
// ---------------------------------------------------------------------------

export type MatchedQuestionComparison = {
  questionText: string;
  preQuestionId: string;
  postQuestionId: string;
  questionType: QuestionType;
  preAverage: number | null;
  postAverage: number | null;
  preResponseCount: number;
  postResponseCount: number;
  delta: number | null;
};

export type NpsComparison = {
  preScore: number | null;
  postScore: number | null;
  delta: number | null;
};

export type IndividualAnswerCell = { numeric: number | null; text: string | null } | null;

export type IndividualAnswerPair = {
  questionText: string;
  questionType: QuestionType;
  preAnswer: IndividualAnswerCell;
  postAnswer: IndividualAnswerCell;
};

export type IndividualComparisonRow = {
  participantId: string;
  fullName: string;
  preStatus: PrePostSurveyStatus;
  postStatus: PrePostSurveyStatus;
  answers: IndividualAnswerPair[];
};

export type PrePostComparisonData = {
  configured: boolean;
  preTemplateName: string | null;
  postTemplateName: string | null;
  matchedQuestions: MatchedQuestionComparison[];
  nps: NpsComparison | null;
  individualRows: IndividualComparisonRow[];
  responseRates: {
    pre: { totalParticipants: number; sent: number; completed: number };
    post: { totalParticipants: number; sent: number; completed: number };
  };
};

const NUMERIC_QUESTION_TYPES: readonly QuestionType[] = ["rating_5", "rating_10", "nps", "yes_no"];

const EMPTY_COMPARISON: PrePostComparisonData = {
  configured: false,
  preTemplateName: null,
  postTemplateName: null,
  matchedQuestions: [],
  nps: null,
  individualRows: [],
  responseRates: {
    pre: { totalParticipants: 0, sent: 0, completed: 0 },
    post: { totalParticipants: 0, sent: 0, completed: 0 },
  },
};

/**
 * Pre and post are different templates, so there's no shared question id to
 * join on — matching happens by question_text (trimmed, case-insensitive),
 * per the sprint's architecture rule.
 */
export async function getPrePostComparisonData(experienceId: string): Promise<PrePostComparisonData> {
  const supabase = await createClient();

  const { data: experienceRow, error: experienceError } = await supabase
    .from("experiences")
    .select("id, slug")
    .eq("id", experienceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (experienceError) {
    throw new Error(experienceError.message);
  }
  if (!experienceRow) {
    return EMPTY_COMPARISON;
  }

  const { data: configRows, error: configError } = await supabase
    .from("experience_survey_templates")
    .select("survey_type, template_id")
    .eq("experience_id", experienceId)
    .in("survey_type", ["pre_training", "post_training"]);

  if (configError) {
    throw new Error(configError.message);
  }

  const preTemplateId = (configRows ?? []).find((row) => row.survey_type === "pre_training")?.template_id ?? null;
  const postTemplateId = (configRows ?? []).find((row) => row.survey_type === "post_training")?.template_id ?? null;

  if (!preTemplateId || !postTemplateId) {
    return EMPTY_COMPARISON;
  }

  const [preTemplate, postTemplate] = await Promise.all([
    getSurveyTemplate(preTemplateId),
    getSurveyTemplate(postTemplateId),
  ]);

  if (!preTemplate || !postTemplate) {
    return EMPTY_COMPARISON;
  }

  const postByText = new Map(postTemplate.questions.map((question) => [question.questionText.trim().toLowerCase(), question]));
  const matchedPairs = preTemplate.questions
    .map((preQuestion) => {
      const postQuestion = postByText.get(preQuestion.questionText.trim().toLowerCase());
      return postQuestion ? { preQuestion, postQuestion } : null;
    })
    .filter((pair): pair is { preQuestion: SurveyQuestion; postQuestion: SurveyQuestion } => pair !== null);

  const [participantsResult, preResponsesResult, postResponsesResult, preTokensResult, postTokensResult] =
    await Promise.all([
      supabase
        .from("participants")
        .select("id, first_name, last_name")
        .eq("workshop_slug", experienceRow.slug)
        .order("created_at", { ascending: true }),
      supabase.from("survey_responses").select("id, participant_id").eq("workshop_id", experienceId).eq("survey_type", "pre_training"),
      supabase.from("survey_responses").select("id, participant_id").eq("workshop_id", experienceId).eq("survey_type", "post_training"),
      supabase
        .from("survey_tokens")
        .select("participant_id, sent_at, completed_at")
        .eq("workshop_id", experienceId)
        .eq("survey_type", "pre_training"),
      supabase
        .from("survey_tokens")
        .select("participant_id, sent_at, completed_at")
        .eq("workshop_id", experienceId)
        .eq("survey_type", "post_training"),
    ]);

  if (participantsResult.error) throw new Error(participantsResult.error.message);
  if (preResponsesResult.error) throw new Error(preResponsesResult.error.message);
  if (postResponsesResult.error) throw new Error(postResponsesResult.error.message);
  if (preTokensResult.error) throw new Error(preTokensResult.error.message);
  if (postTokensResult.error) throw new Error(postTokensResult.error.message);

  const preResponses = preResponsesResult.data ?? [];
  const postResponses = postResponsesResult.data ?? [];

  const [preAnswersResult, postAnswersResult] = await Promise.all([
    preResponses.length > 0
      ? supabase
          .from("survey_answers")
          .select("response_id, question_id, answer_numeric, answer_text, answer_array")
          .in(
            "response_id",
            preResponses.map((row) => row.id)
          )
      : Promise.resolve({ data: [] as AnswerRow[], error: null }),
    postResponses.length > 0
      ? supabase
          .from("survey_answers")
          .select("response_id, question_id, answer_numeric, answer_text, answer_array")
          .in(
            "response_id",
            postResponses.map((row) => row.id)
          )
      : Promise.resolve({ data: [] as AnswerRow[], error: null }),
  ]);

  if (preAnswersResult.error) throw new Error(preAnswersResult.error.message);
  if (postAnswersResult.error) throw new Error(postAnswersResult.error.message);

  const preAnswerRows = (preAnswersResult.data ?? []) as AnswerRow[];
  const postAnswerRows = (postAnswersResult.data ?? []) as AnswerRow[];

  const preAnswersByQuestion = new Map<string, AnswerRow[]>();
  for (const row of preAnswerRows) {
    const bucket = preAnswersByQuestion.get(row.question_id) ?? [];
    bucket.push(row);
    preAnswersByQuestion.set(row.question_id, bucket);
  }
  const postAnswersByQuestion = new Map<string, AnswerRow[]>();
  for (const row of postAnswerRows) {
    const bucket = postAnswersByQuestion.get(row.question_id) ?? [];
    bucket.push(row);
    postAnswersByQuestion.set(row.question_id, bucket);
  }

  const participantIdByPreResponseId = new Map(preResponses.map((row) => [row.id, row.participant_id]));
  const participantIdByPostResponseId = new Map(postResponses.map((row) => [row.id, row.participant_id]));

  const preAnswerByParticipantAndQuestion = new Map<string, AnswerRow>();
  for (const row of preAnswerRows) {
    const participantId = participantIdByPreResponseId.get(row.response_id);
    if (participantId) {
      preAnswerByParticipantAndQuestion.set(`${participantId}:${row.question_id}`, row);
    }
  }
  const postAnswerByParticipantAndQuestion = new Map<string, AnswerRow>();
  for (const row of postAnswerRows) {
    const participantId = participantIdByPostResponseId.get(row.response_id);
    if (participantId) {
      postAnswerByParticipantAndQuestion.set(`${participantId}:${row.question_id}`, row);
    }
  }

  const matchedQuestions: MatchedQuestionComparison[] = matchedPairs
    .filter((pair) => NUMERIC_QUESTION_TYPES.includes(pair.preQuestion.questionType))
    .map((pair) => {
      const preNumeric = (preAnswersByQuestion.get(pair.preQuestion.id) ?? [])
        .map((row) => row.answer_numeric)
        .filter((value): value is number => value !== null);
      const postNumeric = (postAnswersByQuestion.get(pair.postQuestion.id) ?? [])
        .map((row) => row.answer_numeric)
        .filter((value): value is number => value !== null);

      const preAverage = average(preNumeric);
      const postAverage = average(postNumeric);

      return {
        questionText: pair.preQuestion.questionText,
        preQuestionId: pair.preQuestion.id,
        postQuestionId: pair.postQuestion.id,
        questionType: pair.preQuestion.questionType,
        preAverage,
        postAverage,
        preResponseCount: preNumeric.length,
        postResponseCount: postNumeric.length,
        delta: preAverage !== null && postAverage !== null ? Math.round((postAverage - preAverage) * 10) / 10 : null,
      };
    });

  const npsPair = matchedPairs.find((pair) => pair.preQuestion.questionType === "nps");
  let nps: NpsComparison | null = null;
  if (npsPair) {
    const preScores = (preAnswersByQuestion.get(npsPair.preQuestion.id) ?? [])
      .map((row) => row.answer_numeric)
      .filter((value): value is number => value !== null);
    const postScores = (postAnswersByQuestion.get(npsPair.postQuestion.id) ?? [])
      .map((row) => row.answer_numeric)
      .filter((value): value is number => value !== null);
    const preScore = computeNpsScore(preScores);
    const postScore = computeNpsScore(postScores);
    nps = { preScore, postScore, delta: preScore !== null && postScore !== null ? postScore - preScore : null };
  }

  const preTokenByParticipant = new Map((preTokensResult.data ?? []).map((row) => [row.participant_id, row]));
  const postTokenByParticipant = new Map((postTokensResult.data ?? []).map((row) => [row.participant_id, row]));

  function statusFor(token: { sent_at: string | null; completed_at: string | null } | undefined): PrePostSurveyStatus {
    if (token?.completed_at) {
      return "completed";
    }
    if (token?.sent_at) {
      return "sent";
    }
    return "not_sent";
  }

  function toAnswerCell(row: AnswerRow | undefined): IndividualAnswerCell {
    if (!row) {
      return null;
    }
    return { numeric: row.answer_numeric, text: row.answer_text };
  }

  const individualRows: IndividualComparisonRow[] = (participantsResult.data ?? []).map((participant) => ({
    participantId: participant.id,
    fullName: `${participant.first_name} ${participant.last_name}`.trim(),
    preStatus: statusFor(preTokenByParticipant.get(participant.id)),
    postStatus: statusFor(postTokenByParticipant.get(participant.id)),
    answers: matchedPairs.map((pair) => ({
      questionText: pair.preQuestion.questionText,
      questionType: pair.preQuestion.questionType,
      preAnswer: toAnswerCell(preAnswerByParticipantAndQuestion.get(`${participant.id}:${pair.preQuestion.id}`)),
      postAnswer: toAnswerCell(postAnswerByParticipantAndQuestion.get(`${participant.id}:${pair.postQuestion.id}`)),
    })),
  }));

  const preTokens = preTokensResult.data ?? [];
  const postTokens = postTokensResult.data ?? [];
  const totalParticipants = (participantsResult.data ?? []).length;

  return {
    configured: true,
    preTemplateName: preTemplate.name,
    postTemplateName: postTemplate.name,
    matchedQuestions,
    nps,
    individualRows,
    responseRates: {
      pre: {
        totalParticipants,
        sent: preTokens.filter((row) => row.sent_at).length,
        completed: preTokens.filter((row) => row.completed_at).length,
      },
      post: {
        totalParticipants,
        sent: postTokens.filter((row) => row.sent_at).length,
        completed: postTokens.filter((row) => row.completed_at).length,
      },
    },
  };
}
