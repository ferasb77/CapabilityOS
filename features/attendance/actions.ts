"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/infrastructure/supabase/server";
import { getSessionContext } from "@/infrastructure/session/session-context";
import { toActionError } from "@/shared/errors/action-error";
import { getReportBranding } from "@/features/reports/data";
import { downloadReportLogo } from "@/features/reports/storage";

import { manualAttendanceSchema, dailyCheckInSchema } from "./schema";
import { getAttendanceForSheet } from "./data";
import { generateAttendanceSheetPdf } from "./report";
import { uploadAttendanceSheet, getAttendanceSheetSignedUrl } from "./storage";

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Manual attendance marking — one participant.
// ---------------------------------------------------------------------------

export type RecordManualAttendanceResult = { success: true } | { success: false; error: string };

export async function recordManualAttendance(
  experienceId: string,
  experienceSlug: string,
  participantId: string,
  attendanceDate: string,
  notes: string | undefined
): Promise<RecordManualAttendanceResult> {
  const parsed = manualAttendanceSchema.safeParse({ experienceId, participantId, attendanceDate, notes });

  if (!parsed.success) {
    return { success: false, error: "Invalid attendance details." };
  }

  const session = await getSessionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("daily_attendance").insert({
    organization_id: session.organizationId,
    workspace_id: session.workspaceId,
    experience_id: parsed.data.experienceId,
    participant_id: parsed.data.participantId,
    attendance_date: parsed.data.attendanceDate,
    check_in_method: "manual",
    notes: parsed.data.notes ?? null,
  });

  if (error) {
    // Already checked in for this date (QR, manual, or self-report) — this
    // action's whole point is "mark present or update the note", so a
    // duplicate-key error updates the note in place rather than failing.
    if (error.code === "23505") {
      const { error: updateError } = await supabase
        .from("daily_attendance")
        .update({ notes: parsed.data.notes ?? null })
        .eq("experience_id", parsed.data.experienceId)
        .eq("participant_id", parsed.data.participantId)
        .eq("attendance_date", parsed.data.attendanceDate);

      if (updateError) {
        return { success: false, error: toActionError(updateError, "attendance") };
      }
    } else {
      return { success: false, error: toActionError(error, "attendance") };
    }
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Mark all registered participants present for a day.
// ---------------------------------------------------------------------------

export type MarkAllPresentResult = { success: true; markedCount: number } | { success: false; error: string };

export async function markAllPresent(
  experienceId: string,
  experienceSlug: string,
  attendanceDate: string
): Promise<MarkAllPresentResult> {
  const session = await getSessionContext();
  const supabase = await createClient();

  const [{ data: participantRows, error: participantsError }, { data: attendanceRows, error: attendanceError }] =
    await Promise.all([
      supabase.from("participants").select("id").eq("workshop_slug", experienceSlug),
      supabase
        .from("daily_attendance")
        .select("participant_id")
        .eq("experience_id", experienceId)
        .eq("attendance_date", attendanceDate)
        .is("deleted_at", null),
    ]);

  if (participantsError) {
    return { success: false, error: toActionError(participantsError, "attendance") };
  }
  if (attendanceError) {
    return { success: false, error: toActionError(attendanceError, "attendance") };
  }

  const alreadyCheckedIn = new Set((attendanceRows ?? []).map((row) => row.participant_id));
  const remaining = (participantRows ?? []).filter((row) => !alreadyCheckedIn.has(row.id));

  if (remaining.length === 0) {
    return { success: true, markedCount: 0 };
  }

  const { error: insertError } = await supabase.from("daily_attendance").insert(
    remaining.map((row) => ({
      organization_id: session.organizationId,
      workspace_id: session.workspaceId,
      experience_id: experienceId,
      participant_id: row.id,
      attendance_date: attendanceDate,
      check_in_method: "manual" as const,
    }))
  );

  if (insertError) {
    return { success: false, error: toActionError(insertError, "attendance") };
  }

  revalidatePath(`/dashboard/experiences/${experienceSlug}`);
  return { success: true, markedCount: remaining.length };
}

// ---------------------------------------------------------------------------
// Printable PDF attendance sheet for a single day.
// ---------------------------------------------------------------------------

export type GenerateAttendanceSheetResult = { success: true; url: string } | { success: false; error: string };

export async function generateAttendanceSheet(
  experienceId: string,
  attendanceDate: string
): Promise<GenerateAttendanceSheetResult> {
  const session = await getSessionContext();

  const [sheetData, branding] = await Promise.all([
    getAttendanceForSheet(experienceId, attendanceDate),
    getReportBranding(session.workspaceId),
  ]);

  if (!sheetData) {
    return { success: false, error: "Experience not found." };
  }

  // A missing or corrupt logo must never block sheet generation — same
  // reasoning as generateSatisfactionReport (features/reports/actions.ts).
  let logoBytes: Uint8Array | null = null;
  if (branding.logoPath) {
    try {
      logoBytes = await downloadReportLogo(branding.logoPath);
    } catch {
      logoBytes = null;
    }
  }

  try {
    const pdfBytes = await generateAttendanceSheetPdf({
      branding: {
        organizationName: branding.organizationName,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        website: branding.website,
        contactEmail: branding.contactEmail,
      },
      logoBytes,
      data: sheetData,
    });

    const path = await uploadAttendanceSheet(experienceId, attendanceDate, pdfBytes);
    const url = await getAttendanceSheetSignedUrl(path);

    return { success: true, url };
  } catch (error) {
    return { success: false, error: toActionError(error, "attendance", "Unable to generate the attendance sheet.") };
  }
}

// ---------------------------------------------------------------------------
// Public daily check-in (returning-participant flow on /r/[slug]).
// ---------------------------------------------------------------------------

type RecordDailyAttendanceRpcResult = {
  success: boolean;
  error?: string;
  already_checked_in?: boolean;
  participant_name?: string;
  attendance_date?: string;
};

export type DailyCheckInResult =
  | { status: "checked_in"; participantName: string; date: string }
  | { status: "already_checked_in"; participantName: string; date: string }
  | { status: "not_registered" }
  | { status: "error"; message: string };

/**
 * The RPC (migration 0026) is security definer and granted to anon, so this
 * runs through the ordinary session-bound client — no session exists for a
 * public visitor, but the RPC itself doesn't need one, matching how
 * get_checkin_context already works for this same anonymous page.
 */
export async function recordDailyCheckIn(workshopSlug: string, email: string): Promise<DailyCheckInResult> {
  const parsed = dailyCheckInSchema.safeParse({ workshopSlug, email });

  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("record_daily_attendance", {
    p_experience_slug: parsed.data.workshopSlug,
    p_participant_email: parsed.data.email,
    p_attendance_date: todayDateOnly(),
  });

  if (error) {
    return { status: "error", message: toActionError(error, "attendance", "Unable to check in. Please try again.") };
  }

  const result = data as RecordDailyAttendanceRpcResult;

  if (!result.success) {
    if (result.error === "Participant not found. Please register first.") {
      return { status: "not_registered" };
    }
    return { status: "error", message: result.error ?? "Unable to check in. Please try again." };
  }

  const participantName = result.participant_name ?? "there";
  const date = result.attendance_date ?? todayDateOnly();

  return result.already_checked_in
    ? { status: "already_checked_in", participantName, date }
    : { status: "checked_in", participantName, date };
}
