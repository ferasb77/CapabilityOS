"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { AR } from "@/lib/i18n/ar";
import { useLanguage } from "@/lib/i18n/language-context";

import type { SurveyType } from "@/features/surveys/schema";

import { submitCustomSurveyResponse, type CustomSurveyAnswerInput } from "../actions";
import { QuestionRenderer, type AnswerValue, type PublicSurveyQuestion } from "./question-renderer";
import { SurveyThankYou } from "./survey-thank-you";

const HEADING_COPY: Record<
  SurveyType,
  { heading: (name: string, title: string) => string; subtitle: (name: string) => string }
> = {
  satisfaction: {
    heading: (name, title) => `Hi ${name}, thank you for attending ${title}`,
    subtitle: () => "Your feedback takes a couple of minutes and helps us improve every future experience.",
  },
  pre_training: {
    heading: (name, title) => `Before ${title}`,
    subtitle: (name) => `Hi ${name}, this short survey helps us understand your starting point.`,
  },
  post_training: {
    heading: (name, title) => `After ${title}`,
    subtitle: (name) => `Hi ${name}, tell us what you learned and how you'll apply it.`,
  },
};

const HEADING_COPY_AR: Record<
  SurveyType,
  { heading: (name: string, title: string) => string; subtitle: (name: string) => string }
> = {
  satisfaction: {
    heading: (name, title) => `${AR.survey.greetingPrefix} ${name}، ${AR.survey.feedbackOn} ${title}`,
    subtitle: () => AR.survey.satisfactionSubtitle,
  },
  pre_training: {
    heading: (_, title) => `${AR.survey.before} ${title}`,
    subtitle: () => AR.survey.preSubtitle,
  },
  post_training: {
    heading: (_, title) => `${AR.survey.after} ${title}`,
    subtitle: () => AR.survey.postSubtitle,
  },
};

function isAnswered(question: PublicSurveyQuestion, value: AnswerValue): boolean {
  if (value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

function toAnswerInput(question: PublicSurveyQuestion, value: AnswerValue): CustomSurveyAnswerInput {
  if (question.questionType === "multiple_choice" && Array.isArray(value)) {
    return { questionId: question.id, answerArray: value };
  }
  if (typeof value === "number") {
    return { questionId: question.id, answerNumeric: value };
  }
  if (typeof value === "string") {
    return { questionId: question.id, answerText: value };
  }
  return { questionId: question.id };
}

type Props = {
  token: string;
  participantFirstName: string;
  experienceTitle: string;
  experienceTitleAr?: string | null;
  questions: PublicSurveyQuestion[];
  surveyType?: SurveyType;
};

export function CustomSurveyForm({
  token,
  participantFirstName,
  experienceTitle,
  experienceTitleAr,
  questions,
  surveyType = "satisfaction",
}: Props) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { language } = useLanguage();
  const isAr = language === "ar";

  if (submitted) {
    return <SurveyThankYou surveyType={surveyType} />;
  }

  const copy = isAr ? HEADING_COPY_AR[surveyType] : HEADING_COPY[surveyType];
  const displayTitle = isAr && experienceTitleAr ? experienceTitleAr : experienceTitle;

  function handleAnswerChange(questionId: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setFieldErrors((prev) => {
      if (!(questionId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const missing: Record<string, string> = {};
    for (const question of questions) {
      if (question.isRequired && !isAnswered(question, answers[question.id])) {
        missing[question.id] = "This question is required.";
      }
    }

    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setFormError("Please answer all required questions before submitting.");
      return;
    }

    const payload = questions
      .filter((question) => isAnswered(question, answers[question.id]))
      .map((question) => toAnswerInput(question, answers[question.id]));

    startTransition(async () => {
      const result = await submitCustomSurveyResponse(token, payload);

      if (result.success) {
        setSubmitted(true);
      } else {
        setFormError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-ivory sm:text-3xl">
          {copy.heading(participantFirstName, displayTitle)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.subtitle(participantFirstName)}</p>
      </div>

      <div className="space-y-8">
        {questions.map((question) => (
          <QuestionRenderer
            key={question.id}
            question={question}
            value={answers[question.id]}
            onChange={(value) => handleAnswerChange(question.id, value)}
            error={fieldErrors[question.id]}
          />
        ))}
      </div>

      {formError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {formError}
        </div>
      )}

      <Button type="submit" disabled={isPending} size="lg" className="w-full">
        {isPending ? (isAr ? AR.survey.submitting : "Submitting...") : isAr ? AR.survey.submit : "Submit Feedback"}
      </Button>
    </form>
  );
}
