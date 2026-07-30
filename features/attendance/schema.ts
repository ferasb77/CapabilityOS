import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

export const manualAttendanceSchema = z.object({
  experienceId: z.string().uuid(),
  participantId: z.string().uuid(),
  attendanceDate: isoDate,
  notes: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().optional()
  ),
});

export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;

export const dailyCheckInSchema = z.object({
  workshopSlug: z.string().trim().min(1, "Experience is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export type DailyCheckInInput = z.infer<typeof dailyCheckInSchema>;
