"use client";

import { CircleCheck } from "lucide-react";

import { AR } from "@/lib/i18n/ar";
import { useLanguage } from "@/lib/i18n/language-context";
import type { SurveyType } from "@/features/surveys/schema";

const THANK_YOU_COPY: Record<SurveyType, { heading: string; body: string }> = {
  satisfaction: {
    heading: "Thank you for your feedback",
    body: "Your response has been recorded. We appreciate you taking the time to help us improve.",
  },
  pre_training: {
    heading: "Thank you — see you soon",
    body: "Your response has been recorded. This helps us tailor the experience to where you're starting from.",
  },
  post_training: {
    heading: "Thank you for sharing what you learned",
    body: "Your response has been recorded. It helps us measure the real impact of this program.",
  },
};

type Props = {
  surveyType?: SurveyType;
};

export function SurveyThankYou({ surveyType = "satisfaction" }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const copy = THANK_YOU_COPY[surveyType];

  return (
    <div className="flex flex-col items-center py-12 text-center">
      <CircleCheck className="mb-6 size-16 text-gold" strokeWidth={1.5} />
      <h1 className="font-heading text-2xl font-semibold text-ivory sm:text-3xl">
        {isAr ? AR.survey.thankYouHeading : copy.heading}
      </h1>
      <p className="mt-4 max-w-sm text-sm text-muted-foreground">
        {isAr ? AR.survey.responseRecorded : copy.body}
      </p>
      <p className="mt-10 text-xs tracking-[0.3em] text-gold/70 uppercase">Enable My Growth</p>
    </div>
  );
}
