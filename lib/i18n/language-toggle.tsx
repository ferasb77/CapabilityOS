"use client";

import { cn } from "@/lib/utils";
import { AR } from "./ar";
import { useLanguage } from "./language-context";

type Props = {
  className?: string;
};

/**
 * Two buttons, "English" | "العربية" — always rendered left-to-right
 * regardless of the current language, so switching back to English stays in
 * a predictable spot once the surrounding page has flipped to RTL.
 */
export function LanguageToggle({ className }: Props) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      dir="ltr"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 text-sm backdrop-blur-sm",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        aria-pressed={language === "en"}
        className={cn(
          "rounded-full px-3.5 py-1.5 font-medium transition-colors",
          language === "en" ? "bg-gold text-night" : "text-slate-300 hover:text-white"
        )}
      >
        {AR.common.languageEnglish}
      </button>
      <button
        type="button"
        onClick={() => setLanguage("ar")}
        aria-pressed={language === "ar"}
        className={cn(
          "font-cairo rounded-full px-3.5 py-1.5 font-medium transition-colors",
          language === "ar" ? "bg-gold text-night" : "text-slate-300 hover:text-white"
        )}
      >
        {AR.common.languageArabic}
      </button>
    </div>
  );
}
