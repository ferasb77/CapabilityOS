import { redirect } from "next/navigation";

import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";
import type { ExperienceStatus } from "@/infrastructure/repositories/dashboard";
import { getExperienceParticipants } from "@/features/experiences/data";
import { getDailyAttendanceSummary } from "@/features/attendance/data";
import { getPrePostComparisonData } from "@/features/surveys/data";
import { getSatisfactionReportData, type SatisfactionReportData } from "@/features/reports/data";
import { getFacilitatorReport } from "@/features/observations/data";

// ---------------------------------------------------------------------------
// Invitation lookup — the /client-portal/accept page has no session yet, so
// this reads through the service-role client (mirroring how acceptInvitation
// itself, in actions.ts, resolves the same row before a session exists).
// ---------------------------------------------------------------------------

export type PendingInvitation = { fullName: string; alreadyAccepted: boolean };

export async function getInvitationByToken(token: string): Promise<PendingInvitation | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("client_portal_users")
    .select("full_name, invitation_accepted_at, is_active")
    .eq("invitation_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !data.is_active) {
    return null;
  }

  return { fullName: data.full_name, alreadyAccepted: Boolean(data.invitation_accepted_at) };
}

// ---------------------------------------------------------------------------
// Operator-side list — "Portal Access" section on the client detail page.
// ---------------------------------------------------------------------------

export type PortalUserStatus = "invited" | "active" | "inactive";

export type PortalUserSummary = {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  status: PortalUserStatus;
  lastSeenAt: string | null;
};

function portalUserStatus(isActive: boolean, invitationAcceptedAt: string | null): PortalUserStatus {
  if (!isActive) return "inactive";
  return invitationAcceptedAt ? "active" : "invited";
}

export async function getClientPortalUsers(clientId: string): Promise<PortalUserSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("client_portal_users")
    .select("id, full_name, email, job_title, is_active, invitation_accepted_at, last_seen_at")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    jobTitle: row.job_title,
    status: portalUserStatus(row.is_active, row.invitation_accepted_at),
    lastSeenAt: row.last_seen_at,
  }));
}

// ---------------------------------------------------------------------------
// Portal user identity
// ---------------------------------------------------------------------------

export type ClientPortalUser = {
  id: string;
  clientId: string;
  clientName: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
};

type ClientPortalUserRow = {
  id: string;
  client_id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  is_active: boolean;
  clients: { name: string } | null;
};

/** A deactivated portal user resolves to null here — the same "no access"
 * outcome as never having been invited, so a revoked contact is locked out
 * the moment is_active flips, with no separate check needed at every call
 * site. */
export async function getClientPortalUser(authUserId: string): Promise<ClientPortalUser | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("client_portal_users")
    .select("id, client_id, full_name, email, job_title, is_active, clients(name)")
    .eq("auth_user_id", authUserId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as ClientPortalUserRow;

  if (!row.is_active) {
    return null;
  }

  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.clients?.name ?? "Your Organization",
    fullName: row.full_name,
    email: row.email,
    jobTitle: row.job_title,
  };
}

/**
 * Every /client-portal page needs this — resolves the signed-in Supabase
 * Auth user against client_portal_users and redirects to the portal login
 * if there's no session or no matching (active) portal user. Mirrors
 * infrastructure/session/session-context.ts's getSessionContext(), which
 * does the same thing for /dashboard against `profiles` — the two are
 * deliberately parallel, not shared, since a dashboard operator and a
 * client contact are different kinds of session with nothing to unify.
 */
export async function getClientPortalSessionContext(): Promise<ClientPortalUser> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-portal/login");
  }

  const portalUser = await getClientPortalUser(user.id);

  if (!portalUser) {
    redirect("/client-portal/login");
  }

  return portalUser;
}

// ---------------------------------------------------------------------------
// Overview — metrics + program list, always scoped to one clientId
// ---------------------------------------------------------------------------

export type ClientProgramSummary = {
  id: string;
  slug: string;
  title: string;
  status: ExperienceStatus;
  startDate: string;
  endDate: string;
  venue: string | null;
  engagementId: string | null;
  engagementTitle: string | null;
  participantCount: number;
  satisfactionScore: number | null;
};

export type ClientOverview = {
  clientName: string;
  totalPrograms: number;
  totalParticipants: number;
  averageSatisfaction: number | null;
  activePrograms: number;
  programs: ClientProgramSummary[];
};

type ClientExperienceRow = {
  id: string;
  slug: string;
  title: string;
  status: ExperienceStatus;
  start_date: string;
  end_date: string;
  venue: string | null;
  engagement_id: string | null;
  engagements: { title: string } | null;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isCurrentlyRunning(status: ExperienceStatus, startDate: string, endDate: string): boolean {
  if (status !== "active") {
    return false;
  }
  const today = new Date().toISOString().slice(0, 10);
  return startDate.slice(0, 10) <= today && today <= endDate.slice(0, 10);
}

export async function getClientOverview(clientId: string): Promise<ClientOverview> {
  const supabase = await createClient();

  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .is("deleted_at", null)
    .maybeSingle();

  if (clientError) {
    throw new Error(clientError.message);
  }

  const clientName = clientRow?.name ?? "Your Organization";

  const { data: experienceRows, error: experiencesError } = await supabase
    .from("experiences")
    .select("id, slug, title, status, start_date, end_date, venue, engagement_id, engagements(title)")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("start_date", { ascending: false });

  if (experiencesError) {
    throw new Error(experiencesError.message);
  }

  const experiences = (experienceRows ?? []) as unknown as ClientExperienceRow[];

  if (experiences.length === 0) {
    return { clientName, totalPrograms: 0, totalParticipants: 0, averageSatisfaction: null, activePrograms: 0, programs: [] };
  }

  const slugs = experiences.map((row) => row.slug);
  const ids = experiences.map((row) => row.id);

  const [{ data: participantRows, error: participantsError }, { data: responseRows, error: responsesError }] =
    await Promise.all([
      supabase.from("participants").select("id, workshop_slug").in("workshop_slug", slugs),
      supabase
        .from("survey_responses")
        .select("overall_rating, workshop_id")
        .in("workshop_id", ids)
        .eq("survey_type", "satisfaction"),
    ]);

  if (participantsError) {
    throw new Error(participantsError.message);
  }
  if (responsesError) {
    throw new Error(responsesError.message);
  }

  const participantCountBySlug = new Map<string, number>();
  for (const row of participantRows ?? []) {
    participantCountBySlug.set(row.workshop_slug, (participantCountBySlug.get(row.workshop_slug) ?? 0) + 1);
  }

  const ratingsByExperienceId = new Map<string, number[]>();
  for (const row of responseRows ?? []) {
    if (row.overall_rating === null) continue;
    const bucket = ratingsByExperienceId.get(row.workshop_id) ?? [];
    bucket.push(row.overall_rating);
    ratingsByExperienceId.set(row.workshop_id, bucket);
  }

  const programs: ClientProgramSummary[] = experiences.map((row) => {
    const ratings = ratingsByExperienceId.get(row.id) ?? [];
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      venue: row.venue,
      engagementId: row.engagement_id,
      engagementTitle: row.engagements?.title ?? null,
      participantCount: participantCountBySlug.get(row.slug) ?? 0,
      satisfactionScore: ratings.length > 0 ? round1(ratings.reduce((sum, v) => sum + v, 0) / ratings.length) : null,
    };
  });

  const allRatings = (responseRows ?? []).map((row) => row.overall_rating).filter((v): v is number => v !== null);

  return {
    clientName,
    totalPrograms: experiences.length,
    totalParticipants: participantRows?.length ?? 0,
    averageSatisfaction: allRatings.length > 0 ? round1(allRatings.reduce((sum, v) => sum + v, 0) / allRatings.length) : null,
    activePrograms: experiences.filter((row) => isCurrentlyRunning(row.status, row.start_date, row.end_date)).length,
    programs,
  };
}

// ---------------------------------------------------------------------------
// Program detail header — ownership is enforced right in the query
// (`.eq("client_id", clientId)`), not checked afterward, so a mismatched
// experienceId simply comes back empty rather than confirming it exists for
// someone else's organization.
// ---------------------------------------------------------------------------

export type ClientExperienceDetail = {
  id: string;
  slug: string;
  title: string;
  status: ExperienceStatus;
  startDate: string;
  endDate: string;
  venue: string | null;
  dailyCheckinEnabled: boolean;
};

export async function getClientExperienceDetail(
  experienceId: string,
  clientId: string
): Promise<ClientExperienceDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("experiences")
    .select("id, slug, title, status, start_date, end_date, venue, daily_checkin_enabled")
    .eq("id", experienceId)
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    status: data.status,
    startDate: data.start_date,
    endDate: data.end_date,
    venue: data.venue,
    dailyCheckinEnabled: data.daily_checkin_enabled,
  };
}

// ---------------------------------------------------------------------------
// Tab 1 — Attendance (no email, no mobile)
// ---------------------------------------------------------------------------

export type ClientAttendanceParticipant = {
  firstName: string;
  lastName: string;
  company: string | null;
  jobTitle: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
};

export type ClientAttendanceDay = {
  date: string;
  dayNumber: number;
  checkedInCount: number;
  totalRegistered: number;
  attendanceRate: number;
};

export type ClientAttendance = {
  totalRegistered: number;
  totalCheckedIn: number;
  checkInRate: number;
  dailyCheckinEnabled: boolean;
  days: ClientAttendanceDay[];
  participants: ClientAttendanceParticipant[];
};

export async function getClientAttendance(experienceId: string): Promise<ClientAttendance> {
  const supabase = await createClient();

  const [{ data: experienceRow }, allParticipants] = await Promise.all([
    supabase.from("experiences").select("daily_checkin_enabled").eq("id", experienceId).maybeSingle(),
    getExperienceParticipants(experienceId),
  ]);

  const dailyCheckinEnabled = experienceRow?.daily_checkin_enabled ?? false;

  const participants: ClientAttendanceParticipant[] = allParticipants.map((participant) => ({
    firstName: participant.firstName,
    lastName: participant.lastName,
    company: participant.company,
    jobTitle: participant.jobTitle,
    checkedIn: participant.checkedIn,
    checkedInAt: participant.checkedIn ? participant.checkedInAt : null,
  }));

  const days: ClientAttendanceDay[] = dailyCheckinEnabled
    ? (await getDailyAttendanceSummary(experienceId))?.days.map((day) => ({
        date: day.date,
        dayNumber: day.dayNumber,
        checkedInCount: day.checkedInCount,
        totalRegistered: day.totalRegistered,
        attendanceRate: day.attendanceRate,
      })) ?? []
    : [];

  const totalRegistered = participants.length;
  const totalCheckedIn = participants.filter((participant) => participant.checkedIn).length;

  return {
    totalRegistered,
    totalCheckedIn,
    checkInRate: totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0,
    dailyCheckinEnabled,
    days,
    participants,
  };
}

// ---------------------------------------------------------------------------
// Tab 2 — Learning Impact (pre/post, fully anonymized)
// ---------------------------------------------------------------------------

export type ClientAnonymizedTextResponses = {
  questionText: string;
  preAnswers: string[];
  postAnswers: string[];
};

export type ClientLearningImpact = {
  configured: boolean;
  preTemplateName: string | null;
  postTemplateName: string | null;
  matchedQuestions: {
    questionText: string;
    questionType: string;
    preAverage: number | null;
    postAverage: number | null;
    preResponseCount: number;
    postResponseCount: number;
    delta: number | null;
  }[];
  nps: { preScore: number | null; postScore: number | null; delta: number | null } | null;
  responseRates: {
    pre: { totalParticipants: number; sent: number; completed: number };
    post: { totalParticipants: number; sent: number; completed: number };
  };
  anonymizedTextResponses: ClientAnonymizedTextResponses[];
};

/**
 * Reuses getPrePostComparisonData (features/surveys/data.ts) but never
 * returns its `individualRows` — those carry participantId/fullName. Open
 * text answers are pulled out of those same rows and regrouped by question,
 * with the participant identity discarded in the process.
 */
export async function getClientLearningImpact(experienceId: string): Promise<ClientLearningImpact> {
  const data = await getPrePostComparisonData(experienceId);

  const textByQuestion = new Map<string, { pre: string[]; post: string[] }>();
  for (const row of data.individualRows) {
    for (const answer of row.answers) {
      if (!answer.preAnswer?.text && !answer.postAnswer?.text) {
        continue;
      }
      const bucket = textByQuestion.get(answer.questionText) ?? { pre: [], post: [] };
      if (answer.preAnswer?.text) bucket.pre.push(answer.preAnswer.text);
      if (answer.postAnswer?.text) bucket.post.push(answer.postAnswer.text);
      textByQuestion.set(answer.questionText, bucket);
    }
  }

  return {
    configured: data.configured,
    preTemplateName: data.preTemplateName,
    postTemplateName: data.postTemplateName,
    matchedQuestions: data.matchedQuestions,
    nps: data.nps,
    responseRates: data.responseRates,
    anonymizedTextResponses: [...textByQuestion.entries()].map(([questionText, value]) => ({
      questionText,
      preAnswers: value.pre,
      postAnswers: value.post,
    })),
  };
}

// ---------------------------------------------------------------------------
// Tab 3 — Satisfaction. getSatisfactionReportData (features/reports/data.ts,
// Sprint 29) already aggregates dimension averages/distributions and
// anonymized open-text feedback with no participant names — built for the
// PDF report, so it's already exactly what the client portal is allowed to
// show.
// ---------------------------------------------------------------------------

export async function getClientSatisfaction(experienceId: string): Promise<SatisfactionReportData | null> {
  return getSatisfactionReportData(experienceId);
}

// ---------------------------------------------------------------------------
// Tab 4 — Facilitator report. Only the approved/exported final report is
// ever reachable from here — facilitator_observations and
// participant_observations are never queried by this module at all.
// ---------------------------------------------------------------------------

export type ClientFacilitatorReport = {
  status: "pending" | "approved" | "exported";
  content: string | null;
  facilitatorName: string | null;
};

export async function getClientFacilitatorReport(experienceId: string): Promise<ClientFacilitatorReport> {
  const report = await getFacilitatorReport(experienceId);

  if (!report || (report.status !== "approved" && report.status !== "exported")) {
    return { status: "pending", content: null, facilitatorName: null };
  }

  return {
    status: report.status,
    content: report.editedContent ?? report.draftContent,
    facilitatorName: report.facilitatorName,
  };
}
