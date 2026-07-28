"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AR } from "@/lib/i18n/ar";
import { useLanguage } from "@/lib/i18n/language-context";

import { submitSurveyResponse, type SubmitSurveyResult } from "../actions";
import { StarRating } from "./star-rating";
import { SurveyThankYou } from "./survey-thank-you";

const initialState: SubmitSurveyResult = { success: false, error: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  const { language } = useLanguage();
  const isAr = language === "ar";

  return (
    <Button type="submit" disabled={pending} size="lg" className="w-full">
      {pending ? (isAr ? AR.survey.submitting : "Submitting...") : isAr ? AR.survey.submit : "Submit Feedback"}
    </Button>
  );
}

type Props = {
  token: string;
  participantFirstName: string;
  experienceTitle: string;
};

export function SurveyForm({ token, participantFirstName, experienceTitle }: Props) {
  const [state, action] = useActionState(submitSurveyResponse, initialState);
  const { language } = useLanguage();
  const isAr = language === "ar";
  const t = AR.survey;

  if (state.success) {
    return <SurveyThankYou />;
  }

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="token" value={token} />

      <div>
        <h1 className="font-heading text-2xl font-semibold text-ivory sm:text-3xl">
          {isAr
            ? `${t.greetingPrefix} ${participantFirstName}، ${t.feedbackOn} ${experienceTitle}`
            : `Hi ${participantFirstName}, thank you for attending ${experienceTitle}`}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isAr ? t.satisfactionSubtitle : "Your feedback takes two minutes and helps us improve every future experience."}
        </p>
      </div>

      <div className="space-y-6">
        <StarRating name="contentRating" label={isAr ? t.contentQuestion : "How would you rate the content?"} />
        <StarRating
          name="facilitatorRating"
          label={isAr ? t.facilitatorQuestion : "How would you rate the facilitator's delivery?"}
        />
        <StarRating
          name="logisticsRating"
          label={isAr ? t.logisticsQuestion : "How would you rate the logistics and organisation?"}
        />
        <StarRating name="overallRating" label={isAr ? t.overallQuestion : "Overall, how would you rate this experience?"} />
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="highlights">{isAr ? t.highlightsLabel : "What did you find most valuable?"}</Label>
          <Textarea
            id="highlights"
            name="highlights"
            required
            rows={3}
            dir={isAr ? "rtl" : "ltr"}
            className={isAr ? "font-cairo placeholder:text-right" : undefined}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="improvements">{isAr ? t.improvementsLabel : "What could be improved?"}</Label>
          <Textarea
            id="improvements"
            name="improvements"
            required
            rows={3}
            dir={isAr ? "rtl" : "ltr"}
            className={isAr ? "font-cairo placeholder:text-right" : undefined}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="additionalComments">
            {isAr ? t.additionalCommentsLabel : "Any other comments? (optional)"}
          </Label>
          <Textarea
            id="additionalComments"
            name="additionalComments"
            rows={3}
            dir={isAr ? "rtl" : "ltr"}
            className={isAr ? "font-cairo placeholder:text-right" : undefined}
          />
        </div>
      </div>

      {!state.success && state.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {state.error}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
