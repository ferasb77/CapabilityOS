/**
 * Hardcoded Arabic translations for CapabilityOS's participant-facing
 * surfaces (check-in, survey, certificates). Not fetched from an external
 * service — see CLAUDE.md / Sprint 27: Arabic is scoped to /r/[slug],
 * /survey/[token], /verify/[code], and certificate PDFs only. The operator
 * dashboard stays English-only and never imports from this file.
 */
export const AR = {
  common: {
    languageEnglish: "English",
    languageArabic: "العربية",
    /** Deliberately left in Latin script — it's a meta-label marking the
     * text below it as English, not itself part of the Arabic copy. */
    englishFallbackNote: "(English)",
  },

  checkin: {
    heading: "تسجيل الحضور",
    subtitle: "يرجى إكمال المعلومات أدناه",
    firstNameLabel: "الاسم الأول",
    lastNameLabel: "اسم العائلة",
    firstNameArLabel: "الاسم الأول بالعربية",
    lastNameArLabel: "اسم العائلة بالعربية",
    optionalHint: "اختياري",
    emailLabel: "البريد الإلكتروني",
    mobileLabel: "رقم الجوال",
    companyLabel: "الشركة",
    jobTitleLabel: "المسمى الوظيفي",
    submit: "إتمام التسجيل",
    submitting: "جارٍ التسجيل...",
    welcomeHeading: "أهلاً بكم في Enable My Growth",
    welcomeSubtitle: "يسعدنا تواجدكم معنا اليوم",
    successHeading: "أهلاً بكم!",
    successMessage: "تم تسجيل حضوركم بنجاح.",
    todaysWorkshopLabel: "ورشة اليوم",
    thankYouNote: "شكراً لانضمامكم إلينا.",
    materialsButton: "الوصول إلى مواد البرنامج",
  },

  survey: {
    before: "قبل",
    after: "بعد",
    feedbackOn: "تقييمك لـ",
    satisfactionSubtitle: "تستغرق ملاحظاتك بضع دقائق وتساعدنا على تحسين كل تجربة مستقبلية.",
    preSubtitle: "يساعدنا هذا الاستبيان القصير على فهم نقطة انطلاقك.",
    postSubtitle: "أخبرنا بما تعلمته وكيف ستطبقه.",
    greetingPrefix: "مرحباً",
    submit: "إرسال",
    submitting: "جارٍ الإرسال...",
    thankYouHeading: "شكراً لك",
    responseRecorded: "تم تسجيل إجابتك",
    poor: "ضعيف",
    excellent: "ممتاز",
    yes: "نعم",
    no: "لا",
    requiredTooltip: "هذا الحقل مطلوب",
    // Legacy hardcoded 4-dimension form (features/surveys/components/survey-form.tsx) —
    // only reached when no survey template resolves at all.
    contentQuestion: "كيف تقيّم المحتوى؟",
    facilitatorQuestion: "كيف تقيّم أسلوب تقديم الميسر؟",
    logisticsQuestion: "كيف تقيّم الخدمات اللوجستية والتنظيم؟",
    overallQuestion: "بشكل عام، كيف تقيّم هذه التجربة؟",
    highlightsLabel: "ما الذي وجدته الأكثر فائدة؟",
    improvementsLabel: "ما الذي يمكن تحسينه؟",
    additionalCommentsLabel: "أي تعليقات إضافية؟ (اختياري)",
  },
} as const;

export type Language = "en" | "ar";
