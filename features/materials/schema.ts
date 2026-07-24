import { z } from "zod";

export const MATERIAL_TYPES = ["file", "link"] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const MATERIAL_AUDIENCES = ["participant", "facilitator", "both"] as const;
export type MaterialAudience = (typeof MATERIAL_AUDIENCES)[number];

export const MATERIAL_AUDIENCE_LABELS: Record<MaterialAudience, string> = {
  participant: "Participants",
  facilitator: "Facilitators",
  both: "Both",
};

export const AVAILABLE_FROM_OPTIONS = ["registration", "start_date", "manual"] as const;
export type AvailableFrom = (typeof AVAILABLE_FROM_OPTIONS)[number];

export const AVAILABLE_FROM_LABELS: Record<AvailableFrom, string> = {
  registration: "Available on Registration",
  start_date: "Available from Start Date",
  manual: "Released Manually",
};

// The sprint brief specifies a 100MB limit, but this Supabase project's
// plan rejects bucket creation above ~50MB outright (confirmed live:
// createBucket with fileSizeLimit "100MB" fails with "The object exceeded
// the maximum allowed size" before a single file is ever uploaded; "50MB"
// succeeds). Capped here to match the actual environment — raise this (and
// the two bucket fileSizeLimit values in storage.ts) if the Supabase plan
// is upgraded.
export const MAX_MATERIAL_FILE_BYTES = 50 * 1024 * 1024;

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const materialFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    materialType: z.enum(MATERIAL_TYPES),
    url: z.preprocess(emptyToUndefined, z.string().trim().url("Enter a valid URL").optional()),
    audience: z.enum(MATERIAL_AUDIENCES),
    availableFrom: z.enum(AVAILABLE_FROM_OPTIONS).default("registration"),
  })
  .superRefine((data, ctx) => {
    if (data.materialType === "link" && !data.url) {
      ctx.addIssue({ code: "custom", path: ["url"], message: "A URL is required for link materials" });
    }
  });

export type MaterialFormValues = z.infer<typeof materialFormSchema>;
