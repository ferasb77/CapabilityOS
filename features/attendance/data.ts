import { createClient } from "@/infrastructure/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// Shared date helpers — experiences store start_date/end_date as
// timestamptz, but attendance is tracked per calendar date, so every
// function here works off the "YYYY-MM-DD" slice of that timestamp rather
// than the full datetime.
// ---------------------------------------------------------------------------

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Inclusive list of "YYYY-MM-DD" dates from start to end. */
function listDatesInclusive(startDate: string, endDate: string): string[] {
  const start = new Date(`${toDateOnly(startDate)}T00:00:00Z`);
  const end = new Date(`${toDateOnly(endDate)}T00:00:00Z`);
  const dates: string[] = [];

  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }

  return dates.length > 0 ? dates : [toDateOnly(startDate)];
}

async function resolveExperienceSlug(
  supabase: SupabaseServerClient,
  experienceId: string
): Promise<{ slug: string; startDate: string; endDate: string } | null> {
  const { data, error } = await supabase
    .from("experiences")
    .select("slug, start_date, end_date")
    .eq("id", experienceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return { slug: data.slug, startDate: data.start_date, endDate: data.end_date };
}

// ---------------------------------------------------------------------------
// Day-by-day summary — the Attendance tab's main table.
// ---------------------------------------------------------------------------

export type AttendanceDayStatus = "upcoming" | "in_progress" | "complete" | "no_data";

export type AttendanceDaySummary = {
  date: string;
  dayNumber: number;
  checkedInCount: number;
  totalRegistered: number;
  attendanceRate: number;
  status: AttendanceDayStatus;
};

export type DailyAttendanceSummary = {
  experienceId: string;
  totalDays: number;
  today: string;
  days: AttendanceDaySummary[];
};

function dayStatus(date: string, today: string, checkedInCount: number): AttendanceDayStatus {
  if (date > today) {
    return "upcoming";
  }
  if (date === today) {
    return "in_progress";
  }
  return checkedInCount > 0 ? "complete" : "no_data";
}

export async function getDailyAttendanceSummary(experienceId: string): Promise<DailyAttendanceSummary | null> {
  const supabase = await createClient();

  const experience = await resolveExperienceSlug(supabase, experienceId);
  if (!experience) {
    return null;
  }

  const dates = listDatesInclusive(experience.startDate, experience.endDate);
  const today = todayDateOnly();

  const [{ count: totalRegistered }, { data: attendanceRows, error: attendanceError }] = await Promise.all([
    supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("workshop_slug", experience.slug),
    supabase
      .from("daily_attendance")
      .select("attendance_date")
      .eq("experience_id", experienceId)
      .is("deleted_at", null),
  ]);

  if (attendanceError) {
    throw new Error(attendanceError.message);
  }

  const countsByDate = new Map<string, number>();
  for (const row of attendanceRows ?? []) {
    const date = row.attendance_date as string;
    countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
  }

  const registered = totalRegistered ?? 0;

  const days: AttendanceDaySummary[] = dates.map((date, index) => {
    const checkedInCount = countsByDate.get(date) ?? 0;

    return {
      date,
      dayNumber: index + 1,
      checkedInCount,
      totalRegistered: registered,
      attendanceRate: registered > 0 ? Math.round((checkedInCount / registered) * 100) : 0,
      status: dayStatus(date, today, checkedInCount),
    };
  });

  return { experienceId, totalDays: dates.length, today, days };
}

// ---------------------------------------------------------------------------
// Per-day detail — the expanded participant list under a day row.
// ---------------------------------------------------------------------------

export type DailyAttendanceParticipant = {
  participantId: string;
  firstName: string;
  lastName: string;
  company: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  checkInMethod: "qr" | "manual" | "self_report" | null;
  notes: string | null;
};

type AttendanceRow = {
  participant_id: string;
  checked_in_at: string;
  check_in_method: "qr" | "manual" | "self_report";
  notes: string | null;
};

/** A day summary row plus its already-resolved participant list — the shape
 * the Attendance tab renders, composed once in the page/data layer so the
 * client-side day row never needs its own fetch just to expand. */
export type AttendanceTabDay = AttendanceDaySummary & { participants: DailyAttendanceParticipant[] };

export async function getDailyAttendanceDetail(
  experienceId: string,
  date: string
): Promise<DailyAttendanceParticipant[] | null> {
  const supabase = await createClient();

  const experience = await resolveExperienceSlug(supabase, experienceId);
  if (!experience) {
    return null;
  }

  const [{ data: participantRows, error: participantsError }, { data: attendanceRows, error: attendanceError }] =
    await Promise.all([
      supabase
        .from("participants")
        .select("id, first_name, last_name, company")
        .eq("workshop_slug", experience.slug)
        .order("first_name", { ascending: true }),
      supabase
        .from("daily_attendance")
        .select("participant_id, checked_in_at, check_in_method, notes")
        .eq("experience_id", experienceId)
        .eq("attendance_date", date)
        .is("deleted_at", null),
    ]);

  if (participantsError) {
    throw new Error(participantsError.message);
  }
  if (attendanceError) {
    throw new Error(attendanceError.message);
  }

  const attendanceByParticipantId = new Map<string, AttendanceRow>();
  for (const row of (attendanceRows ?? []) as AttendanceRow[]) {
    attendanceByParticipantId.set(row.participant_id, row);
  }

  return (participantRows ?? []).map((row) => {
    const attendance = attendanceByParticipantId.get(row.id);

    return {
      participantId: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      company: row.company,
      checkedIn: Boolean(attendance),
      checkedInAt: attendance?.checked_in_at ?? null,
      checkInMethod: attendance?.check_in_method ?? null,
      notes: attendance?.notes ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Attendance sheet source data — one row per registered participant,
// regardless of whether they checked in, for the printable PDF.
// ---------------------------------------------------------------------------

export type AttendanceSheetParticipant = {
  firstName: string;
  lastName: string;
  company: string | null;
  jobTitle: string | null;
  checkedInAt: string | null;
};

export type AttendanceSheetData = {
  experienceTitle: string;
  clientName: string | null;
  venue: string | null;
  facilitatorName: string | null;
  date: string;
  dayNumber: number;
  totalDays: number;
  participants: AttendanceSheetParticipant[];
};

type SheetExperienceRow = {
  title: string;
  client_name: string | null;
  venue: string | null;
  facilitator_name: string | null;
  start_date: string;
  end_date: string;
  slug: string;
  clients: { name: string } | null;
};

export async function getAttendanceForSheet(experienceId: string, date: string): Promise<AttendanceSheetData | null> {
  const supabase = await createClient();

  const { data: experienceRow, error: experienceError } = await supabase
    .from("experiences")
    .select("title, client_name, venue, facilitator_name, start_date, end_date, slug, clients(name)")
    .eq("id", experienceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (experienceError) {
    throw new Error(experienceError.message);
  }

  if (!experienceRow) {
    return null;
  }

  const experience = experienceRow as unknown as SheetExperienceRow;
  const dates = listDatesInclusive(experience.start_date, experience.end_date);
  const dayNumber = Math.max(dates.indexOf(date) + 1, 1);

  const [{ data: participantRows, error: participantsError }, { data: attendanceRows, error: attendanceError }] =
    await Promise.all([
      supabase
        .from("participants")
        .select("id, first_name, last_name, company, job_title")
        .eq("workshop_slug", experience.slug)
        .order("first_name", { ascending: true }),
      supabase
        .from("daily_attendance")
        .select("participant_id, checked_in_at")
        .eq("experience_id", experienceId)
        .eq("attendance_date", date)
        .is("deleted_at", null),
    ]);

  if (participantsError) {
    throw new Error(participantsError.message);
  }
  if (attendanceError) {
    throw new Error(attendanceError.message);
  }

  const checkedInAtByParticipantId = new Map<string, string>();
  for (const row of attendanceRows ?? []) {
    checkedInAtByParticipantId.set(row.participant_id, row.checked_in_at);
  }

  const participants: AttendanceSheetParticipant[] = (participantRows ?? []).map((row) => ({
    firstName: row.first_name,
    lastName: row.last_name,
    company: row.company,
    jobTitle: row.job_title,
    checkedInAt: checkedInAtByParticipantId.get(row.id) ?? null,
  }));

  return {
    experienceTitle: experience.title,
    clientName: experience.clients?.name ?? experience.client_name,
    venue: experience.venue,
    facilitatorName: experience.facilitator_name,
    date,
    dayNumber,
    totalDays: dates.length,
    participants,
  };
}
