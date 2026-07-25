import { createClient } from "@/infrastructure/supabase/server";
import { getAssetConflicts, getLowStockAssets } from "@/features/assets/data";
import { getSessionContext } from "@/infrastructure/session/session-context";

export type ExperienceStatus = "draft" | "active" | "completed" | "cancelled";

export type DashboardStats = {
  activeEngagements: number;
  totalParticipants: number;
  checkedIn: number;
  totalClients: number;
};

export type ExperienceSummary = {
  id: string;
  slug: string;
  title: string;
  venue: string | null;
  startDate: string;
  endDate: string;
  status: ExperienceStatus;
  capacity: number;
  clientName: string | null;
  engagementTitle: string | null;
  participantCount: number;
  checkedInCount: number;
};

export type ParticipantSummary = {
  id: string;
  fullName: string;
  company: string | null;
  jobTitle: string | null;
  experienceTitle: string | null;
  checkedIn: boolean;
  createdAt: string;
};

export type AttentionReason =
  | "low_registration"
  | "no_participants"
  | "survey_not_sent"
  | "survey_partially_sent"
  | "engagement_no_experiences"
  | "asset_conflict"
  | "low_stock";

export type AttentionItem = {
  id: string;
  title: string;
  reason: AttentionReason;
  detail: string;
};

export type DashboardData = {
  stats: DashboardStats;
  recentExperiences: ExperienceSummary[];
  recentParticipants: ParticipantSummary[];
  attentionItems: AttentionItem[];
};

type ExperienceRow = {
  id: string;
  slug: string;
  title: string;
  venue: string | null;
  start_date: string;
  end_date: string;
  capacity: number;
  status: ExperienceStatus;
  engagement_id: string | null;
  clients: { name: string } | null;
  engagements: { title: string } | null;
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

type EngagementRow = {
  id: string;
  title: string;
  status: string;
};

type SurveyTokenRow = {
  workshop_id: string;
  participant_id: string;
};

const RECENT_PARTICIPANTS_LIMIT = 10;
const RECENT_EXPERIENCES_LIMIT = 10;
const LOW_REGISTRATION_DAYS_TO_START = 7;
const LOW_REGISTRATION_CAPACITY_THRESHOLD = 0.5;
const MS_PER_DAY = 86_400_000;

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const session = await getSessionContext();

  const [
    experiencesResult,
    participantsResult,
    surveyTokensResult,
    clientsResult,
    engagementsResult,
    lowStockAssets,
    assetConflicts,
  ] = await Promise.all([
    supabase
      .from("experiences")
      .select(
        "id, slug, title, venue, start_date, end_date, capacity, status, engagement_id, clients(name), engagements(title)"
      )
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
    supabase
      .from("participants")
      .select(
        "id, workshop_slug, first_name, last_name, company, job_title, checked_in, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase.from("survey_tokens").select("workshop_id, participant_id").eq("survey_type", "satisfaction"),
    supabase.from("clients").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("engagements").select("id, title, status").is("deleted_at", null),
    getLowStockAssets(session.workspaceId),
    getAssetConflicts(session.workspaceId),
  ]);

  if (experiencesResult.error) {
    throw new Error(experiencesResult.error.message);
  }

  if (participantsResult.error) {
    throw new Error(participantsResult.error.message);
  }

  if (surveyTokensResult.error) {
    throw new Error(surveyTokensResult.error.message);
  }

  if (clientsResult.error) {
    throw new Error(clientsResult.error.message);
  }

  if (engagementsResult.error) {
    throw new Error(engagementsResult.error.message);
  }

  const experiences = (experiencesResult.data ?? []) as unknown as ExperienceRow[];
  const participants: ParticipantRow[] = participantsResult.data ?? [];
  const surveyTokens: SurveyTokenRow[] = surveyTokensResult.data ?? [];
  const engagements: EngagementRow[] = engagementsResult.data ?? [];

  const surveyedParticipantIdsByExperienceId = new Map<string, Set<string>>();
  for (const token of surveyTokens) {
    const bucket = surveyedParticipantIdsByExperienceId.get(token.workshop_id) ?? new Set<string>();
    bucket.add(token.participant_id);
    surveyedParticipantIdsByExperienceId.set(token.workshop_id, bucket);
  }

  const participantsBySlug = new Map<string, ParticipantRow[]>();
  for (const participant of participants) {
    const bucket = participantsBySlug.get(participant.workshop_slug) ?? [];
    bucket.push(participant);
    participantsBySlug.set(participant.workshop_slug, bucket);
  }

  const experienceTitleBySlug = new Map(experiences.map((e) => [e.slug, e.title]));

  const allExperiences: ExperienceSummary[] = experiences.map((experience) => {
    const experienceParticipants = participantsBySlug.get(experience.slug) ?? [];

    return {
      id: experience.id,
      slug: experience.slug,
      title: experience.title,
      venue: experience.venue,
      startDate: experience.start_date,
      endDate: experience.end_date,
      status: experience.status,
      capacity: experience.capacity,
      clientName: experience.clients?.name ?? null,
      engagementTitle: experience.engagements?.title ?? null,
      participantCount: experienceParticipants.length,
      checkedInCount: experienceParticipants.filter((p) => p.checked_in).length,
    };
  });

  // The dashboard panel only ever displays the 10 most recent — but
  // attention flags below scan every experience regardless of this limit,
  // so an older active experience needing a decision is never silently
  // dropped just because it scrolled off the "recent" list.
  const recentExperiences = allExperiences.slice(0, RECENT_EXPERIENCES_LIMIT);

  const recentParticipants: ParticipantSummary[] = participants
    .slice(0, RECENT_PARTICIPANTS_LIMIT)
    .map((participant) => ({
      id: participant.id,
      fullName: `${participant.first_name} ${participant.last_name}`.trim(),
      company: participant.company,
      jobTitle: participant.job_title,
      experienceTitle: experienceTitleBySlug.get(participant.workshop_slug) ?? null,
      checkedIn: participant.checked_in,
      createdAt: participant.created_at,
    }));

  const attentionItems: AttentionItem[] = [];
  const now = Date.now();

  for (const experience of allExperiences) {
    if (experience.status === "active") {
      const daysToStart = Math.ceil((new Date(experience.startDate).getTime() - now) / MS_PER_DAY);
      const capacityFilled = experience.capacity > 0 ? experience.participantCount / experience.capacity : 1;

      if (
        daysToStart >= 0 &&
        daysToStart <= LOW_REGISTRATION_DAYS_TO_START &&
        capacityFilled < LOW_REGISTRATION_CAPACITY_THRESHOLD
      ) {
        attentionItems.push({
          id: experience.id,
          title: experience.title,
          reason: "low_registration",
          detail: `Low registration — ${daysToStart} day${daysToStart === 1 ? "" : "s"} to start, only ${experience.participantCount} of ${experience.capacity} seats filled`,
        });
      }
    }

    if (experience.participantCount === 0) {
      attentionItems.push({
        id: experience.id,
        title: experience.title,
        reason: "no_participants",
        detail: "No participants registered yet",
      });
    }

    if (experience.status === "completed" && experience.participantCount > 0) {
      const surveyedIds = surveyedParticipantIdsByExperienceId.get(experience.id) ?? new Set<string>();
      const experienceParticipants = participantsBySlug.get(experience.slug) ?? [];
      const surveyedCount = experienceParticipants.filter((p) => surveyedIds.has(p.id)).length;
      const notSurveyedCount = experience.participantCount - surveyedCount;

      if (surveyedCount === 0) {
        attentionItems.push({
          id: experience.id,
          title: experience.title,
          reason: "survey_not_sent",
          detail: "Survey has not been sent to any participant yet",
        });
      } else if (notSurveyedCount > 0) {
        attentionItems.push({
          id: experience.id,
          title: experience.title,
          reason: "survey_partially_sent",
          detail: `${notSurveyedCount} of ${experience.participantCount} participants have not received a survey yet`,
        });
      }
    }
  }

  // Track which engagements already have at least one experience, so the
  // loop below can flag the ones that don't.
  const engagementIdsWithExperiences = new Set<string>();
  for (const experience of experiences) {
    if (experience.engagement_id) {
      engagementIdsWithExperiences.add(experience.engagement_id);
    }
  }

  for (const engagement of engagements) {
    if (engagement.status === "active" && !engagementIdsWithExperiences.has(engagement.id)) {
      attentionItems.push({
        id: engagement.id,
        title: engagement.title,
        reason: "engagement_no_experiences",
        detail: "No experiences linked to this engagement yet",
      });
    }
  }

  for (const asset of lowStockAssets) {
    attentionItems.push({
      id: asset.id,
      title: asset.name,
      reason: "low_stock",
      detail: `${asset.name} is low — ${asset.stockQuantity} ${asset.stockUnit} remaining, reorder ${asset.reorderQuantity ?? asset.reorderThreshold}`,
    });
  }

  for (const conflict of assetConflicts) {
    attentionItems.push({
      id: `${conflict.assetId}-${conflict.experienceAId}-${conflict.experienceBId}`,
      title: conflict.assetName,
      reason: "asset_conflict",
      detail: `Assigned to both ${conflict.experienceATitle} and ${conflict.experienceBTitle} — resolve this conflict`,
    });
  }

  const stats: DashboardStats = {
    activeEngagements: engagements.filter((e) => e.status === "active").length,
    totalParticipants: participants.length,
    checkedIn: participants.filter((p) => p.checked_in).length,
    totalClients: clientsResult.count ?? 0,
  };

  return { stats, recentExperiences, recentParticipants, attentionItems };
}
