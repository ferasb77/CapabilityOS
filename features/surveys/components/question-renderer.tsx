"use client";

import { Star } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AR } from "@/lib/i18n/ar";
import { useLanguage } from "@/lib/i18n/language-context";
import type { QuestionType } from "../schema";

export type PublicSurveyQuestion = {
  id: string;
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

export type AnswerValue = number | string | string[] | undefined;

type Props = {
  question: PublicSurveyQuestion;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  error?: string;
};

/** Arabic option list, index-aligned to `options` — falls back to the
 * English option at that index wherever no translation was entered, so a
 * partially-translated choice list never shows a blank option. */
function resolveOptions(question: PublicSurveyQuestion, isAr: boolean): string[] {
  const base = question.options ?? [];
  if (!isAr) {
    return base;
  }
  return base.map((option, index) => question.optionsAr?.[index] || option);
}

function QuestionHeader({ question, error }: { question: PublicSurveyQuestion; error?: string }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const hasArabicText = Boolean(question.questionTextAr);
  const text = isAr && hasArabicText ? question.questionTextAr! : question.questionText;
  const description = isAr && question.descriptionAr ? question.descriptionAr : question.description;

  return (
    <div>
      <p className="text-sm font-medium text-ivory">
        {text}
        {question.isRequired &&
          (isAr ? (
            <Tooltip>
              <TooltipTrigger className="ml-1 align-super text-xs text-destructive">*</TooltipTrigger>
              <TooltipContent>{AR.survey.requiredTooltip}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="ml-1 text-destructive">*</span>
          ))}
        {isAr && !hasArabicText && (
          <span className="ms-2 text-xs font-normal text-muted-foreground">{AR.common.englishFallbackNote}</span>
        )}
      </p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}

function StarRatingQuestion({ question, value, onChange }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const current = typeof value === "number" ? value : 0;

  // Star ratings get a generic Poor→Excellent anchor pair in Arabic even
  // when a question has no per-question low/high label set at all — every
  // other question type falls back to the plain English label instead (see
  // resolveOptions / QuestionHeader above), but "ضعيف"/"ممتاز" is common
  // enough for 5-star questions specifically to be worth a built-in default.
  const lowLabel = isAr ? question.lowLabelAr || (question.lowLabel ? AR.survey.poor : null) : question.lowLabel;
  const highLabel = isAr
    ? question.highLabelAr || (question.highLabel ? AR.survey.excellent : null)
    : question.highLabel;

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} out of 5`}
            aria-pressed={current === star}
            onClick={() => onChange(star)}
            className="rounded-md p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            <Star
              className={cn(
                "size-9 transition-colors",
                star <= current ? "fill-gold text-gold" : "fill-transparent text-ivory/25"
              )}
            />
          </button>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

function NumberScaleQuestion({ question, value, onChange, max }: Props & { max: number }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const current = typeof value === "number" ? value : null;
  const start = max === 10 && question.questionType === "nps" ? 0 : 1;
  const values = Array.from({ length: max - start + 1 }, (_, index) => start + index);
  const lowLabel = isAr ? question.lowLabelAr || question.lowLabel : question.lowLabel;
  const highLabel = isAr ? question.highLabelAr || question.highLabel : question.highLabel;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-11">
        {values.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={current === option}
            onClick={() => onChange(option)}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border text-sm font-medium transition-colors",
              current === option
                ? "border-gold bg-gold text-night"
                : "border-border-subtle bg-night/40 text-ivory hover:border-gold/40"
            )}
          >
            {option}
          </button>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

function YesNoQuestion({ value, onChange }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const current = typeof value === "number" ? value : null;

  const options = [
    { label: isAr ? AR.survey.yes : "Yes", numeric: 1 },
    { label: isAr ? AR.survey.no : "No", numeric: 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={current === option.numeric}
          onClick={() => onChange(option.numeric)}
          className={cn(
            "h-14 rounded-lg border text-base font-semibold transition-colors",
            current === option.numeric
              ? "border-gold bg-gold text-night"
              : "border-border-subtle bg-night/40 text-ivory hover:border-gold/40"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SingleChoiceQuestion({ question, value, onChange }: Props) {
  const { language } = useLanguage();
  const current = typeof value === "string" ? value : null;
  const baseOptions = question.options ?? [];
  const labels = resolveOptions(question, language === "ar");

  return (
    <div className="space-y-2">
      {baseOptions.map((option, index) => (
        <button
          key={option}
          type="button"
          aria-pressed={current === option}
          onClick={() => onChange(option)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
            current === option
              ? "border-gold bg-gold/10 text-ivory"
              : "border-border-subtle bg-night/40 text-ivory hover:border-gold/40"
          )}
        >
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
              current === option ? "border-gold" : "border-ivory/30"
            )}
          >
            {current === option && <span className="size-2.5 rounded-full bg-gold" />}
          </span>
          {labels[index]}
        </button>
      ))}
    </div>
  );
}

function MultipleChoiceQuestion({ question, value, onChange }: Props) {
  const { language } = useLanguage();
  const current = Array.isArray(value) ? value : [];
  const baseOptions = question.options ?? [];
  const labels = resolveOptions(question, language === "ar");

  function toggle(option: string) {
    onChange(current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  }

  return (
    <div className="space-y-2">
      {baseOptions.map((option, index) => {
        const checked = current.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={checked}
            onClick={() => toggle(option)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
              checked ? "border-gold bg-gold/10 text-ivory" : "border-border-subtle bg-night/40 text-ivory hover:border-gold/40"
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-[5px] border-2",
                checked ? "border-gold bg-gold" : "border-ivory/30"
              )}
            >
              {checked && <span className="size-2.5 rounded-[2px] bg-night" />}
            </span>
            {labels[index]}
          </button>
        );
      })}
    </div>
  );
}

function OpenTextQuestion({ question, value, onChange }: Props) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const label = isAr && question.questionTextAr ? question.questionTextAr : question.questionText;

  return (
    <Textarea
      rows={3}
      dir={isAr ? "rtl" : "ltr"}
      className={isAr ? "font-cairo placeholder:text-right" : undefined}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    />
  );
}

export function QuestionRenderer(props: Props) {
  const { question } = props;

  return (
    <fieldset className="space-y-3">
      <QuestionHeader question={question} error={props.error} />
      {question.questionType === "rating_5" && <StarRatingQuestion {...props} />}
      {question.questionType === "rating_10" && <NumberScaleQuestion {...props} max={10} />}
      {question.questionType === "nps" && <NumberScaleQuestion {...props} max={10} />}
      {question.questionType === "yes_no" && <YesNoQuestion {...props} />}
      {question.questionType === "single_choice" && <SingleChoiceQuestion {...props} />}
      {question.questionType === "multiple_choice" && <MultipleChoiceQuestion {...props} />}
      {question.questionType === "open_text" && <OpenTextQuestion {...props} />}
    </fieldset>
  );
}
