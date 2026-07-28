import { SurveyForm } from "@/features/surveys/components/survey-form";
import { CustomSurveyForm } from "@/features/surveys/components/custom-survey-form";
import { SurveyThankYou } from "@/features/surveys/components/survey-thank-you";
import { SurveyPageShell } from "@/features/surveys/components/survey-page-shell";
import type { PublicSurveyQuestion } from "@/features/surveys/components/question-renderer";
import { SURVEY_TYPES, type SurveyType } from "@/features/surveys/schema";
import { createClient } from "@/infrastructure/supabase/server";

type RawSurveyQuestion = {
  id: string;
  order_index: number;
  question_type: PublicSurveyQuestion["questionType"];
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

type SurveyContextRow = {
  token_id: string;
  participant_id: string;
  experience_id: string;
  participant_first_name: string | null;
  experience_title: string | null;
  experience_title_ar: string | null;
  organization_name: string | null;
  already_completed: boolean;
  template_id: string | null;
  questions: RawSurveyQuestion[] | null;
};

function toPublicQuestion(row: RawSurveyQuestion): PublicSurveyQuestion {
  return {
    id: row.id,
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

function resolveSurveyType(type: string | undefined): SurveyType {
  return (SURVEY_TYPES as readonly string[]).includes(type ?? "") ? (type as SurveyType) : "satisfaction";
}

const HEADING_COPY: Record<SurveyType, { heading: (title: string) => string; subtitle: string }> = {
  satisfaction: {
    heading: (title) => `Your feedback on ${title}`,
    subtitle: "",
  },
  pre_training: {
    heading: (title) => `Before ${title}`,
    subtitle: "This short survey helps us understand your starting point.",
  },
  post_training: {
    heading: (title) => `After ${title}`,
    subtitle: "Tell us what you learned and how you'll apply it.",
  },
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ type?: string }>;
};

export default async function SurveyPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { type } = await searchParams;
  const surveyType = resolveSurveyType(type);

  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("get_survey_context", { p_token: token, p_survey_type: surveyType })
    .maybeSingle();

  const context = !error && data ? (data as SurveyContextRow) : null;

  return (
    <main className="min-h-screen bg-night px-4 py-10 text-ivory sm:px-6 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        {!context ? (
          <InvalidState />
        ) : (
          <SurveyPageShell>
            <div className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-10">
              {context.already_completed ? (
                <SurveyThankYou surveyType={surveyType} />
              ) : context.questions && context.questions.length > 0 ? (
                <CustomSurveyForm
                  token={token}
                  participantFirstName={context.participant_first_name ?? "there"}
                  experienceTitle={context.experience_title ?? "the experience"}
                  experienceTitleAr={context.experience_title_ar}
                  questions={context.questions.map(toPublicQuestion)}
                  surveyType={surveyType}
                />
              ) : surveyType === "satisfaction" ? (
                <SurveyForm
                  token={token}
                  participantFirstName={context.participant_first_name ?? "there"}
                  experienceTitle={context.experience_title ?? "the experience"}
                />
              ) : (
                <NotConfiguredState surveyType={surveyType} experienceTitle={context.experience_title} />
              )}
            </div>
          </SurveyPageShell>
        )}
      </div>
    </main>
  );
}

function InvalidState() {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center">
      <h1 className="font-heading text-2xl font-semibold text-ivory">Survey link not found</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This survey link is invalid or has expired. Please contact Enable My Growth if you believe
        this is a mistake.
      </p>
    </div>
  );
}

function NotConfiguredState({ surveyType, experienceTitle }: { surveyType: SurveyType; experienceTitle: string | null }) {
  const copy = HEADING_COPY[surveyType];

  return (
    <div className="py-6 text-center">
      <h1 className="font-heading text-2xl font-semibold text-ivory">
        {copy.heading(experienceTitle ?? "this experience")}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This survey isn&apos;t set up yet. Please check back later or contact Enable My Growth.
      </p>
    </div>
  );
}
