import { createClient } from "@/infrastructure/supabase/server";

export type WorkshopStatus = "draft" | "active" | "completed" | "cancelled";

export type DashboardStats = {
  totalWorkshops: number;
  totalParticipants: number;
  checkedIn: number;
  activeWorkshops: number;
};

export type WorkshopSummary = {
  id: string;
  slug: string;
  title: string;
  venue: string | null;
  startDate: string;
  endDate: string;
  status: WorkshopStatus;
  capacity: number;
  participantCount: number;
  checkedInCount: number;
};

export type ParticipantSummary = {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  workshopTitle: string | null;
  checkedIn: boolean;
  createdAt: string;
};

export type AttentionReason = "capacity_remaining" | "no_participants" | "survey_not_sent";

export type AttentionItem = {
  workshopId: string;
  title: string;
  reason: AttentionReason;
  detail: string;
};

export type DashboardData = {
  stats: DashboardStats;
  recentWorkshops: WorkshopSummary[];
  recentParticipants: ParticipantSummary[];
  attentionItems: AttentionItem[];
};

type WorkshopRow = {
  id: string;
  slug: string;
  title: string;
  venue: string | null;
  start_date: string;
  end_date: string;
  capacity: number;
  status: WorkshopStatus;
};

type ParticipantRow = {
  id: string;
  workshop_slug: string;
  first_name: string;
  last_name: string;
  company: string | null;
  job_title: string | null;
  checked_in: boolean;
  created_at: string;
};

const RECENT_PARTICIPANTS_LIMIT = 10;

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const [workshopsResult, participantsResult, surveyTokensResult] = await Promise.all([
    supabase
      .from("workshops")
      .select("id, title, venue, start_date, end_date, capacity, status, slug")
      .order("start_date", { ascending: false }),
    supabase
      .from("participants")
      .select(
        "id, workshop_slug, first_name, last_name, company, job_title, checked_in, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase.from("survey_tokens").select("workshop_id"),
  ]);

  if (workshopsResult.error) {
    throw new Error(workshopsResult.error.message);
  }

  if (participantsResult.error) {
    throw new Error(participantsResult.error.message);
  }

  if (surveyTokensResult.error) {
    throw new Error(surveyTokensResult.error.message);
  }

  const workshops: WorkshopRow[] = workshopsResult.data ?? [];
  const participants: ParticipantRow[] = participantsResult.data ?? [];
  const workshopIdsWithSurveysSent = new Set(
    (surveyTokensResult.data ?? []).map((token) => token.workshop_id)
  );

  const participantsBySlug = new Map<string, ParticipantRow[]>();
  for (const participant of participants) {
    const bucket = participantsBySlug.get(participant.workshop_slug) ?? [];
    bucket.push(participant);
    participantsBySlug.set(participant.workshop_slug, bucket);
  }

  const workshopTitleBySlug = new Map(workshops.map((w) => [w.slug, w.title]));

  const recentWorkshops: WorkshopSummary[] = workshops.map((workshop) => {
    const workshopParticipants = participantsBySlug.get(workshop.slug) ?? [];

    return {
      id: workshop.id,
      slug: workshop.slug,
      title: workshop.title,
      venue: workshop.venue,
      startDate: workshop.start_date,
      endDate: workshop.end_date,
      status: workshop.status,
      capacity: workshop.capacity,
      participantCount: workshopParticipants.length,
      checkedInCount: workshopParticipants.filter((p) => p.checked_in).length,
    };
  });

  const recentParticipants: ParticipantSummary[] = participants
    .slice(0, RECENT_PARTICIPANTS_LIMIT)
    .map((participant) => ({
      id: participant.id,
      fullName: `${participant.first_name} ${participant.last_name}`.trim(),
      company: participant.company,
      jobTitle: participant.job_title,
      workshopTitle: workshopTitleBySlug.get(participant.workshop_slug) ?? null,
      checkedIn: participant.checked_in,
      createdAt: participant.created_at,
    }));

  const attentionItems: AttentionItem[] = [];

  for (const workshop of recentWorkshops) {
    if (workshop.status === "active" && workshop.participantCount < workshop.capacity) {
      attentionItems.push({
        workshopId: workshop.id,
        title: workshop.title,
        reason: "capacity_remaining",
        detail: `${workshop.capacity - workshop.participantCount} of ${workshop.capacity} seats open`,
      });
    }

    if (workshop.participantCount === 0) {
      attentionItems.push({
        workshopId: workshop.id,
        title: workshop.title,
        reason: "no_participants",
        detail: "No participants registered yet",
      });
    }

    if (workshop.status === "completed" && !workshopIdsWithSurveysSent.has(workshop.id)) {
      attentionItems.push({
        workshopId: workshop.id,
        title: workshop.title,
        reason: "survey_not_sent",
        detail: "Survey has not been sent to any participant yet",
      });
    }
  }

  const stats: DashboardStats = {
    totalWorkshops: workshops.length,
    totalParticipants: participants.length,
    checkedIn: participants.filter((p) => p.checked_in).length,
    activeWorkshops: workshops.filter((w) => w.status === "active").length,
  };

  return { stats, recentWorkshops, recentParticipants, attentionItems };
}
