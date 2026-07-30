import { z } from "zod";

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Enter a hex color like #26215C");

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const reportBrandingSchema = z.object({
  organizationName: z.string().trim().min(1, "Organization name is required"),
  organizationTagline: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  footerText: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  website: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  contactEmail: z.preprocess(emptyToUndefined, z.string().trim().email("Enter a valid email").optional()),
});

export type ReportBrandingFormValues = z.infer<typeof reportBrandingSchema>;

export const REPORT_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const REPORT_LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg"] as const;
