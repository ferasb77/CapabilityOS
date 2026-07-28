import { z } from "zod";

import type { ExperienceStatus } from "@/infrastructure/repositories/dashboard";

export const COUNTRIES = [
  "Saudi Arabia",
  "UAE",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Egypt",
  "Jordan",
  "Lebanon",
  "Other",
] as const;

export const EXPERIENCE_TYPES = [
  "workshop",
  "assessment",
  "coaching",
  "community_of_practice",
  "consulting",
  "conference",
  "other",
] as const;

export type ExperienceType = (typeof EXPERIENCE_TYPES)[number];

export const EXPERIENCE_TYPE_LABELS: Record<ExperienceType, string> = {
  workshop: "Workshop",
  assessment: "Assessment",
  coaching: "Coaching",
  community_of_practice: "Community of Practice",
  consulting: "Consulting",
  conference: "Conference",
  other: "Other",
};

// "Cancelled" is deliberately excluded from CREATE_STATUS_OPTIONS (below) —
// a brand-new experience is never created pre-cancelled — but is a real,
// reachable status via editing, so it lives in the full option list here.
export const EXPERIENCE_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Published" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const satisfies readonly { value: ExperienceStatus; label: string }[];

export const CREATE_STATUS_OPTIONS = EXPERIENCE_STATUS_OPTIONS.filter(
  (option) => option.value !== "cancelled"
);

/**
 * Allowed next statuses per current status, keyed by the status an
 * experience is currently in. `completed` and `cancelled` map to only
 * themselves — those experiences render read-only in the edit form, so the
 * question never reaches the dropdown, but `updateExperience` also checks
 * this server-side so the rule holds even if a request bypasses the UI.
 */
export const EXPERIENCE_STATUS_TRANSITIONS: Record<ExperienceStatus, readonly ExperienceStatus[]> = {
  draft: ["draft", "active", "cancelled"],
  active: ["active", "completed", "cancelled", "draft"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

function emptyToUndefined(value: unknown) {
  return value === "" ? undefined : value;
}

const experienceFieldsSchema = z.object({
  // Section 1 — Client and Engagement
  clientId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  engagementId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),

  // Section 2 — Program Details
  title: z.string().trim().min(1, "Title is required"),
  titleAr: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  experienceType: z.enum(EXPERIENCE_TYPES).default("workshop"),
  description: z.string().trim().optional(),
  tags: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  status: z.enum(["draft", "active", "completed", "cancelled"]).default("active"),

  // Section 3 — Schedule and Location
  startDate: z.string().trim().min(1, "Start date is required"),
  endDate: z.string().trim().min(1, "End date is required"),
  venueName: z.string().trim().min(1, "Venue is required"),
  city: z.string().trim().optional(),
  country: z.preprocess(emptyToUndefined, z.enum(COUNTRIES).optional()),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),

  // Section 4 — Facilitator
  facilitatorId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  facilitatorNotes: z.string().trim().optional(),

  // Section 5 — Logistics and Materials
  materialsNotes: z.string().trim().optional(),
  logisticsNotes: z.string().trim().optional(),
});

function withDateOrderRule<T extends typeof experienceFieldsSchema>(schema: T) {
  return schema.refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });
}

// create and update share one field definition (experienceFieldsSchema) —
// every field is already optional except title/startDate/endDate/
// venueName/capacity, which is exactly what's needed on update too, so
// there's nothing to loosen. The one real difference (status must accept
// "cancelled" on edit) lives in the shared base, not a duplicate.
export const createExperienceSchema = withDateOrderRule(experienceFieldsSchema);
export const updateExperienceSchema = withDateOrderRule(experienceFieldsSchema);

export type CreateExperienceInput = z.infer<typeof createExperienceSchema>;
export type UpdateExperienceInput = z.infer<typeof updateExperienceSchema>;
