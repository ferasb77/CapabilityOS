import { createClient } from "@/infrastructure/supabase/server";
import { getAssetConflicts, getLowStockAssets } from "@/features/assets/data";
import { getSessionContext } from "@/infrastructure/session/session-context";

export type ExperienceStatus = "draft" | "active" | "completed" | "cancelled";

// ---------------------------------------------------------------------------
// Types still consumed elsewhere in the app — unchanged. `ExperienceStatus`
// backs features/experiences/{schema,data,actions}.ts and the status badge;
// `ExperienceSummary` is the prop type for RecentExperiencesPanel, which is
// still used on /dashboard/experiences (only its dashboard-page usage was
// removed in Sprint 25).
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sprint 25 — executive dashboard. Every field below answers one of the four
// governing questions: What is happening? What needs attention? What is
// coming? What has CapabilityOS noticed? (the last one lives in
// features/intelligence/data.ts's getDashboardIntelligenceSummary, called
// separately from the page — this module stays operational, not analytical.)
// ---------------------------------------------------------------------------

export type TimeOfDay = "morning" | "afternoon" | "evening";

export type DashboardGreeting = {
  firstName: string | null;
  timeOfDay: TimeOfDay;
  dateLabel: string;
};

export type AttentionSeverity = "critical" | "upcoming_risk" | "follow_up";

export type AttentionItem = {
  id: string;
  severity: AttentionSeverity;
  headline: string;
  context: string;
  actionLabel: string;
  navigationUrl: string;
};

export type ExperienceReadiness = "ready" | "attention" | "at_risk";

export type UpcomingDeliveryRow = {
  id: string;
  slug: string;
  title: string;
  clientName: string | null;
  startDate: string;
  participantCount: number;
  capacity: number;
  facilitatorName: string | null;
  readiness: ExperienceReadiness;
};

export type ActiveEngagementDetail = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  experiencesDelivered: number;
  experiencesTotal: number;
  nextDeliveryDate: string | null;
  contractValue: number;
};

export type FacilitatorWorkload = {
  id: string | null;
  name: string;
  upcomingCount: number;
  availabilityStatus: string;
  highWorkload: boolean;
};

export type DeliveryHorizonMonth = {
  monthLabel: string;
  year: number;
  month: number;
  count: number;
  isCurrentMonth: boolean;
};

export type PostDeliveryQueueItem = {
  key: string;
  label: string;
  count: number;
  navigationUrl: string;
};

export type DashboardData = {
  greeting: DashboardGreeting;
  operationalPulse: {
    activeEngagements: { count: number; clients: number; value: number };
    upcomingExperiences: { count: number; thisWeek: number; laterThisMonth: number };
    participantsNext30Days: { total: number; confirmed: number; pending: number };
    facilitatorCoverage: { assigned: number; total: number; outstanding: number };
    attentionRequired: { total: number; critical: number; followUp: number };
  };
  attentionBySeverity: {
    critical: AttentionItem[];
    upcomingRisk: AttentionItem[];
    followUp: AttentionItem[];
  };
  upcomingDelivery: UpcomingDeliveryRow[];
  upcomingDeliverySummary: { ready: number; attention: number; atRisk: number };
  activeEngagementsDetail: ActiveEngagementDetail[];
  activeEngagementsTotalCount: number;
  facilitatorCapacity: {
    totalUpcoming: number;
    assigned: number;
    unassigned: number;
    highWorkloadCount: number;
    topFacilitators: FacilitatorWorkload[];
  };
  deliveryHorizon: DeliveryHorizonMonth[];
  postDeliveryQueue: PostDeliveryQueueItem[];
};

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

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
  client_id: string | null;
  facilitator_name: string | null;
  facilitator_email: string | null;
  clients: { name: string } | null;
  engagements: { title: string } | null;
};

type ParticipantRow = {
  id: string;
  workshop_slug: string;
  checked_in: boolean;
};

type EngagementRow = {
  id: string;
  title: string;
  status: string;
  client_id: string;
  contract_value: number | string | null;
  clients: { name: string } | null;
};

type SurveyTokenRow = {
  workshop_id: string;
  participant_id: string;
  completed_at: string | null;
};

type LogisticsTaskRow = {
  workshop_id: string;
  due_date: string | null;
  status: string;
};

type MaterialRow = {
  experience_id: string;
};

type CertificateRow = {
  participant_id: string;
  experience_id: string;
  revoked_at: string | null;
};

type FacilitatorDirectoryRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  availability_status: string;
};

const MS_PER_DAY = 86_400_000;
const LOW_REGISTRATION_CAPACITY_THRESHOLD = 0.5;
const UPCOMING_DELIVERY_LIMIT = 10;
const ACTIVE_ENGAGEMENTS_LIMIT = 5;
const TOP_FACILITATORS_LIMIT = 5;
const HIGH_WORKLOAD_THRESHOLD = 4;
const MAX_FETCH_PAGE = 1000;

/** Supabase/PostgREST caps a plain `.select()` at 1000 rows by default — this
 * dataset's participants table alone runs into the thousands (Sprint 22's
 * 5-year seed), so every table here that can plausibly exceed 1000 rows goes
 * through this pager rather than risk a silent truncation. See
 * features/intelligence/data.ts's fetchAllRows for the same guard. */
async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + MAX_FETCH_PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    allRows.push(...rows);
    if (rows.length < MAX_FETCH_PAGE) break;
    from += MAX_FETCH_PAGE;
  }

  return allRows;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntil(dateStr: string, from: Date): number {
  return Math.floor((startOfDay(new Date(dateStr)).getTime() - from.getTime()) / MS_PER_DAY);
}

function relativeDayLabel(daysToStart: number): string {
  if (daysToStart === 0) return "today";
  if (daysToStart === 1) return "tomorrow";
  return `${daysToStart} days`;
}

/** Greeting hour uses Beirut time (UTC+3) regardless of where the server
 * process itself is deployed — this platform's operators are EMG, so "good
 * morning" should reflect their clock, not the host machine's. */
function beirutTimeOfDay(now: Date): TimeOfDay {
  const beirutHour = (now.getUTCHours() + 3) % 24;
  if (beirutHour < 12) return "morning";
  if (beirutHour < 18) return "afternoon";
  return "evening";
}

function firstNameOf(fullName: string | null): string | null {
  if (!fullName) return null;
  return fullName.trim().split(/\s+/)[0] || null;
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const session = await getSessionContext();
  const now = new Date();
  const today = startOfDay(now);
  const in30Days = new Date(today.getTime() + 30 * MS_PER_DAY);
  const in90Days = new Date(today.getTime() + 90 * MS_PER_DAY);
  const days90Ago = new Date(today.getTime() - 90 * MS_PER_DAY);
  const days7Ago = new Date(today.getTime() - 7 * MS_PER_DAY);

  // ---------------------------------------------------------------------
  // Phase 1 — workspace-wide tables. Filtering for near-term/recent windows
  // happens in JS below so the id sets used to bound phase 2's queries are
  // derived from real data rather than guessed date math on the server.
  // ---------------------------------------------------------------------

  const [experiences, participants, engagementRows, surveyTokens, facilitatorDirectory, lowStockAssets, assetConflicts] =
    await Promise.all([
      fetchAllRows<ExperienceRow>(
        (from, to) =>
          supabase
            .from("experiences")
            .select(
              "id, slug, title, venue, start_date, end_date, capacity, status, engagement_id, client_id, facilitator_name, facilitator_email, clients(name), engagements(title)"
            )
            .is("deleted_at", null)
            .range(from, to) as unknown as PromiseLike<{ data: ExperienceRow[] | null; error: { message: string } | null }>
      ),
      fetchAllRows<ParticipantRow>((from, to) =>
        supabase.from("participants").select("id, workshop_slug, checked_in").range(from, to)
      ),
      fetchAllRows<EngagementRow>(
        (from, to) =>
          supabase
            .from("engagements")
            .select("id, title, status, client_id, contract_value, clients(name)")
            .is("deleted_at", null)
            .range(from, to) as unknown as PromiseLike<{ data: EngagementRow[] | null; error: { message: string } | null }>
      ),
      fetchAllRows<SurveyTokenRow>((from, to) =>
        supabase
          .from("survey_tokens")
          .select("workshop_id, participant_id, completed_at")
          .eq("survey_type", "satisfaction")
          .range(from, to)
      ),
      fetchAllRows<FacilitatorDirectoryRow>((from, to) =>
        supabase
          .from("facilitators")
          .select("id, first_name, last_name, email, availability_status")
          .eq("is_active", true)
          .range(from, to)
      ),
      getLowStockAssets(session.workspaceId),
      getAssetConflicts(session.workspaceId),
    ]);

  const participantsBySlug = new Map<string, ParticipantRow[]>();
  for (const p of participants) {
    const bucket = participantsBySlug.get(p.workshop_slug) ?? [];
    bucket.push(p);
    participantsBySlug.set(p.workshop_slug, bucket);
  }

  const surveyedParticipantIdsByExperienceId = new Map<string, Set<string>>();
  const completedParticipantIdsByExperienceId = new Map<string, Set<string>>();
  for (const token of surveyTokens) {
    const sentBucket = surveyedParticipantIdsByExperienceId.get(token.workshop_id) ?? new Set<string>();
    sentBucket.add(token.participant_id);
    surveyedParticipantIdsByExperienceId.set(token.workshop_id, sentBucket);

    if (token.completed_at) {
      const completedBucket = completedParticipantIdsByExperienceId.get(token.workshop_id) ?? new Set<string>();
      completedBucket.add(token.participant_id);
      completedParticipantIdsByExperienceId.set(token.workshop_id, completedBucket);
    }
  }

  const facilitatorByEmail = new Map(facilitatorDirectory.map((f) => [f.email.toLowerCase(), f]));

  // ---------------------------------------------------------------------
  // Relevant id sets for phase 2 (logistics / materials / certificates) —
  // bounded to the windows those signals actually need, so the follow-up
  // queries stay small instead of scanning every experience on record.
  // ---------------------------------------------------------------------

  const upcoming90 = experiences.filter((e) => {
    if (e.status === "cancelled") return false;
    const start = startOfDay(new Date(e.start_date));
    return start.getTime() >= today.getTime() && start.getTime() <= in90Days.getTime();
  });

  const recentlyCompleted90 = experiences.filter((e) => {
    if (e.status !== "completed") return false;
    const end = startOfDay(new Date(e.end_date));
    return end.getTime() >= days90Ago.getTime() && end.getTime() <= today.getTime();
  });

  const logisticsRelevantIds = [...new Set([...upcoming90, ...recentlyCompleted90].map((e) => e.id))];
  const materialsRelevantIds = [...new Set(upcoming90.map((e) => e.id))];
  const certificatesRelevantIds = [...new Set(recentlyCompleted90.map((e) => e.id))];

  const [logisticsTasks, materials, certificates] = await Promise.all([
    logisticsRelevantIds.length > 0
      ? fetchAllRows<LogisticsTaskRow>((from, to) =>
          supabase
            .from("logistics_tasks")
            .select("workshop_id, due_date, status")
            .in("workshop_id", logisticsRelevantIds)
            .range(from, to)
        )
      : Promise.resolve([] as LogisticsTaskRow[]),
    materialsRelevantIds.length > 0
      ? fetchAllRows<MaterialRow>((from, to) =>
          supabase
            .from("experience_materials")
            .select("experience_id")
            .eq("workspace_id", session.workspaceId)
            .is("deleted_at", null)
            .in("experience_id", materialsRelevantIds)
            .range(from, to)
        )
      : Promise.resolve([] as MaterialRow[]),
    certificatesRelevantIds.length > 0
      ? fetchAllRows<CertificateRow>((from, to) =>
          supabase
            .from("certificates")
            .select("participant_id, experience_id, revoked_at")
            .eq("workspace_id", session.workspaceId)
            .in("experience_id", certificatesRelevantIds)
            .range(from, to)
        )
      : Promise.resolve([] as CertificateRow[]),
  ]);

  type LogisticsSummary = { total: number; complete: number; overdue: number };
  const logisticsByExperienceId = new Map<string, LogisticsSummary>();
  for (const task of logisticsTasks) {
    const summary = logisticsByExperienceId.get(task.workshop_id) ?? { total: 0, complete: 0, overdue: 0 };
    summary.total += 1;
    const isDone = task.status === "completed" || task.status === "not_applicable";
    if (isDone) summary.complete += 1;
    const isOverdue = !isDone && task.due_date !== null && new Date(task.due_date).getTime() < today.getTime();
    if (isOverdue) summary.overdue += 1;
    logisticsByExperienceId.set(task.workshop_id, summary);
  }

  const experienceIdsWithMaterials = new Set(materials.map((m) => m.experience_id));

  const liveCertificateParticipantIdsByExperienceId = new Map<string, Set<string>>();
  for (const cert of certificates) {
    if (cert.revoked_at) continue;
    const bucket = liveCertificateParticipantIdsByExperienceId.get(cert.experience_id) ?? new Set<string>();
    bucket.add(cert.participant_id);
    liveCertificateParticipantIdsByExperienceId.set(cert.experience_id, bucket);
  }

  // ---------------------------------------------------------------------
  // SECTION 0 — greeting
  // ---------------------------------------------------------------------

  const greeting: DashboardGreeting = {
    firstName: firstNameOf(session.fullName),
    timeOfDay: beirutTimeOfDay(now),
    dateLabel: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
  };

  // ---------------------------------------------------------------------
  // SECTION 1 — operational pulse
  // ---------------------------------------------------------------------

  const activeEngagements = engagementRows.filter((e) => e.status === "active");
  const activeEngagementsClients = new Set(activeEngagements.map((e) => e.client_id)).size;
  const activeEngagementsValue = activeEngagements.reduce((sum, e) => sum + Number(e.contract_value ?? 0), 0);

  const upcomingExperiences30 = experiences.filter((e) => {
    if (e.status !== "active" && e.status !== "draft") return false;
    const start = startOfDay(new Date(e.start_date));
    return start.getTime() >= today.getTime() && start.getTime() <= in30Days.getTime();
  });
  const upcomingThisWeek = upcomingExperiences30.filter((e) => daysUntil(e.start_date, today) <= 7).length;
  const upcomingLaterThisMonth = upcomingExperiences30.length - upcomingThisWeek;

  // "Confirmed" vs "pending" has no dedicated registration-status column in
  // this schema (checked_in only applies once the event starts, which
  // hasn't happened yet for anything in this window) — the closest honest
  // proxy is the experience's own status: participants registered against
  // an already-active (published, running) experience are confirmed to
  // happen, while participants on a still-draft experience are pending that
  // experience being finalized.
  let participantsNext30Total = 0;
  let participantsNext30Confirmed = 0;
  let participantsNext30Pending = 0;
  for (const e of upcomingExperiences30) {
    const count = (participantsBySlug.get(e.slug) ?? []).length;
    participantsNext30Total += count;
    if (e.status === "active") participantsNext30Confirmed += count;
    else participantsNext30Pending += count;
  }

  const assignedUpcoming = upcomingExperiences30.filter((e) => !!e.facilitator_name?.trim()).length;
  const facilitatorCoverageTotal = upcomingExperiences30.length;
  const facilitatorCoverageOutstanding = facilitatorCoverageTotal - assignedUpcoming;

  // ---------------------------------------------------------------------
  // SECTION 2 — attention required, by severity
  // ---------------------------------------------------------------------

  const critical: AttentionItem[] = [];
  const upcomingRisk: AttentionItem[] = [];
  const followUp: AttentionItem[] = [];

  for (const e of experiences) {
    if (e.status === "cancelled") continue;
    const daysToStart = daysUntil(e.start_date, today);
    const participantCount = (participantsBySlug.get(e.slug) ?? []).length;
    const logistics = logisticsByExperienceId.get(e.id);

    if ((e.status === "active" || e.status === "draft") && daysToStart >= 0 && daysToStart <= 7) {
      if (!e.facilitator_name?.trim()) {
        critical.push({
          id: `facilitator-${e.id}`,
          severity: "critical",
          headline: "Facilitator not assigned",
          context: `${e.title} — ${e.clients?.name ?? "No client"} — starts ${relativeDayLabel(daysToStart)}`,
          actionLabel: "Assign facilitator →",
          navigationUrl: `/dashboard/experiences/${e.slug}/edit`,
        });
      }

      if (!experienceIdsWithMaterials.has(e.id)) {
        upcomingRisk.push({
          id: `materials-${e.id}`,
          severity: "upcoming_risk",
          headline: "Materials not uploaded",
          context: `${e.title} starts ${relativeDayLabel(daysToStart)} — nothing uploaded yet`,
          actionLabel: "Upload materials →",
          navigationUrl: `/dashboard/experiences/${e.slug}?tab=materials`,
        });
      }

      const capacityFilled = e.capacity > 0 ? participantCount / e.capacity : 1;
      if (capacityFilled < LOW_REGISTRATION_CAPACITY_THRESHOLD) {
        upcomingRisk.push({
          id: `registration-${e.id}`,
          severity: "upcoming_risk",
          headline: "Low registration",
          context: `${e.title} — only ${participantCount} of ${e.capacity} seats filled, starts ${relativeDayLabel(daysToStart)}`,
          actionLabel: "Review registrations →",
          navigationUrl: `/dashboard/experiences/${e.slug}?tab=participants`,
        });
      }
    }

    if ((e.status === "active" || e.status === "draft") && daysToStart >= 0 && daysToStart <= 14 && logistics && logistics.overdue > 0) {
      critical.push({
        id: `logistics-${e.id}`,
        severity: "critical",
        headline: "Overdue logistics tasks",
        context: `${logistics.overdue} task${logistics.overdue === 1 ? "" : "s"} overdue — ${e.title} starts ${relativeDayLabel(daysToStart)}`,
        actionLabel: "Review tasks →",
        navigationUrl: `/dashboard/experiences/${e.slug}?tab=logistics`,
      });
    }

    if (e.status === "completed" && participantCount > 0) {
      const surveyedIds = surveyedParticipantIdsByExperienceId.get(e.id) ?? new Set<string>();
      const experienceParticipants = participantsBySlug.get(e.slug) ?? [];
      const surveyedCount = experienceParticipants.filter((p) => surveyedIds.has(p.id)).length;
      const notSurveyedCount = participantCount - surveyedCount;

      if (surveyedCount === 0) {
        upcomingRisk.push({
          id: `survey-not-sent-${e.id}`,
          severity: "upcoming_risk",
          headline: "Survey not sent",
          context: `${e.title} — completed, no surveys sent to ${participantCount} participant${participantCount === 1 ? "" : "s"}`,
          actionLabel: "Send surveys →",
          navigationUrl: `/dashboard/experiences/${e.slug}?tab=surveys`,
        });
      } else if (notSurveyedCount > 0) {
        followUp.push({
          id: `survey-partial-${e.id}`,
          severity: "follow_up",
          headline: "Survey partially sent",
          context: `${notSurveyedCount} of ${participantCount} participants not yet surveyed — ${e.title}`,
          actionLabel: "Send surveys →",
          navigationUrl: `/dashboard/experiences/${e.slug}?tab=surveys`,
        });
      }
    }
  }

  const engagementIdsWithExperiences = new Set<string>();
  for (const e of experiences) {
    if (e.engagement_id) engagementIdsWithExperiences.add(e.engagement_id);
  }
  for (const engagement of activeEngagements) {
    if (!engagementIdsWithExperiences.has(engagement.id)) {
      followUp.push({
        id: `no-experiences-${engagement.id}`,
        severity: "follow_up",
        headline: "No experiences linked",
        context: `${engagement.title} — ${engagement.clients?.name ?? "Unknown client"} — active engagement with nothing scheduled yet`,
        actionLabel: "Review engagement →",
        navigationUrl: `/dashboard/clients/${engagement.client_id}/engagements/${engagement.id}`,
      });
    }
  }

  for (const asset of lowStockAssets) {
    followUp.push({
      id: `low-stock-${asset.id}`,
      severity: "follow_up",
      headline: "Low stock",
      context: `${asset.name} — ${asset.stockQuantity} ${asset.stockUnit} remaining, reorder ${asset.reorderQuantity ?? asset.reorderThreshold}`,
      actionLabel: "Reorder →",
      navigationUrl: "/dashboard/assets",
    });
  }

  for (const conflict of assetConflicts) {
    critical.push({
      id: `asset-conflict-${conflict.assetId}-${conflict.experienceAId}-${conflict.experienceBId}`,
      severity: "critical",
      headline: "Asset conflict",
      context: `${conflict.assetName} is double-booked — ${conflict.experienceATitle} vs ${conflict.experienceBTitle}`,
      actionLabel: "Resolve conflict →",
      navigationUrl: "/dashboard/assets",
    });
  }

  const attentionTotal = critical.length + upcomingRisk.length + followUp.length;

  // ---------------------------------------------------------------------
  // SECTION 3 — upcoming delivery with readiness
  // ---------------------------------------------------------------------

  function computeReadiness(e: ExperienceRow, daysToStart: number, participantCount: number): ExperienceReadiness {
    const facilitatorAssigned = !!e.facilitator_name?.trim();
    const logistics = logisticsByExperienceId.get(e.id) ?? { total: 0, complete: 0, overdue: 0 };
    const logisticsAllComplete = logistics.total > 0 && logistics.complete === logistics.total;
    const capacityFilled = e.capacity > 0 ? participantCount / e.capacity : 1;
    const materialsUploaded = experienceIdsWithMaterials.has(e.id);

    if (!facilitatorAssigned && daysToStart <= 7) return "at_risk";
    if (logistics.overdue >= 3 && daysToStart <= 7) return "at_risk";
    if (daysToStart === 1 && (!facilitatorAssigned || logistics.overdue > 0)) return "at_risk";

    if (facilitatorAssigned && logistics.overdue > 0) return "attention";
    if (capacityFilled < LOW_REGISTRATION_CAPACITY_THRESHOLD && daysToStart > 7) return "attention";
    if (!materialsUploaded && daysToStart <= 7) return "attention";

    if (facilitatorAssigned && (daysToStart > 3 || logisticsAllComplete)) return "ready";

    return "attention";
  }

  const upcomingDeliveryCandidates = upcoming90
    .slice()
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const upcomingDelivery: UpcomingDeliveryRow[] = upcomingDeliveryCandidates.slice(0, UPCOMING_DELIVERY_LIMIT).map((e) => {
    const participantCount = (participantsBySlug.get(e.slug) ?? []).length;
    const daysToStart = daysUntil(e.start_date, today);
    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      clientName: e.clients?.name ?? null,
      startDate: e.start_date,
      participantCount,
      capacity: e.capacity,
      facilitatorName: e.facilitator_name,
      readiness: computeReadiness(e, daysToStart, participantCount),
    };
  });

  const upcomingDeliverySummary = upcoming90.reduce(
    (acc, e) => {
      const participantCount = (participantsBySlug.get(e.slug) ?? []).length;
      const readiness = computeReadiness(e, daysUntil(e.start_date, today), participantCount);
      if (readiness === "ready") acc.ready += 1;
      else if (readiness === "attention") acc.attention += 1;
      else acc.atRisk += 1;
      return acc;
    },
    { ready: 0, attention: 0, atRisk: 0 }
  );

  // ---------------------------------------------------------------------
  // SECTION 4 (left) — active engagements detail
  // ---------------------------------------------------------------------

  const experiencesByEngagementId = new Map<string, ExperienceRow[]>();
  for (const e of experiences) {
    if (!e.engagement_id) continue;
    const bucket = experiencesByEngagementId.get(e.engagement_id) ?? [];
    bucket.push(e);
    experiencesByEngagementId.set(e.engagement_id, bucket);
  }

  const activeEngagementsDetail: ActiveEngagementDetail[] = activeEngagements
    .map((engagement) => {
      const linked = experiencesByEngagementId.get(engagement.id) ?? [];
      const delivered = linked.filter((e) => e.status === "completed").length;
      const upcomingLinked = linked
        .filter((e) => (e.status === "active" || e.status === "draft") && startOfDay(new Date(e.start_date)).getTime() >= today.getTime())
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

      return {
        id: engagement.id,
        clientId: engagement.client_id,
        clientName: engagement.clients?.name ?? "Unknown client",
        title: engagement.title,
        experiencesDelivered: delivered,
        experiencesTotal: linked.length,
        nextDeliveryDate: upcomingLinked[0]?.start_date ?? null,
        contractValue: Number(engagement.contract_value ?? 0),
      };
    })
    .sort((a, b) => {
      if (a.nextDeliveryDate && b.nextDeliveryDate) {
        return new Date(a.nextDeliveryDate).getTime() - new Date(b.nextDeliveryDate).getTime();
      }
      if (a.nextDeliveryDate) return -1;
      if (b.nextDeliveryDate) return 1;
      return b.contractValue - a.contractValue;
    })
    .slice(0, ACTIVE_ENGAGEMENTS_LIMIT);

  // ---------------------------------------------------------------------
  // SECTION 4 (right) — facilitator capacity, next 30 days
  // ---------------------------------------------------------------------

  type WorkloadBucket = { key: string; name: string; email: string | null; count: number };
  const workloadByKey = new Map<string, WorkloadBucket>();
  for (const e of upcomingExperiences30) {
    const name = e.facilitator_name?.trim();
    if (!name) continue;
    const key = e.facilitator_email?.trim().toLowerCase() || name.toLowerCase();
    const bucket = workloadByKey.get(key) ?? { key, name, email: e.facilitator_email, count: 0 };
    bucket.count += 1;
    workloadByKey.set(key, bucket);
  }

  const topFacilitators: FacilitatorWorkload[] = [...workloadByKey.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_FACILITATORS_LIMIT)
    .map((bucket) => {
      const directoryEntry = bucket.email ? facilitatorByEmail.get(bucket.email.toLowerCase()) : undefined;
      return {
        id: directoryEntry?.id ?? null,
        name: directoryEntry ? `${directoryEntry.first_name} ${directoryEntry.last_name}` : bucket.name,
        upcomingCount: bucket.count,
        availabilityStatus: directoryEntry?.availability_status ?? "unknown",
        highWorkload: bucket.count >= HIGH_WORKLOAD_THRESHOLD,
      };
    });

  const highWorkloadCount = [...workloadByKey.values()].filter((b) => b.count >= HIGH_WORKLOAD_THRESHOLD).length;

  // ---------------------------------------------------------------------
  // SECTION 5 (left) — delivery horizon, next 3 months
  // ---------------------------------------------------------------------

  const deliveryHorizon: DeliveryHorizonMonth[] = [];
  for (let i = 0; i < 3; i++) {
    const bucketDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const year = bucketDate.getFullYear();
    const month = bucketDate.getMonth();
    const count = experiences.filter((e) => {
      if (e.status === "cancelled") return false;
      const start = new Date(e.start_date);
      return start.getFullYear() === year && start.getMonth() === month;
    }).length;

    deliveryHorizon.push({
      monthLabel: bucketDate.toLocaleDateString("en-US", { month: "long" }),
      year,
      month,
      count,
      isCurrentMonth: i === 0,
    });
  }

  // ---------------------------------------------------------------------
  // SECTION 5 (right) — post-delivery queue (awaiting closure)
  // ---------------------------------------------------------------------

  let surveysNotSentCount = 0;
  let responseRateLowCount = 0;
  let certificatesOutstanding = 0;

  for (const e of recentlyCompleted90) {
    const experienceParticipants = participantsBySlug.get(e.slug) ?? [];
    if (experienceParticipants.length === 0) continue;

    const surveyedIds = surveyedParticipantIdsByExperienceId.get(e.id) ?? new Set<string>();
    const completedIds = completedParticipantIdsByExperienceId.get(e.id) ?? new Set<string>();

    if (surveyedIds.size === 0) {
      surveysNotSentCount += 1;
    } else {
      const responseRate = completedIds.size / experienceParticipants.length;
      if (responseRate < 0.6) responseRateLowCount += 1;
    }

    const checkedInParticipants = experienceParticipants.filter((p) => p.checked_in);
    const certifiedIds = liveCertificateParticipantIdsByExperienceId.get(e.id) ?? new Set<string>();
    const uncertified = checkedInParticipants.filter((p) => !certifiedIds.has(p.id)).length;
    certificatesOutstanding += uncertified;
  }

  let staleLogisticsCount = 0;
  for (const e of recentlyCompleted90) {
    const end = startOfDay(new Date(e.end_date));
    if (end.getTime() > days7Ago.getTime()) continue;
    const logistics = logisticsByExperienceId.get(e.id);
    if (!logistics) continue;
    staleLogisticsCount += logistics.total - logistics.complete;
  }

  const postDeliveryQueue: PostDeliveryQueueItem[] = [
    { key: "surveys_not_sent", label: "Satisfaction surveys not sent", count: surveysNotSentCount, navigationUrl: "/dashboard/experiences" },
    { key: "response_rate_low", label: "Survey response rate below 60%", count: responseRateLowCount, navigationUrl: "/dashboard/experiences" },
    { key: "certificates_outstanding", label: "Certificates not yet issued", count: certificatesOutstanding, navigationUrl: "/dashboard/experiences" },
    { key: "stale_logistics", label: "Logistics tasks still open, event ended over a week ago", count: staleLogisticsCount, navigationUrl: "/dashboard/experiences" },
  ].filter((item) => item.count > 0);

  return {
    greeting,
    operationalPulse: {
      activeEngagements: { count: activeEngagements.length, clients: activeEngagementsClients, value: activeEngagementsValue },
      upcomingExperiences: { count: upcomingExperiences30.length, thisWeek: upcomingThisWeek, laterThisMonth: upcomingLaterThisMonth },
      participantsNext30Days: {
        total: participantsNext30Total,
        confirmed: participantsNext30Confirmed,
        pending: participantsNext30Pending,
      },
      facilitatorCoverage: {
        assigned: assignedUpcoming,
        total: facilitatorCoverageTotal,
        outstanding: facilitatorCoverageOutstanding,
      },
      attentionRequired: {
        total: attentionTotal,
        critical: critical.length,
        followUp: upcomingRisk.length + followUp.length,
      },
    },
    attentionBySeverity: { critical, upcomingRisk, followUp },
    upcomingDelivery,
    upcomingDeliverySummary,
    activeEngagementsDetail,
    activeEngagementsTotalCount: activeEngagements.length,
    facilitatorCapacity: {
      totalUpcoming: upcomingExperiences30.length,
      assigned: assignedUpcoming,
      unassigned: facilitatorCoverageOutstanding,
      highWorkloadCount,
      topFacilitators,
    },
    deliveryHorizon,
    postDeliveryQueue,
  };
}
