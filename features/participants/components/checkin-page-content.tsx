"use client";

import Image from "next/image";

import { AR } from "@/lib/i18n/ar";
import { LanguageProvider, localize, useLanguage } from "@/lib/i18n/language-context";
import { LanguageToggle } from "@/lib/i18n/language-toggle";

import { CheckInForm } from "./check-in-form";

function EnableMyGrowthLogo({ className }: { className: string }) {
  return (
    <Image
      src="/emg/logo-dark.png"
      alt="Enable My Growth"
      width={600}
      height={150}
      priority
      className={className}
    />
  );
}

type Props = {
  workshopSlug: string;
  title: string;
  titleAr: string | null;
  eyebrow: string;
  dateRange: string;
  venue: string | null;
};

/**
 * Client wrapper for the whole check-in page body — the page itself
 * (app/r/[slug]/page.tsx) stays a Server Component that only fetches data;
 * everything visible here needs the language toggle's state (hero copy,
 * the experience title, and the form's own labels), so it all lives inside
 * one LanguageProvider rather than threading `language` through props.
 */
export function CheckinPageContent(props: Props) {
  return (
    <LanguageProvider>
      <CheckinPageBody {...props} />
    </LanguageProvider>
  );
}

function CheckinPageBody({ workshopSlug, title, titleAr, eyebrow, dateRange, venue }: Props) {
  const { language } = useLanguage();
  const displayTitle = localize(language, title, titleAr);

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 sm:px-6 sm:py-12 lg:px-12">
      <div className="mb-6 flex justify-end">
        <LanguageToggle />
      </div>

      <div className="grid w-full flex-1 items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <section className="flex flex-col justify-center">
          <div className="mb-10">
            <EnableMyGrowthLogo className="h-auto w-100 max-w-full" />
          </div>

          <p className="mb-3 text-sm uppercase tracking-[0.35em] text-amber-300">{eyebrow}</p>

          <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">{displayTitle}</h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-slate-300">
            {language === "ar" ? (
              <>
                {AR.checkin.welcomeHeading}
                <br />
                {AR.checkin.welcomeSubtitle}
              </>
            ) : (
              <>
                Welcome to Enable My Growth.
                <br />
                We&apos;re delighted to have you with us today. Please complete your check-in using the form.
              </>
            )}
          </p>

          <div className="mt-12 space-y-5 text-lg text-slate-300" dir="ltr">
            <div className="flex items-center gap-4">
              <span className="text-2xl">📅</span>
              <span>{dateRange}</span>
            </div>

            {venue && (
              <div className="flex items-center gap-4">
                <span className="text-2xl">📍</span>
                <span>{venue}</span>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-[0_40px_120px_rgba(0,0,0,0.35)] sm:rounded-[32px] sm:p-10">
          <CheckInForm workshopSlug={workshopSlug} experienceTypeLabel={eyebrow} />
        </section>
      </div>
    </div>
  );
}
