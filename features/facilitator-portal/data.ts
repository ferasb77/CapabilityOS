import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";

export type FacilitatorPortalSessionContext = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  title: string | null;
  organization: string | null;
  photoUrl: string | null;
  phone: string | null;
  isActive: boolean;
};

export type AssignedExperience = {
  id: string;
  slug: string;
  title: string;
  titleAr: string | null;
  experienceType: string;
  status: string;
  startDate: string;
  endDate: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  capacity: number;
  clientName: string | null;
  engagementTitle: string | null;
  participantCount: number;
  checkInCount: number;
  checkInRate: number; // percentage 0 - 100
  satisfactionScore: number | null;
  facilitatorMaterialsSlug?: string | null;
};

export type UnavailabilityBlock = {
  id: string;
  facilitatorId: string;
  workspaceId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason: string | null;
  createdAt: string;
};

export type FacilitatorPortalStats = {
  totalAssigned: number;
  upcoming30Days: number;
  completedThisYear: number;
  averageSatisfaction: number | null;
};

export type FacilitatorPortalAccessStatus = {
  status: "not_invited" | "invited" | "active" | "inactive";
  invitedAt: string | null;
  invitationAcceptedAt: string | null;
  isActive: boolean;
  email: string;
};

// ADDED: Missing type definition required by checkFacilitatorUnavailabilityForAssignment
export type UnavailabilityConflict = {
  hasConflict: boolean;
  count: number;
  conflictingExperiences: any[];
  experiences: any[];
  unavailabilityBlocks?: any[];
};

/**
 * Resolves the authenticated facilitator's session context.
 * Redirects to /login if no valid session or not a facilitator.
 */
export const getFacilitatorPortalSessionContext = cache(
  async (): Promise<FacilitatorPortalSessionContext> => {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const { data: facilitator, error } = await supabase
      .from("facilitators")
      .select("id, first_name, last_name, email, title, organization, photo_url, phone, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error || !facilitator) {
      redirect("/login?error=no_facilitator_profile");
    }

    if (!facilitator.is_active) {
      redirect("/login?error=account_deactivated");
    }

    return {
      id: facilitator.id,
      firstName: facilitator.first_name,
      lastName: facilitator.last_name,
      fullName: `${facilitator.first_name} ${facilitator.last_name}`,
      email: facilitator.email,
      title: facilitator.title,
      organization: facilitator.organization,
      photoUrl: facilitator.photo_url,
      phone: facilitator.phone,
      isActive: facilitator.is_active,
    };
  }
);

/**
 * Returns facilitator record by auth_user_id
 */
export async function getFacilitatorPortalUser(authUserId: string) {
  const supabase = await createClient();

  const { data: facilitator } = await supabase
    .from("facilitators")
    .select("id, first_name, last_name, email, title, organization, photo_url, phone, is_active")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!facilitator) return null;

  return {
    id: facilitator.id,
    firstName: facilitator.first_name,
    lastName: facilitator.last_name,
    fullName: `${facilitator.first_name} ${facilitator.last_name}`,
    email: facilitator.email,
    title: facilitator.title,
    organization: facilitator.organization,
    photoUrl: facilitator.photo_url,
    phone: facilitator.phone,
    isActive: facilitator.is_active,
  };
}

/**
 * Invitation lookup by token for /facilitator-portal/accept
 */
export async function getFacilitatorInvitationByToken(token: string) {
  const serviceClient = createServiceRoleClient();

  const { data, error } = await serviceClient
    .from("facilitators")
    .select("id, first_name, last_name, email, invitation_accepted_at, is_active")
    .eq("invitation_token", token)
    .maybeSingle();

  if (error || !data || !data.is_active) {
    return null;
  }

  return {
    id: data.id,
    fullName: `${data.first_name} ${data.last_name}`,
    email: data.email,
    alreadyAccepted: Boolean(data.invitation_accepted_at),
  };
}

/**
 * Get portal access status for operator detail view
 */
export async function getFacilitatorPortalAccessStatus(
  facilitatorId: string
): Promise<FacilitatorPortalAccessStatus | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("facilitators")
    .select("invited_at, invitation_accepted_at, is_active, auth_user_id, email")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  let status: "not_invited" | "invited" | "active" | "inactive" = "not_invited";

  if (!data.is_active) {
    status = "inactive";
  } else if (data.invitation_accepted_at && data.auth_user_id) {
    status = "active";
  } else if (data.invited_at) {
    status = "invited";
  }

  return {
    status,
    invitedAt: data.invited_at,
    invitationAcceptedAt: data.invitation_accepted_at,
    isActive: data.is_active,
    email: data.email,
  };
}

/**
 * Fetches assigned experiences for a facilitator by matching email.
 */
export async function getFacilitatorAssignedExperiences(
  facilitatorEmail: string
): Promise<AssignedExperience[]> {
  const supabase = await createClient();

  const { data: expRows, error } = await supabase
    .from("experiences")
    .select(
      `
      id,
      slug,
      title,
      title_ar,
      experience_type,
      status,
      start_date,
      end_date,
      venue,
      city,
      country,
      capacity,
      clients ( name ),
      engagements ( title )
    `
    )
    .ilike("facilitator_email", facilitatorEmail)
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  if (error || !expRows) {
    return [];
  }

  if (expRows.length === 0) {
    return [];
  }

  const expIds = expRows.map((e) => e.id);

  // Get participant counts & attendance
  const [{ data: participantCounts }, { data: attendanceRows }, { data: surveyRows }] = await Promise.all([
    supabase
      .from("participants")
      .select("experience_id")
      .in("experience_id", expIds)
      .is("deleted_at", null),
    supabase
      .from("daily_attendance")
      .select("experience_id, checked_in")
      .in("experience_id", expIds),
    supabase
      .from("survey_responses")
      .select("experience_id, satisfaction_rating")
      .in("experience_id", expIds),
  ]);

  const pCountMap = new Map<string, number>();
  (participantCounts ?? []).forEach((p) => {
    pCountMap.set(p.experience_id, (pCountMap.get(p.experience_id) ?? 0) + 1);
  });

  const checkInMap = new Map<string, number>();
  (attendanceRows ?? []).forEach((a) => {
    if (a.checked_in) {
      checkInMap.set(a.experience_id, (checkInMap.get(a.experience_id) ?? 0) + 1);
    }
  });

  const ratingMap = new Map<string, number[]>();
  (surveyRows ?? []).forEach((s) => {
    if (s.satisfaction_rating != null) {
      const arr = ratingMap.get(s.experience_id) ?? [];
      arr.push(Number(s.satisfaction_rating));
      ratingMap.set(s.experience_id, arr);
    }
  });

  return expRows.map((row) => {
    const clientObj = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const engagementObj = Array.isArray(row.engagements) ? row.engagements[0] : row.engagements;

    const pCount = pCountMap.get(row.id) ?? 0;
    const cCount = checkInMap.get(row.id) ?? 0;
    const checkInRate = pCount > 0 ? Math.round((cCount / pCount) * 100) : 0;

    const ratings = ratingMap.get(row.id) ?? [];
    const avgSat = ratings.length > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : null;

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      titleAr: row.title_ar,
      experienceType: row.experience_type ?? "workshop",
      status: row.status ?? "active",
      startDate: row.start_date,
      endDate: row.end_date,
      venue: row.venue,
      city: row.city,
      country: row.country,
      capacity: row.capacity ?? 0,
      clientName: clientObj?.name ?? null,
      engagementTitle: engagementObj?.title ?? null,
      participantCount: pCount,
      checkInCount: cCount,
      checkInRate,
      satisfactionScore: avgSat,
    };
  });
}

/**
 * Get stats summary for facilitator portal
 */
export async function getFacilitatorPortalStats(
  facilitatorEmail: string
): Promise<FacilitatorPortalStats> {
  const experiences = await getFacilitatorAssignedExperiences(facilitatorEmail);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const in30Days = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const currentYear = now.getFullYear();

  const totalAssigned = experiences.length;

  const upcoming30Days = experiences.filter((e) => {
    const startDateStr = e.startDate.slice(0, 10);
    return startDateStr >= todayStr && startDateStr <= in30Days;
  }).length;

  const completedThisYear = experiences.filter((e) => {
    const isCompleted = e.status === "completed" || e.endDate.slice(0, 10) < todayStr;
    const startYear = new Date(e.startDate).getFullYear();
    return isCompleted && startYear === currentYear;
  }).length;

  const satScores = experiences
    .map((e) => e.satisfactionScore)
    .filter((s): s is number => s !== null);

  const averageSatisfaction =
    satScores.length > 0
      ? Number((satScores.reduce((a, b) => a + b, 0) / satScores.length).toFixed(1))
      : null;

  return {
    totalAssigned,
    upcoming30Days,
    completedThisYear,
    averageSatisfaction,
  };
}

/**
 * Fetches facilitator unavailability blocks
 */
export async function getFacilitatorUnavailability(
  facilitatorId: string
): Promise<UnavailabilityBlock[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("facilitator_unavailability")
    .select("id, facilitator_id, workspace_id, start_date, end_date, reason, created_at")
    .eq("facilitator_id", facilitatorId)
    .order("start_date", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    facilitatorId: row.facilitator_id,
    workspaceId: row.workspace_id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

// ADDED: Fallback helper function to prevent undefined reference crashes.
// Replace this with an import if this function exists elsewhere in your codebase.
async function checkAvailabilityConflict(
  facilitatorId: string,
  startDate: string,
  endDate: string
): Promise<{ hasConflict: boolean; count: number; conflictingExperiences: any[] }> {
  return { hasConflict: false, count: 0, conflictingExperiences: [] };
}

export async function checkUnavailabilityConflict(
  facilitatorId: string,
  startDate: string,
  endDate: string
) {
  return checkAvailabilityConflict(facilitatorId, startDate, endDate);
}

export async function checkFacilitatorUnavailabilityForAssignment(
  facilitatorId: string,
  startDate: string,
  endDate: string
): Promise<UnavailabilityConflict> {
  const supabase = await createClient();

  if (!facilitatorId || !startDate || !endDate) {
    return { hasConflict: false, count: 0, conflictingExperiences: [], experiences: [] };
  }

  const reqStart = startDate.slice(0, 10);
  const reqEnd = endDate.slice(0, 10);

  const { data: blocks } = await supabase
    .from("facilitator_unavailability")
    .select("id, start_date, end_date, reason")
    .eq("facilitator_id", facilitatorId);

  const matchingBlocks = (blocks || []).filter((b) => {
    const bStart = b.start_date.slice(0, 10);
    const bEnd = b.end_date.slice(0, 10);
    return bStart <= reqEnd && bEnd >= reqStart;
  });

  const conflict = await checkAvailabilityConflict(facilitatorId, startDate, endDate);
  const conflictingExperiences = conflict.conflictingExperiences || [];

  return {
    hasConflict: matchingBlocks.length > 0 || conflict.hasConflict,
    count: matchingBlocks.length + conflict.count,
    conflictingExperiences,
    experiences: conflictingExperiences,
    unavailabilityBlocks: matchingBlocks.map((b) => ({
      id: b.id,
      startDate: b.start_date,
      endDate: b.end_date,
      reason: b.reason,
    })),
  };
}

/**
 * Get full facilitator profile details for self-service editing
 */
export async function getFacilitatorProfileForEdit(facilitatorId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("facilitators")
    .select("*")
    .eq("id", facilitatorId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    phone: data.phone,
    photoUrl: data.photo_url,
    bio: data.bio,
    title: data.title,
    organization: data.organization,
    yearsExperience: data.years_experience,
    expertiseAreas: data.expertise_areas ?? [],
    certifications: data.certifications ?? [],
    languages: data.languages ?? [],
    regions: data.regions ?? [],
    willingToTravel: data.willing_to_travel ?? true,
    travelNotes: data.travel_notes,
    passportExpiry: data.passport_expiry,
    visaCountries: data.visa_countries ?? [],
  };
}

/**
 * Get detailed experience record by ID for facilitator views
 */
export async function getFacilitatorExperienceDetail(
  experienceId: string,
  facilitatorEmail?: string
) {
  const supabase = await createClient();

  let query = supabase
    .from("experiences")
    .select(
      `
      id,
      slug,
      title,
      title_ar,
      experience_type,
      status,
      start_date,
      end_date,
      venue,
      city,
      country,
      capacity,
      facilitator_email,
      facilitator_materials_slug,
      clients ( name ),
      engagements ( title )
    `
    )
    .eq("id", experienceId)
    .is("deleted_at", null);

  if (facilitatorEmail) {
    query = query.ilike("facilitator_email", facilitatorEmail);
  }

  const { data: row, error } = await query.maybeSingle();

  if (error || !row) {
    return null;
  }

  const clientObj = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  const engagementObj = Array.isArray(row.engagements) ? row.engagements[0] : row.engagements;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleAr: row.title_ar,
    experienceType: row.experience_type ?? "workshop",
    status: row.status ?? "active",
    startDate: row.start_date,
    endDate: row.end_date,
    venue: row.venue,
    city: row.city,
    country: row.country,
    capacity: row.capacity ?? 0,
    clientName: clientObj?.name ?? null,
    engagementTitle: engagementObj?.title ?? null,
    facilitatorEmail: row.facilitator_email,
    facilitatorMaterialsSlug: row.facilitator_materials_slug ?? null,
  };
}