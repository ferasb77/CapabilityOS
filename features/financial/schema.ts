import { z } from "zod";

export const MILESTONE_TRIGGER_TYPES = [
  "engagement_signing",
  "experience_completion",
  "engagement_completion",
  "date_based",
  "manual",
] as const;

export type MilestoneTriggerType = (typeof MILESTONE_TRIGGER_TYPES)[number];

export const MILESTONE_TRIGGER_TYPE_LABELS: Record<MilestoneTriggerType, string> = {
  engagement_signing: "On Signing",
  experience_completion: "On Experience",
  engagement_completion: "On Completion",
  date_based: "On Date",
  manual: "Manual",
};

export const MILESTONE_STATUSES = ["pending", "triggered", "invoiced", "collected", "overdue"] as const;

export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  triggered: "Triggered",
  invoiced: "Invoiced",
  collected: "Collected",
  overdue: "Overdue",
};

// Reuse the same currency list as engagements — a milestone's currency
// should realistically always match its parent engagement's, but the
// column is independent (matching the given migration) so the form offers
// the full set rather than silently inheriting it.
export const MILESTONE_CURRENCIES = ["USD", "SAR", "AED", "QAR", "EUR", "GBP"] as const;

export const PAYMENT_TERMS = ["net_30", "net_45", "net_60"] as const;

export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  net_30: "Net 30",
  net_45: "Net 45",
  net_60: "Net 60",
};

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const milestoneFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    currency: z.enum(MILESTONE_CURRENCIES).default("USD"),
    triggerType: z.enum(MILESTONE_TRIGGER_TYPES),
    triggerExperienceId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    triggerDate: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    dueDate: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    financeEmail: z.preprocess(emptyToUndefined, z.string().trim().email("Enter a valid email").optional()),
    notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  })
  .superRefine((data, ctx) => {
    if (data.triggerType === "experience_completion" && !data.triggerExperienceId) {
      ctx.addIssue({
        code: "custom",
        path: ["triggerExperienceId"],
        message: "Choose the experience that triggers this milestone",
      });
    }
    if (data.triggerType === "date_based" && !data.triggerDate) {
      ctx.addIssue({ code: "custom", path: ["triggerDate"], message: "Choose a trigger date" });
    }
  });

export type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;

export const financeContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
  isPrimary: z.boolean().default(false),
});

export type FinanceContactValues = z.infer<typeof financeContactSchema>;

export const financeSettingsSchema = z.object({
  defaultCurrency: z.enum(MILESTONE_CURRENCIES),
  defaultPaymentTerms: z.enum(PAYMENT_TERMS),
});

export type FinanceSettingsValues = z.infer<typeof financeSettingsSchema>;
