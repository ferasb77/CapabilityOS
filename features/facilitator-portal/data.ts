import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";
import type { ExperienceStatus } from "@/infrastructure/repositories/dashboard";

// ---------------------------------------------------------------------------
// Invitation lookup — /facilitator-portal/accept has no session yet, so this
// reads through the service-role client, mirroring
// features/client-portal/data.ts's getInvitationByToken.
// ---------------------------------------------------------------------------

export type PendingFacilitatorInvitation = { fullName: string; alreadyAccepted: boolean };

export async function getFacilitatorInvitationByToken(token: string): Promise<PendingFacilitatorInvitation | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("facilitators")
    .select("first_name, last_name, invitation_accepted_at, portal_access_active")
    .eq("invitation_token", token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !data.portal_access_active) {
    return null;
  }

  return {
    fullName: `${data.first_name} ${data.last_name}`,
    alreadyAccepted: Boolean(data.invitation_accepted_at),
  };
}

// ---------------------------------------------------------------------------
// Portal identity
// ---------------------------------------------------------------------------

export type FacilitatorPortalUser = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  title: string | null;
  photoUrl: string | null;
};

/** A deactivated portal user (portal_access_active = false) resolves to null
 * — the same "no access" outcome as never having been invited, so revoking
 * portal access locks a facilitator out the moment the flag flips. */
export async function getFacilitatorPortalUser(authUserId: string): Promise<FacilitatorPortalUser | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("facilitators")
    .select("id, first_name, last_name, email, title, photo_url, portal_access_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !data.portal_access_active) {
    return null;
  }

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    fullName: `${data.first_name} ${data.last_name}`,
    email: data.email,
    title: data.title,
    photoUrl: data.photo_url,
  };
}

/**
 * Every /facilitator-portal page needs this — resolves the signed-in
 * Supabase Auth user against `facilitators` and redirects to the shared
 * /login page if there's no session or no matching (portal-active)
 * facilitator. Mirrors getClientPortalSessionContext
 * (features/client-portal/data.ts), except facilitators sign in through the
 * same /login page operators use (CLAUDE.md brief), not a portal-specific
 * login route.
 */
export const getFacilitatorPortalSessionContext = cache(async (): Promise<FacilitatorPortalUser> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const portalUser = await getFacilitatorPortalUser(user.id);

  if (!portalUser) {
    redirect("/login");
  }

  return portalUser;
});

// ---------------------------------------------------------------------------
// Portal access status — read by the operator-facing "Portal Access"
// section on /dashboard/facilitators/[id] (CLAUDE.md: "Status: Not Invited
// / Invited (pending) / Active / Inactive").
// ---------------------------------------------------------------------------

export type FacilitatorPortalAccessStatus = "not_invited" | "invited" | "active" | "inactive";

export type FacilitatorPortalAccess = {
  status: FacilitatorPortalAccessStatus;
  invitedAt: string | null;
  invitationAcceptedAt: string | null;
};

export async function getFacilitatorPortalAccessStatus(facilitatorId: string): Promise<FacilitatorPortalAccess> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("facilitators")
    .select("invited_at, invitation_accepted_at, portal_access_active")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !data.invited_at) {
    return { status: "not_invited", invitedAt: null, invitationAcceptedAt: data?.invitation_accepted_at ?? null };
  }

  let status: FacilitatorPortalAccessStatus;
  if (!data.portal_access_active) {
    status = "inactive";
  } else if (!data.invitation_accepted_at) {
    status = "invited";
  } else {
    status = "active";
  }

  return { status, invitedAt: data.invited_at, invitationAcceptedAt: data.invitation_accepted_at };
}

// ---------------------------------------------------------------------------
// Assigned experiences — scoped by matching facilitator.email to
// experiences.facilitator_email, same free-text match
// getFacilitatorDeliveryHistory (features/facilitators/data.ts) uses for the
// operator-facing delivery history panel.
// ---------------------------------------------------------------------------

export type FacilitatorAssignedExperience = {
  id: string;
  slug: string;
  title: string;
  status: ExperienceStatus;
  /** Date-only (YYYY-MM-DD), sliced from experiences.start_date (timestamptz)
   * — every consumer here (calendar keying, tone, stats) compares these as
   * plain dates, same as facilitator_unavailability's own date columns. */
  startDate: string;
  endDate: string;
  venue: string | null;
  clientName: string | null;
  participantCount: number;
  satisfactionScore: number | null;
};

type AssignedExperienceRow = {
  id: string;
  slug: string;
  title: string;
  status: ExperienceStatus;
  start_date: string;
  end_date: string;
  venue: string | null;
  facilitator_email: string | null;
  clients: { name: string } | null;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function getFacilitatorAssignedExperiences(
  facilitatorEmail: string
): Promise<FacilitatorAssignedExperience[]> {
  const supabase = await createClient();

  const { data: experienceRows, error: experiencesError } = await supabase
    .from("experiences")
    .select("id, slug, title, status, start_date, end_date, venue, facilitator_email, clients(name)")
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  if (experiencesError) {
    throw new Error(experiencesError.message);
  }

  const normalizedEmail = facilitatorEmail.toLowerCase();
  const matched = ((experienceRows ?? []) as unknown as AssignedExperienceRow[]).filter(
    (row) => row.facilitator_email?.toLowerCase() === normalizedEmail
  );

  if (matched.length === 0) {
    return [];
  }

  const slugs = matched.map((row) => row.slug);
  const ids = matched.map((row) => row.id);

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

  return matched.map((row) => {
    const ratings = ratingsByExperienceId.get(row.id) ?? [];
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      startDate: row.start_date.slice(0, 10),
      endDate: row.end_date.slice(0, 10),
      venue: row.venue,
      clientName: row.clients?.name ?? null,
      participantCount: participantCountBySlug.get(row.slug) ?? 0,
      satisfactionScore: ratings.length > 0 ? round1(ratings.reduce((sum, v) => sum + v, 0) / ratings.length) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Stats summary — the four figures shown above the calendar/list on My
// Programs (CLAUDE.md: "Total assigned … Upcoming (next 30 days) …
// Completed this year … Average satisfaction score across all delivered
// experiences"). Derived from the same assigned-experiences query rather
// than a separate aggregate query.
// ---------------------------------------------------------------------------

export type FacilitatorPortalStats = {
  totalAssigned: number;
  upcomingNext30Days: number;
  completedThisYear: number;
  averageSatisfaction: number | null;
};

export async function getFacilitatorPortalStats(facilitatorEmail: string): Promise<FacilitatorPortalStats> {
  const experiences = await getFacilitatorAssignedExperiences(facilitatorEmail);

  const today = todayIso();
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const in30DaysIso = in30Days.toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();

  const upcomingNext30Days = experiences.filter(
    (experience) => experience.startDate >= today && experience.startDate <= in30DaysIso
  ).length;

  const completedThisYear = experiences.filter(
    (experience) => experience.status === "completed" && new Date(`${experience.startDate}T00:00:00`).getFullYear() === currentYear
  ).length;

  const satisfactionScores = experiences
    .map((experience) => experience.satisfactionScore)
    .filter((score): score is number => score !== null);

  return {
    totalAssigned: experiences.length,
    upcomingNext30Days,
    completedThisYear,
    averageSatisfaction:
      satisfactionScores.length > 0
        ? round1(satisfactionScores.reduce((sum, v) => sum + v, 0) / satisfactionScores.length)
        : null,
  };
}

// ---------------------------------------------------------------------------
// Experience detail — for the slide-over. Ownership is enforced in the
// query itself (matching facilitator_email), not checked afterward, so a
// mismatched experienceId simply comes back empty rather than confirming it
// exists for someone else's assignment.
// ---------------------------------------------------------------------------

export type FacilitatorExperienceDetail = {
  id: string;
  slug: string;
  title: string;
  status: ExperienceStatus;
  startDate: string;
  endDate: string;
  venue: string | null;
  clientName: string | null;
  engagementTitle: string | null;
  participantCount: number;
  checkedInCount: number;
  checkInRate: number;
  satisfactionScore: number | null;
};

export async function getFacilitatorExperienceDetail(
  experienceId: string,
  facilitatorEmail: string
): Promise<FacilitatorExperienceDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("experiences")
    .select(
      "id, slug, title, status, start_date, end_date, venue, facilitator_email, clients(name), engagements(title)"
    )
    .eq("id", experienceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  type Row = {
    id: string;
    slug: string;
    title: string;
    status: ExperienceStatus;
    start_date: string;
    end_date: string;
    venue: string | null;
    facilitator_email: string | null;
    clients: { name: string } | null;
    engagements: { title: string } | null;
  };

  const row = data as unknown as Row | null;

  if (!row || row.facilitator_email?.toLowerCase() !== facilitatorEmail.toLowerCase()) {
    return null;
  }

  const [{ data: participantRows, error: participantsError }, { data: responseRows, error: responsesError }] =
    await Promise.all([
      supabase.from("participants").select("id, checked_in").eq("workshop_slug", row.slug),
      supabase
        .from("survey_responses")
        .select("overall_rating")
        .eq("workshop_id", row.id)
        .eq("survey_type", "satisfaction"),
    ]);

  if (participantsError) {
    throw new Error(participantsError.message);
  }
  if (responsesError) {
    throw new Error(responsesError.message);
  }

  const participants = participantRows ?? [];
  const checkedInCount = participants.filter((p) => p.checked_in).length;
  const ratings = (responseRows ?? [])
    .map((r) => r.overall_rating)
    .filter((v): v is number => v !== null);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    startDate: row.start_date.slice(0, 10),
    endDate: row.end_date.slice(0, 10),
    venue: row.venue,
    clientName: row.clients?.name ?? null,
    engagementTitle: row.engagements?.title ?? null,
    participantCount: participants.length,
    checkedInCount,
    checkInRate: participants.length > 0 ? Math.round((checkedInCount / participants.length) * 100) : 0,
    satisfactionScore: ratings.length > 0 ? round1(ratings.reduce((sum, v) => sum + v, 0) / ratings.length) : null,
  };
}

// ---------------------------------------------------------------------------
// Unavailability — read by both the facilitator portal (own blocks) and the
// operator-facing facilitator detail page (read-only "Availability" section).
// ---------------------------------------------------------------------------

export type FacilitatorUnavailabilityBlock = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  isPast: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getFacilitatorUnavailability(facilitatorId: string): Promise<FacilitatorUnavailabilityBlock[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("facilitator_unavailability")
    .select("id, start_date, end_date, reason")
    .eq("facilitator_id", facilitatorId)
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const today = todayIso();

  return (data ?? []).map((row) => ({
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    isPast: row.end_date < today,
  }));
}

export type UnavailabilityConflict = {
  hasConflict: boolean;
  blocks: { startDate: string; endDate: string; reason: string | null }[];
};

/**
 * The inverse check from checkAvailabilityConflict below — this asks "does
 * the facilitator have an unavailability block covering these dates",
 * used by the operator's experience assignment form (CLAUDE.md: "if a
 * facilitator has an unavailability block covering the experience dates,
 * show a warning in the assignment UI").
 */
export async function getFacilitatorUnavailabilityConflict(
  facilitatorId: string,
  startDate: string,
  endDate: string
): Promise<UnavailabilityConflict> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("facilitator_unavailability")
    .select("start_date, end_date, reason")
    .eq("facilitator_id", facilitatorId)
    .is("deleted_at", null)
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (error) {
    throw new Error(error.message);
  }

  return {
    hasConflict: (data ?? []).length > 0,
    blocks: (data ?? []).map((row) => ({ startDate: row.start_date, endDate: row.end_date, reason: row.reason })),
  };
}

// ---------------------------------------------------------------------------
// Availability conflict check — used both by the "Mark unavailable" flow
// (warn, don't block) and, per CLAUDE.md's brief, by the operator's
// experience assignment UI.
// ---------------------------------------------------------------------------

export type AvailabilityConflict = {
  hasConflict: boolean;
  experiences: { id: string; title: string; startDate: string; endDate: string }[];
};

export async function checkAvailabilityConflict(
  facilitatorId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilityConflict> {
  const supabase = await createClient();

  const { data: facilitatorRow, error: facilitatorError } = await supabase
    .from("facilitators")
    .select("email")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (facilitatorError) {
    throw new Error(facilitatorError.message);
  }

  if (!facilitatorRow) {
    return { hasConflict: false, experiences: [] };
  }

  const { data: experienceRows, error: experiencesError } = await supabase
    .from("experiences")
    .select("id, title, start_date, end_date, facilitator_email")
    .is("deleted_at", null)
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (experiencesError) {
    throw new Error(experiencesError.message);
  }

  const normalizedEmail = facilitatorRow.email.toLowerCase();
  const conflicting = (experienceRows ?? []).filter(
    (row) => row.facilitator_email?.toLowerCase() === normalizedEmail
  );

  return {
    hasConflict: conflicting.length > 0,
    experiences: conflicting.map((row) => ({
      id: row.id,
      title: row.title,
      startDate: row.start_date,
      endDate: row.end_date,
    })),
  };
}
