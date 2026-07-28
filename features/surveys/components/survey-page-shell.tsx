"use client";

import type { ReactNode } from "react";

import { LanguageProvider } from "@/lib/i18n/language-context";
import { LanguageToggle } from "@/lib/i18n/language-toggle";

/**
 * Wraps the public survey page's real content (thank-you, custom form,
 * legacy form) in a LanguageProvider + toggle — mirrors
 * features/participants/components/checkin-page-content.tsx. The
 * server-rendered "invalid link" state (app/survey/[token]/page.tsx) stays
 * outside this, same as the check-in page's "not found" state.
 */
export function SurveyPageShell({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <div className="mb-6 flex justify-end">
        <LanguageToggle />
      </div>
      {children}
    </LanguageProvider>
  );
}
