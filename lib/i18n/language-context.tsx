"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Language } from "./ar";

const STORAGE_KEY = "capabilityos:language";

// A module-level pub-sub instead of a useEffect that reads localStorage on
// mount: useSyncExternalStore renders the server snapshot ("en") on both
// the server and the client's first (hydration) pass, then synchronously
// swaps in the real localStorage value right after — no hydration mismatch,
// and no direct setState call inside an effect body to trip
// react-hooks/set-state-in-effect.
const listeners = new Set<() => void>();

function getSnapshot(): Language {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "ar" ? "ar" : "en";
}

function getServerSnapshot(): Language {
  return "en";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeLanguage(next: Language) {
  window.localStorage.setItem(STORAGE_KEY, next);
  for (const listener of listeners) {
    listener();
  }
}

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
};

// Defaults to English/no-op rather than requiring a provider — several
// components under features/surveys (the question renderer, the template
// preview dialog) are shared between the Arabic-aware public survey page
// and the English-only dashboard, and the dashboard never mounts a
// provider. Falling back to plain English there is exactly the desired
// behavior, not a bug to guard against.
const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
});

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

/** Reads en/ar text based on the current language, falling back to English
 * whenever the Arabic value is missing — the one rule every Arabic surface
 * in this sprint shares (English is always available, Arabic never is). */
export function localize(language: Language, en: string, ar: string | null | undefined): string {
  return language === "ar" && ar ? ar : en;
}

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Scoped to a single page tree (check-in, survey) — never mounted in the
 * dashboard layout, which is why the RTL/Cairo switch below is safe to tie
 * directly to this provider's own wrapping element instead of the <html>
 * root. State is localStorage-backed (not the URL, not the database) per
 * the sprint's architecture rule.
 */
export function LanguageProvider({ children, className }: Props) {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLanguage = useCallback((next: Language) => writeLanguage(next), []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <div dir={language === "ar" ? "rtl" : "ltr"} className={cn(language === "ar" && "font-cairo", className)}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}
