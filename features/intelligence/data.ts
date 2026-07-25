import { createClient } from "@/infrastructure/supabase/server";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ExperienceTypeBucket = "workshop" | "assessment" | "coaching" | "other";

const EXPERIENCE_TYPE_LABELS: Record<ExperienceTypeBucket, string> = {
  workshop: "Workshop",
  assessment: "Assessment",
  coaching: "Coaching",
  other: "Other",
};

export { EXPERIENCE_TYPE_LABELS };

function bucketExperienceType(raw: string): ExperienceTypeBucket {
  if (raw === "workshop" || raw === "assessment" || raw === "coaching") {
    return raw;
  }
  return "other";
}

export type YearMetrics = {
  year: number;
  isCurrent: boolean;
  /** True when `year` is the real current calendar year — i.e. still in
   * progress, so its totals are inherently a year-to-date snapshot, not a
   * full year. */
  isPartial: boolean;
  experiences: number;
  participants: number;
  avgSatisfaction: number | null;
  revenue: number;
  /** All three "vs prior" figures below compare like-for-like periods: a
   * partial year is compared against the SAME Jan 1 – [today] window in the
   * comparison year, never against that year's full 12 months. */
  experiencesChangePct: number | null;
  participantsChangePct: number | null;
  satisfactionDelta: number | null;
  /** The year this row was compared against (null for the earliest year on
   * record, which has nothing to compare to). */
  comparisonYear: number | null;
  /** Non-null only when the comparison used a truncated, period-matched
   * window rather than the comparison year's full 12 months — e.g.
   * "Jan 1 – Jul 25, 2024". Render this next to the % change so it's never
   * implied to be a full-year comparison. */
  comparisonPeriodLabel: string | null;
  /** True when `comparisonYear` isn't literally `year - 1` — e.g. 2025 has
   * no data at all, so 2026 falls back to comparing against 2024. */
  comparisonIsFallbackYear: boolean;
  /** Raw comparison-period totals, for UI that wants to show both sides of
   * the comparison explicitly (e.g. "8 vs 11 in the same period last year"). */
  comparisonExperiences: number | null;
  comparisonParticipants: number | null;
  comparisonAvgSatisfaction: number | null;
};

export type PeriodInfo = {
  /** True when the dataset's current year is the real current calendar
   * year — still in progress — and every "this year" figure in this module
   * is therefore a year-to-date snapshot rather than a full year. */
  isPartial: boolean;
  currentYear: number;
  /** "Jan 1 – Jul 25, 2026" when partial; "Full Year 2026" otherwise. */
  currentPeriodLabel: string;
  comparisonYear: number | null;
  /** Non-null only when `isPartial` — the same year-to-date window applied
   * to the comparison year, e.g. "Jan 1 – Jul 25, 2024". */
  comparisonPeriodLabel: string | null;
  comparisonIsFallbackYear: boolean;
};

export type TypeMixEntry = { type: ExperienceTypeBucket; label: string; count: number; pct: number };

export type SatisfactionBucketEntry = { label: string; count: number; pct: number };

export type SeasonalEntry = { month: number; monthLabel: string; experiences: number; avgSatisfaction: number | null };

export type ClientSummaryLite = {
  id: string;
  name: string;
  type: string;
  avgSatisfaction: number | null;
  totalContractValue: number;
  totalExperiences: number;
};

export type FacilitatorSummaryLite = {
  id: string;
  name: string;
  experienceCount: number;
};

export type OrganizationIntelligence = {
  currentYear: number;
  previousYear: number | null;
  period: PeriodInfo;
  activeEngagements: number;
  experiencesThisYear: number;
  experiencesLastYear: number;
  experiencesChangePct: number | null;
  participantsThisYear: number;
  participantsLastYear: number;
  participantsChangePct: number | null;
  satisfactionThisYear: number | null;
  satisfactionLastYear: number | null;
  satisfactionDelta: number | null;
  yearlyTrend: YearMetrics[];
  bestVolumeYear: number | null;
  bestSatisfactionYear: number | null;
  typeMixAllTime: TypeMixEntry[];
  typeMixThisYear: TypeMixEntry[];
  typeMixLastYear: TypeMixEntry[];
  satisfactionDistribution: SatisfactionBucketEntry[];
  seasonal: SeasonalEntry[];
  peakMonths: string[];
  bestSatisfactionMonths: string[];
  quarterlySatisfaction: { quarter: number; avgSatisfaction: number | null; experiences: number }[];
  clientSummaries: ClientSummaryLite[];
  facilitatorSummaries: FacilitatorSummaryLite[];
  totalExperiences: number;
};

export type ClientComparisonRow = {
  id: string;
  name: string;
  type: string;
  totalExperiences: number;
  totalParticipants: number;
  avgSatisfaction: number | null;
  totalContractValue: number;
  lastActiveDate: string | null;
  trend: "up" | "down" | "stable";
};

export type ClientYearMetric = {
  year: number;
  avgSatisfaction: number | null;
  experiences: number;
  participants: number;
  /** True for the dataset's current (most recent, still in-progress) year —
   * used to keep small-sample partial-year noise out of trend detection. */
  isPartialCurrentYear: boolean;
};

export type FacilitatorAffinity = {
  facilitatorId: string | null;
  name: string;
  experienceCount: number;
  avgSatisfaction: number | null;
  shareOfClientExperiences: number;
};

export type ClientEngagementHealth = {
  id: string;
  title: string;
  year: number;
  status: string;
  contractValue: number;
  experiences: number;
  avgSatisfaction: number | null;
};

export type ClientDetailIntelligence = {
  client: { id: string; name: string; type: string; industry: string | null; country: string | null };
  yearlyTrend: ClientYearMetric[];
  typeDistribution: TypeMixEntry[];
  typeDistributionEarly: TypeMixEntry[];
  typeDistributionLate: TypeMixEntry[];
  facilitatorAffinity: FacilitatorAffinity[];
  engagements: ClientEngagementHealth[];
  overallAvgSatisfaction: number | null;
  portfolioAvgSatisfaction: number | null;
  workshopAvgSatisfaction: number | null;
  coachingAvgSatisfaction: number | null;
  quarterlyDistribution: { quarter: number; experiences: number; pct: number }[];
  lastActiveDate: string | null;
  recentTrendDelta: number | null;
  relationshipRisk: "healthy" | "monitor" | "at_risk";
};

export type FacilitatorComparisonRow = {
  id: string;
  name: string;
  email: string;
  experiencesDelivered: number;
  totalParticipants: number;
  avgSatisfaction: number | null;
  clientsServed: number;
  topExpertise: string | null;
  trend: "up" | "down" | "stable";
};

export type FacilitatorClientPortfolioEntry = {
  clientId: string;
  clientName: string;
  experienceCount: number;
  avgSatisfaction: number | null;
  clientTotalExperiences: number;
};

export type FacilitatorTypePerformance = { type: ExperienceTypeBucket; label: string; avgSatisfaction: number | null; count: number };

export type FacilitatorMonthlyUtilization = { month: number; monthLabel: string; experiences: number };

export type UpcomingExperience = { id: string; title: string; clientName: string | null; startDate: string };

export type FacilitatorDetailIntelligence = {
  facilitator: {
    id: string;
    name: string;
    email: string;
    availabilityStatus: string;
    expertiseAreas: string[];
  };
  yearlyTrend: { year: number; avgSatisfaction: number | null; experiences: number; isPartialCurrentYear: boolean }[];
  clientPortfolio: FacilitatorClientPortfolioEntry[];
  typePerformance: FacilitatorTypePerformance[];
  monthlyUtilization: FacilitatorMonthlyUtilization[];
  benchmarking: { facilitatorAvg: number | null; portfolioAvg: number | null; percentile: number | null };
  upcoming: UpcomingExperience[];
  recentTrendDelta: number | null;
  totalExperiences: number;
};

export type DashboardIntelligenceSummary = {
  satisfactionThisYear: number | null;
  satisfactionDelta: number | null;
  experiencesThisYear: number;
  experiencesChangePct: number | null;
  period: PeriodInfo;
  topOpportunity: { headline: string; detail: string } | null;
};

// ---------------------------------------------------------------------------
// Raw row shapes
// ---------------------------------------------------------------------------

type ClientRow = { id: string; name: string; type: string; industry: string | null; country: string | null; workspace_id: string };
type EngagementRow = {
  id: string;
  client_id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  contract_value: number | string | null;
};
type ExperienceRow = {
  id: string;
  slug: string;
  title: string;
  start_date: string;
  end_date: string;
  client_id: string | null;
  engagement_id: string | null;
  experience_type: string;
  facilitator_name: string | null;
  facilitator_email: string | null;
  status: string;
};
type FacilitatorRow = { id: string; first_name: string; last_name: string; email: string; expertise_areas: string[] | null; availability_status: string };
type ParticipantRow = { workshop_slug: string };
type ResponseRow = { workshop_id: string; overall_rating: number | null };

type RawDataset = {
  clients: ClientRow[];
  engagements: EngagementRow[];
  experiences: ExperienceRow[];
  facilitators: FacilitatorRow[];
  participantCountBySlug: Map<string, number>;
  responsesByExperienceId: Map<string, number[]>;
};

/** Supabase/PostgREST caps a plain `.select()` at 1000 rows by default —
 * silently, with no error, which is exactly what truncated the first version
 * of this dataset (6,318 survey_responses read back as ~1,000). Every fetch
 * in this module goes through this pager so a table growing past 1000 rows
 * degrades gracefully instead of quietly corrupting every downstream
 * average. */
async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    allRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

async function loadDataset(workspaceId?: string): Promise<RawDataset> {
  const supabase = await createClient();

  const [clients, facilitators] = await Promise.all([
    fetchAllRows<ClientRow>((from, to) => {
      let query = supabase
        .from("clients")
        .select("id, name, type, industry, country, workspace_id")
        .is("deleted_at", null)
        .range(from, to);
      if (workspaceId) {
        query = query.eq("workspace_id", workspaceId);
      }
      return query;
    }),
    fetchAllRows<FacilitatorRow>((from, to) =>
      supabase
        .from("facilitators")
        .select("id, first_name, last_name, email, expertise_areas, availability_status")
        .eq("is_active", true)
        .range(from, to)
    ),
  ]);

  const clientIds = new Set(clients.map((c) => c.id));

  const [engagementRows, experienceRows] = await Promise.all([
    fetchAllRows<EngagementRow>((from, to) =>
      supabase
        .from("engagements")
        .select("id, client_id, title, status, start_date, end_date, contract_value")
        .is("deleted_at", null)
        .range(from, to)
    ),
    fetchAllRows<ExperienceRow>((from, to) =>
      supabase
        .from("experiences")
        .select("id, slug, title, start_date, end_date, client_id, engagement_id, experience_type, facilitator_name, facilitator_email, status")
        .is("deleted_at", null)
        .range(from, to)
    ),
  ]);

  const engagements = engagementRows.filter((e) => clientIds.has(e.client_id));
  const experiences = experienceRows.filter((e) => e.client_id !== null && clientIds.has(e.client_id) && e.status === "completed");

  const experienceIds = new Set(experiences.map((e) => e.id));
  const slugs = new Set(experiences.map((e) => e.slug));

  // Participants/survey_responses carry no workspace_id (see migration 0002's
  // comment), so it's simplest and safest — no URL-length risk from a huge
  // `.in()` filter — to fetch them unfiltered and bucket by the
  // already-resolved id/slug sets.
  const [participantRows, responseRows] = await Promise.all([
    fetchAllRows<ParticipantRow>((from, to) => supabase.from("participants").select("workshop_slug").range(from, to)),
    fetchAllRows<ResponseRow>((from, to) => supabase.from("survey_responses").select("workshop_id, overall_rating").range(from, to)),
  ]);

  const participantCountBySlug = new Map<string, number>();
  for (const row of participantRows) {
    if (!slugs.has(row.workshop_slug)) continue;
    participantCountBySlug.set(row.workshop_slug, (participantCountBySlug.get(row.workshop_slug) ?? 0) + 1);
  }

  const responsesByExperienceId = new Map<string, number[]>();
  for (const row of responseRows) {
    if (row.overall_rating === null || !experienceIds.has(row.workshop_id)) continue;
    const bucket = responsesByExperienceId.get(row.workshop_id) ?? [];
    bucket.push(row.overall_rating);
    responsesByExperienceId.set(row.workshop_id, bucket);
  }

  return { clients, engagements, experiences, facilitators, participantCountBySlug, responsesByExperienceId };
}

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function avgOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return round1(((current - prior) / prior) * 100);
}

function yearOf(dateStr: string): number {
  return new Date(dateStr).getUTCFullYear();
}

function monthOf(dateStr: string): number {
  return new Date(dateStr).getUTCMonth() + 1;
}

function quarterOf(dateStr: string): number {
  return Math.floor((monthOf(dateStr) - 1) / 3) + 1;
}

function participantsFor(experience: ExperienceRow, dataset: RawDataset): number {
  return dataset.participantCountBySlug.get(experience.slug) ?? 0;
}

function responsesFor(experience: ExperienceRow, dataset: RawDataset): number[] {
  return dataset.responsesByExperienceId.get(experience.id) ?? [];
}

function facilitatorName(row: FacilitatorRow): string {
  return `${row.first_name} ${row.last_name}`;
}

function contractValueOf(row: EngagementRow): number {
  return Number(row.contract_value ?? 0);
}

/** Engagements attribute revenue to a year via their own dates; the small
 * set of pre-existing 2026 engagements have null dates (never backfilled),
 * so they fall back to whatever year is "current" in the dataset — which is
 * correct for them, since they're the only non-historical engagements. */
function engagementYear(engagement: EngagementRow, currentYear: number): number {
  return engagement.start_date ? yearOf(engagement.start_date) : currentYear;
}

// ---------------------------------------------------------------------------
// Period-aware comparison helpers
//
// A year that's still in progress can only ever be compared to the SAME
// elapsed window in another year — comparing its partial total against a
// full 12-month total makes every "vs last year" figure for that row
// meaningless (e.g. "8 experiences, -86% vs 2024" when 2026 is only 7
// months old). Every "this year vs last year" computation in this module
// routes through the helpers below instead of a raw year-to-year diff.
// ---------------------------------------------------------------------------

/** A year is "in progress" iff it's the real current calendar year — not
 * merely the latest year present in the dataset (a dataset that stops at
 * 2024 while today is 2026 has no in-progress year at all). */
function isYearInProgress(year: number, now: Date): boolean {
  return year === now.getUTCFullYear();
}

/** "Jan 1 – Jul 25, 2024" — the same elapsed window as `now`, projected
 * onto `year`. */
function formatPeriodLabel(now: Date, year: number): string {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, now.getUTCMonth(), now.getUTCDate()));
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}, ${year}`;
}

/** True when `dateStr` falls within `year`, on or before the same
 * month/day as `now` — i.e. the year-to-date window used to build a
 * period-matched comparison. */
function isWithinYearToDate(dateStr: string, year: number, now: Date): boolean {
  const d = new Date(dateStr);
  if (d.getUTCFullYear() !== year) return false;
  const cutoff = Date.UTC(year, now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999);
  return d.getTime() <= cutoff;
}

/** The year to compare `currentYear` against: `currentYear - 1` if that
 * year has any data, otherwise the most recent earlier year that does —
 * per the rule "if prior year data for the equivalent period is
 * unavailable, use the equivalent period from the most recent year that
 * has data, and label it clearly." */
function resolveComparisonYear(
  currentYear: number,
  yearsWithData: number[]
): { year: number; isFallback: boolean } | null {
  const adjacent = currentYear - 1;
  if (yearsWithData.includes(adjacent)) {
    return { year: adjacent, isFallback: false };
  }
  const earlier = yearsWithData.filter((y) => y < currentYear).sort((a, b) => b - a);
  return earlier.length > 0 ? { year: earlier[0], isFallback: true } : null;
}

function typeMix(experiences: ExperienceRow[]): TypeMixEntry[] {
  const counts = new Map<ExperienceTypeBucket, number>();
  for (const exp of experiences) {
    const bucket = bucketExperienceType(exp.experience_type);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const total = experiences.length;
  const order: ExperienceTypeBucket[] = ["workshop", "assessment", "coaching", "other"];
  return order
    .map((type) => ({
      type,
      label: EXPERIENCE_TYPE_LABELS[type],
      count: counts.get(type) ?? 0,
      pct: total > 0 ? round1(((counts.get(type) ?? 0) / total) * 100) : 0,
    }))
    .filter((entry) => entry.count > 0 || total === 0);
}

// ---------------------------------------------------------------------------
// Organization Intelligence
// ---------------------------------------------------------------------------

function computeOrgIntelligence(dataset: RawDataset): OrganizationIntelligence {
  const { experiences } = dataset;

  const now = new Date();
  const years = [...new Set(experiences.map((e) => yearOf(e.start_date)))].sort((a, b) => a - b);
  const currentYear = years.length > 0 ? years[years.length - 1] : now.getUTCFullYear();
  const previousYear = years.length > 1 ? years[years.length - 2] : null;

  const isPartial = years.length > 0 && isYearInProgress(currentYear, now);
  const comparisonResolution = isPartial ? resolveComparisonYear(currentYear, years) : null;

  const yearlyTrend: YearMetrics[] = years.map((year, index) => {
    const yearExperiences = experiences.filter((e) => yearOf(e.start_date) === year);
    const yearResponses = yearExperiences.flatMap((e) => responsesFor(e, dataset));
    const yearParticipants = yearExperiences.reduce((sum, e) => sum + participantsFor(e, dataset), 0);
    const yearRevenue = dataset.engagements
      .filter((eng) => engagementYear(eng, currentYear) === year)
      .reduce((sum, eng) => sum + contractValueOf(eng), 0);
    const satisfaction = avgOrNull(yearResponses);

    const isThisRowPartial = year === currentYear && isPartial;

    // Full years compare against the prior full year, same as before. The
    // one in-progress year compares against the SAME elapsed window in the
    // resolved comparison year — never that year's full 12 months.
    let comparisonYearForRow: number | null = null;
    let comparisonPeriodLabel: string | null = null;
    let comparisonIsFallbackYear = false;
    let comparisonExperiences: ExperienceRow[] = [];

    if (isThisRowPartial && comparisonResolution) {
      comparisonYearForRow = comparisonResolution.year;
      comparisonIsFallbackYear = comparisonResolution.isFallback;
      comparisonPeriodLabel = formatPeriodLabel(now, comparisonResolution.year);
      comparisonExperiences = experiences.filter((e) => isWithinYearToDate(e.start_date, comparisonResolution.year, now));
    } else if (index > 0) {
      comparisonYearForRow = years[index - 1];
      comparisonExperiences = experiences.filter((e) => yearOf(e.start_date) === comparisonYearForRow);
    }

    const comparisonExperiencesCount = comparisonYearForRow !== null ? comparisonExperiences.length : null;
    const comparisonParticipantsCount =
      comparisonYearForRow !== null ? comparisonExperiences.reduce((sum, e) => sum + participantsFor(e, dataset), 0) : null;
    const comparisonAvgSatisfaction =
      comparisonYearForRow !== null ? avgOrNull(comparisonExperiences.flatMap((e) => responsesFor(e, dataset))) : null;

    return {
      year,
      isCurrent: year === currentYear,
      isPartial: isThisRowPartial,
      experiences: yearExperiences.length,
      participants: yearParticipants,
      avgSatisfaction: satisfaction,
      revenue: yearRevenue,
      experiencesChangePct: comparisonExperiencesCount !== null ? pctChange(yearExperiences.length, comparisonExperiencesCount) : null,
      participantsChangePct:
        comparisonParticipantsCount !== null ? pctChange(yearParticipants, comparisonParticipantsCount) : null,
      satisfactionDelta:
        satisfaction !== null && comparisonAvgSatisfaction !== null ? round1(satisfaction - comparisonAvgSatisfaction) : null,
      comparisonYear: comparisonYearForRow,
      comparisonPeriodLabel,
      comparisonIsFallbackYear,
      comparisonExperiences: comparisonExperiencesCount,
      comparisonParticipants: comparisonParticipantsCount,
      comparisonAvgSatisfaction,
    };
  });

  const thisYearRow = yearlyTrend.find((y) => y.year === currentYear) ?? null;

  const period: PeriodInfo = {
    isPartial,
    currentYear,
    currentPeriodLabel: isPartial ? formatPeriodLabel(now, currentYear) : `Full Year ${currentYear}`,
    comparisonYear: isPartial ? (comparisonResolution?.year ?? null) : previousYear,
    comparisonPeriodLabel: isPartial && comparisonResolution ? formatPeriodLabel(now, comparisonResolution.year) : null,
    comparisonIsFallbackYear: isPartial ? (comparisonResolution?.isFallback ?? false) : false,
  };

  const bestVolumeYear = yearlyTrend.reduce<YearMetrics | null>(
    (best, row) => (best === null || row.experiences > best.experiences ? row : best),
    null
  );
  const bestSatisfactionYear = yearlyTrend
    .filter((row) => row.avgSatisfaction !== null)
    .reduce<YearMetrics | null>(
      (best, row) => (best === null || (row.avgSatisfaction ?? 0) > (best.avgSatisfaction ?? 0) ? row : best),
      null
    );

  const thisYearExperiences = experiences.filter((e) => yearOf(e.start_date) === currentYear);
  const lastYearExperiences = previousYear !== null ? experiences.filter((e) => yearOf(e.start_date) === previousYear) : [];

  const satisfactionDistribution = (() => {
    const buckets: { label: string; min: number; max: number }[] = [
      { label: "<3.0", min: -Infinity, max: 3.0 },
      { label: "3.0–3.4", min: 3.0, max: 3.5 },
      { label: "3.5–3.9", min: 3.5, max: 4.0 },
      { label: "4.0–4.4", min: 4.0, max: 4.5 },
      { label: "4.5–5.0", min: 4.5, max: Infinity },
    ];
    const experienceAverages = experiences
      .map((e) => avgOrNull(responsesFor(e, dataset)))
      .filter((v): v is number => v !== null);

    const counts = buckets.map((bucket) => ({
      label: bucket.label,
      count: experienceAverages.filter((v) => v >= bucket.min && v < bucket.max).length,
    }));
    const total = experienceAverages.length;
    return counts.map((c) => ({ label: c.label, count: c.count, pct: total > 0 ? round1((c.count / total) * 100) : 0 }));
  })();

  const seasonal: SeasonalEntry[] = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const monthExperiences = experiences.filter((e) => monthOf(e.start_date) === month);
    const monthResponses = monthExperiences.flatMap((e) => responsesFor(e, dataset));
    return {
      month,
      monthLabel: MONTH_LABELS[i],
      experiences: monthExperiences.length,
      avgSatisfaction: avgOrNull(monthResponses),
    };
  });

  const maxSeasonalVolume = Math.max(...seasonal.map((s) => s.experiences), 0);
  const peakMonths = seasonal.filter((s) => s.experiences === maxSeasonalVolume && maxSeasonalVolume > 0).map((s) => s.monthLabel);

  const rankedBySatisfaction = [...seasonal].filter((s) => s.avgSatisfaction !== null).sort((a, b) => (b.avgSatisfaction ?? 0) - (a.avgSatisfaction ?? 0));
  const bestSatisfactionMonths = rankedBySatisfaction.slice(0, 2).map((s) => s.monthLabel);

  const quarterlySatisfaction = [1, 2, 3, 4].map((quarter) => {
    const quarterExperiences = experiences.filter((e) => quarterOf(e.start_date) === quarter);
    const quarterResponses = quarterExperiences.flatMap((e) => responsesFor(e, dataset));
    return { quarter, avgSatisfaction: avgOrNull(quarterResponses), experiences: quarterExperiences.length };
  });

  const clientSummaries: ClientSummaryLite[] = dataset.clients.map((client) => {
    const clientExperiences = experiences.filter((e) => e.client_id === client.id);
    const clientResponses = clientExperiences.flatMap((e) => responsesFor(e, dataset));
    const totalContractValue = dataset.engagements.filter((eng) => eng.client_id === client.id).reduce((sum, eng) => sum + contractValueOf(eng), 0);
    return {
      id: client.id,
      name: client.name,
      type: client.type,
      avgSatisfaction: avgOrNull(clientResponses),
      totalContractValue,
      totalExperiences: clientExperiences.length,
    };
  });

  const facilitatorCountByEmail = new Map<string, { name: string; count: number }>();
  for (const exp of experiences) {
    if (!exp.facilitator_email) continue;
    const entry = facilitatorCountByEmail.get(exp.facilitator_email) ?? { name: exp.facilitator_name ?? exp.facilitator_email, count: 0 };
    entry.count += 1;
    facilitatorCountByEmail.set(exp.facilitator_email, entry);
  }
  const facilitatorSummaries: FacilitatorSummaryLite[] = [...facilitatorCountByEmail.entries()].map(([email, v]) => ({
    id: email,
    name: v.name,
    experienceCount: v.count,
  }));

  return {
    currentYear,
    previousYear,
    period,
    activeEngagements: dataset.engagements.filter((e) => e.status === "active").length,
    experiencesThisYear: thisYearRow?.experiences ?? thisYearExperiences.length,
    experiencesLastYear: thisYearRow?.comparisonExperiences ?? 0,
    experiencesChangePct: thisYearRow?.experiencesChangePct ?? null,
    participantsThisYear: thisYearRow?.participants ?? 0,
    participantsLastYear: thisYearRow?.comparisonParticipants ?? 0,
    participantsChangePct: thisYearRow?.participantsChangePct ?? null,
    satisfactionThisYear: thisYearRow?.avgSatisfaction ?? null,
    satisfactionLastYear: thisYearRow?.comparisonAvgSatisfaction ?? null,
    satisfactionDelta: thisYearRow?.satisfactionDelta ?? null,
    yearlyTrend,
    bestVolumeYear: bestVolumeYear?.year ?? null,
    bestSatisfactionYear: bestSatisfactionYear?.year ?? null,
    typeMixAllTime: typeMix(experiences),
    typeMixThisYear: typeMix(thisYearExperiences),
    typeMixLastYear: typeMix(lastYearExperiences),
    satisfactionDistribution,
    seasonal,
    peakMonths,
    bestSatisfactionMonths,
    quarterlySatisfaction,
    clientSummaries,
    facilitatorSummaries,
    totalExperiences: experiences.length,
  };
}

export async function getOrganizationIntelligence(workspaceId: string): Promise<OrganizationIntelligence> {
  const dataset = await loadDataset(workspaceId);
  return computeOrgIntelligence(dataset);
}

// ---------------------------------------------------------------------------
// Client Intelligence
// ---------------------------------------------------------------------------

/** "Last 2 FULL years with data" avg vs the 2 years before that — used for
 * both the comparison-table trend arrow and the relationship-risk signal,
 * so the two stay consistent with each other. A year still in progress is
 * excluded entirely rather than blended in: its small, partial-year sample
 * would otherwise swing "recent" satisfaction on noise alone (a single
 * unlucky early response in month one of a new year), not a real trend. */
function recentTrendDelta(
  yearMetrics: { year: number; avgSatisfaction: number | null; isPartialCurrentYear?: boolean }[]
): number | null {
  const withData = yearMetrics
    .filter((y) => y.avgSatisfaction !== null && !y.isPartialCurrentYear)
    .sort((a, b) => b.year - a.year);
  if (withData.length < 2) return null;

  const recent = withData.slice(0, Math.min(2, withData.length));
  const prior = withData.slice(2, 4);
  if (prior.length === 0) return null;

  const recentAvg = avgOrNull(recent.map((y) => y.avgSatisfaction as number));
  const priorAvg = avgOrNull(prior.map((y) => y.avgSatisfaction as number));
  if (recentAvg === null || priorAvg === null) return null;

  return round1(recentAvg - priorAvg);
}

function trendFromDelta(delta: number | null, threshold = 0.15): "up" | "down" | "stable" {
  if (delta === null) return "stable";
  if (delta > threshold) return "up";
  if (delta < -threshold) return "down";
  return "stable";
}

function computeClientRows(dataset: RawDataset): ClientComparisonRow[] {
  const now = new Date();

  return dataset.clients.map((client) => {
    const clientExperiences = dataset.experiences.filter((e) => e.client_id === client.id);
    const clientResponses = clientExperiences.flatMap((e) => responsesFor(e, dataset));
    const years = [...new Set(clientExperiences.map((e) => yearOf(e.start_date)))];
    const yearMetrics = years.map((year) => ({
      year,
      avgSatisfaction: avgOrNull(clientExperiences.filter((e) => yearOf(e.start_date) === year).flatMap((e) => responsesFor(e, dataset))),
      isPartialCurrentYear: isYearInProgress(year, now),
    }));
    const lastActiveDate = clientExperiences.reduce<string | null>(
      (latest, e) => (latest === null || e.start_date > latest ? e.start_date : latest),
      null
    );

    return {
      id: client.id,
      name: client.name,
      type: client.type,
      totalExperiences: clientExperiences.length,
      totalParticipants: clientExperiences.reduce((sum, e) => sum + participantsFor(e, dataset), 0),
      avgSatisfaction: avgOrNull(clientResponses),
      totalContractValue: dataset.engagements.filter((eng) => eng.client_id === client.id).reduce((sum, eng) => sum + contractValueOf(eng), 0),
      lastActiveDate,
      trend: trendFromDelta(recentTrendDelta(yearMetrics)),
    };
  });
}

export async function getClientIntelligence(workspaceId: string): Promise<ClientComparisonRow[]> {
  const dataset = await loadDataset(workspaceId);
  return computeClientRows(dataset);
}

function monthsSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  return (now - then) / (1000 * 60 * 60 * 24 * 30.44);
}

function computeClientDetail(dataset: RawDataset, clientId: string): ClientDetailIntelligence | null {
  const client = dataset.clients.find((c) => c.id === clientId);
  if (!client) return null;

  const clientExperiences = dataset.experiences.filter((e) => e.client_id === clientId);
  const allResponses = dataset.experiences.flatMap((e) => responsesFor(e, dataset));
  const clientResponses = clientExperiences.flatMap((e) => responsesFor(e, dataset));

  const now = new Date();

  const years = [...new Set(clientExperiences.map((e) => yearOf(e.start_date)))].sort((a, b) => a - b);
  const yearlyTrend: ClientYearMetric[] = years.map((year) => {
    const yearExperiences = clientExperiences.filter((e) => yearOf(e.start_date) === year);
    return {
      year,
      avgSatisfaction: avgOrNull(yearExperiences.flatMap((e) => responsesFor(e, dataset))),
      experiences: yearExperiences.length,
      participants: yearExperiences.reduce((sum, e) => sum + participantsFor(e, dataset), 0),
      isPartialCurrentYear: isYearInProgress(year, now),
    };
  });

  const midpoint = Math.ceil(years.length / 2);
  const earlyYears = new Set(years.slice(0, midpoint));
  const lateYears = new Set(years.slice(midpoint));

  const workshopResponses = clientExperiences.filter((e) => bucketExperienceType(e.experience_type) === "workshop").flatMap((e) => responsesFor(e, dataset));
  const coachingResponses = clientExperiences.filter((e) => bucketExperienceType(e.experience_type) === "coaching").flatMap((e) => responsesFor(e, dataset));

  const facilitatorGroups = new Map<string, { name: string; count: number; responses: number[] }>();
  for (const exp of clientExperiences) {
    if (!exp.facilitator_email) continue;
    const entry = facilitatorGroups.get(exp.facilitator_email) ?? { name: exp.facilitator_name ?? exp.facilitator_email, count: 0, responses: [] };
    entry.count += 1;
    entry.responses.push(...responsesFor(exp, dataset));
    facilitatorGroups.set(exp.facilitator_email, entry);
  }
  const facilitatorAffinity: FacilitatorAffinity[] = [...facilitatorGroups.entries()]
    .map(([email, v]) => {
      const facilitatorRow = dataset.facilitators.find((f) => f.email === email);
      return {
        facilitatorId: facilitatorRow?.id ?? null,
        name: v.name,
        experienceCount: v.count,
        avgSatisfaction: avgOrNull(v.responses),
        shareOfClientExperiences: clientExperiences.length > 0 ? round1((v.count / clientExperiences.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.experienceCount - a.experienceCount)
    .slice(0, 3);

  const clientEngagements = dataset.engagements.filter((e) => e.client_id === clientId);
  const currentYearForFallback = years.length > 0 ? years[years.length - 1] : new Date().getUTCFullYear();
  const engagementsHealth: ClientEngagementHealth[] = clientEngagements
    .map((eng) => {
      const linkedExperiences = clientExperiences.filter((e) => e.engagement_id === eng.id);
      return {
        id: eng.id,
        title: eng.title,
        year: engagementYear(eng, currentYearForFallback),
        status: eng.status,
        contractValue: contractValueOf(eng),
        experiences: linkedExperiences.length,
        avgSatisfaction: avgOrNull(linkedExperiences.flatMap((e) => responsesFor(e, dataset))),
      };
    })
    .sort((a, b) => b.year - a.year);

  const quarterCounts = [1, 2, 3, 4].map((quarter) => clientExperiences.filter((e) => quarterOf(e.start_date) === quarter).length);
  const quarterlyDistribution = quarterCounts.map((count, i) => ({
    quarter: i + 1,
    experiences: count,
    pct: clientExperiences.length > 0 ? round1((count / clientExperiences.length) * 100) : 0,
  }));

  const lastActiveDate = clientExperiences.reduce<string | null>(
    (latest, e) => (latest === null || e.start_date > latest ? e.start_date : latest),
    null
  );

  const delta = recentTrendDelta(yearlyTrend);
  const trendDirection = trendFromDelta(delta);
  const monthsGap = monthsSince(lastActiveDate);

  let relationshipRisk: "healthy" | "monitor" | "at_risk" = "healthy";
  if (monthsGap >= 12 || (delta !== null && delta < -0.3)) {
    relationshipRisk = "at_risk";
  } else if (monthsGap >= 6 || trendDirection === "down") {
    relationshipRisk = "monitor";
  }

  return {
    client: { id: client.id, name: client.name, type: client.type, industry: client.industry, country: client.country },
    yearlyTrend,
    typeDistribution: typeMix(clientExperiences),
    typeDistributionEarly: typeMix(clientExperiences.filter((e) => earlyYears.has(yearOf(e.start_date)))),
    typeDistributionLate: typeMix(clientExperiences.filter((e) => lateYears.has(yearOf(e.start_date)))),
    facilitatorAffinity,
    engagements: engagementsHealth,
    overallAvgSatisfaction: avgOrNull(clientResponses),
    portfolioAvgSatisfaction: avgOrNull(allResponses),
    workshopAvgSatisfaction: avgOrNull(workshopResponses),
    coachingAvgSatisfaction: avgOrNull(coachingResponses),
    quarterlyDistribution,
    lastActiveDate,
    recentTrendDelta: delta,
    relationshipRisk,
  };
}

export async function getClientDetailIntelligence(clientId: string): Promise<ClientDetailIntelligence | null> {
  const dataset = await loadDataset();
  return computeClientDetail(dataset, clientId);
}

// ---------------------------------------------------------------------------
// Facilitator Intelligence
// ---------------------------------------------------------------------------

function computeFacilitatorRows(dataset: RawDataset): FacilitatorComparisonRow[] {
  const now = new Date();

  return dataset.facilitators
    .map((facilitator) => {
      const own = dataset.experiences.filter((e) => e.facilitator_email === facilitator.email);
      if (own.length === 0) return null;

      const responses = own.flatMap((e) => responsesFor(e, dataset));
      const years = [...new Set(own.map((e) => yearOf(e.start_date)))];
      const yearMetrics = years.map((year) => ({
        year,
        avgSatisfaction: avgOrNull(own.filter((e) => yearOf(e.start_date) === year).flatMap((e) => responsesFor(e, dataset))),
        isPartialCurrentYear: isYearInProgress(year, now),
      }));
      const clientsServed = new Set(own.map((e) => e.client_id).filter((id): id is string => id !== null));

      const row: FacilitatorComparisonRow = {
        id: facilitator.id,
        name: facilitatorName(facilitator),
        email: facilitator.email,
        experiencesDelivered: own.length,
        totalParticipants: own.reduce((sum, e) => sum + participantsFor(e, dataset), 0),
        avgSatisfaction: avgOrNull(responses),
        clientsServed: clientsServed.size,
        topExpertise: facilitator.expertise_areas?.[0] ?? null,
        trend: trendFromDelta(recentTrendDelta(yearMetrics)),
      };
      return row;
    })
    .filter((row): row is FacilitatorComparisonRow => row !== null);
}

export async function getFacilitatorIntelligence(workspaceId: string): Promise<FacilitatorComparisonRow[]> {
  const dataset = await loadDataset(workspaceId);
  return computeFacilitatorRows(dataset);
}

function computeFacilitatorDetail(dataset: RawDataset, facilitatorId: string): FacilitatorDetailIntelligence | null {
  const facilitator = dataset.facilitators.find((f) => f.id === facilitatorId);
  if (!facilitator) return null;

  const own = dataset.experiences.filter((e) => e.facilitator_email === facilitator.email);
  const allResponses = dataset.experiences.flatMap((e) => responsesFor(e, dataset));
  const ownResponses = own.flatMap((e) => responsesFor(e, dataset));

  const now = new Date();

  const years = [...new Set(own.map((e) => yearOf(e.start_date)))].sort((a, b) => a - b);
  const yearlyTrend = years.map((year) => {
    const yearExperiences = own.filter((e) => yearOf(e.start_date) === year);
    return {
      year,
      avgSatisfaction: avgOrNull(yearExperiences.flatMap((e) => responsesFor(e, dataset))),
      experiences: yearExperiences.length,
      isPartialCurrentYear: isYearInProgress(year, now),
    };
  });

  const clientGroups = new Map<string, { count: number; responses: number[] }>();
  for (const exp of own) {
    if (!exp.client_id) continue;
    const entry = clientGroups.get(exp.client_id) ?? { count: 0, responses: [] };
    entry.count += 1;
    entry.responses.push(...responsesFor(exp, dataset));
    clientGroups.set(exp.client_id, entry);
  }
  const clientPortfolio: FacilitatorClientPortfolioEntry[] = [...clientGroups.entries()]
    .map(([clientId, v]) => {
      const client = dataset.clients.find((c) => c.id === clientId);
      const clientTotalExperiences = dataset.experiences.filter((e) => e.client_id === clientId).length;
      return {
        clientId,
        clientName: client?.name ?? "Unknown client",
        experienceCount: v.count,
        avgSatisfaction: avgOrNull(v.responses),
        clientTotalExperiences,
      };
    })
    .sort((a, b) => b.experienceCount - a.experienceCount);

  const typeGroups = new Map<ExperienceTypeBucket, { count: number; responses: number[] }>();
  for (const exp of own) {
    const bucket = bucketExperienceType(exp.experience_type);
    const entry = typeGroups.get(bucket) ?? { count: 0, responses: [] };
    entry.count += 1;
    entry.responses.push(...responsesFor(exp, dataset));
    typeGroups.set(bucket, entry);
  }
  const typePerformance: FacilitatorTypePerformance[] = [...typeGroups.entries()].map(([type, v]) => ({
    type,
    label: EXPERIENCE_TYPE_LABELS[type],
    avgSatisfaction: avgOrNull(v.responses),
    count: v.count,
  }));

  const monthlyUtilization: FacilitatorMonthlyUtilization[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthLabel: MONTH_LABELS[i],
    experiences: own.filter((e) => monthOf(e.start_date) === i + 1).length,
  }));

  const facilitatorAvg = avgOrNull(ownResponses);
  const portfolioAvg = avgOrNull(allResponses);

  const allFacilitatorAverages = dataset.facilitators
    .map((f) => avgOrNull(dataset.experiences.filter((e) => e.facilitator_email === f.email).flatMap((e) => responsesFor(e, dataset))))
    .filter((v): v is number => v !== null);
  const percentile =
    facilitatorAvg !== null && allFacilitatorAverages.length > 1
      ? round1((allFacilitatorAverages.filter((v) => v < facilitatorAvg).length / allFacilitatorAverages.length) * 100)
      : null;

  const nowMs = now.getTime();
  const in90Days = nowMs + 90 * 24 * 60 * 60 * 1000;
  const upcoming: UpcomingExperience[] = dataset.experiences
    .filter((e) => e.facilitator_email === facilitator.email)
    .filter((e) => {
      const start = new Date(e.start_date).getTime();
      return start >= nowMs && start <= in90Days;
    })
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .map((e) => ({
      id: e.id,
      title: e.title,
      clientName: dataset.clients.find((c) => c.id === e.client_id)?.name ?? null,
      startDate: e.start_date,
    }));

  return {
    facilitator: {
      id: facilitator.id,
      name: facilitatorName(facilitator),
      email: facilitator.email,
      availabilityStatus: facilitator.availability_status,
      expertiseAreas: facilitator.expertise_areas ?? [],
    },
    yearlyTrend,
    clientPortfolio,
    typePerformance,
    monthlyUtilization,
    benchmarking: { facilitatorAvg, portfolioAvg, percentile },
    upcoming,
    recentTrendDelta: recentTrendDelta(yearlyTrend),
    totalExperiences: own.length,
  };
}

export async function getFacilitatorDetailIntelligence(facilitatorId: string): Promise<FacilitatorDetailIntelligence | null> {
  const dataset = await loadDataset();
  return computeFacilitatorDetail(dataset, facilitatorId);
}

// ---------------------------------------------------------------------------
// Dashboard summary — reuses one dataset load for org + every client detail
// so the executive dashboard doesn't pay for N+1 separate fetches.
// ---------------------------------------------------------------------------

export async function getDashboardIntelligenceSummary(workspaceId: string): Promise<DashboardIntelligenceSummary> {
  const dataset = await loadDataset(workspaceId);
  const org = computeOrgIntelligence(dataset);
  const clientRows = computeClientRows(dataset);

  const clientDetails = clientRows
    .map((row) => computeClientDetail(dataset, row.id))
    .filter((detail): detail is ClientDetailIntelligence => detail !== null);

  let topOpportunity: { headline: string; detail: string } | null = null;
  for (const detail of clientDetails) {
    if (
      detail.coachingAvgSatisfaction !== null &&
      detail.workshopAvgSatisfaction !== null &&
      detail.coachingAvgSatisfaction - detail.workshopAvgSatisfaction > 0.3
    ) {
      topOpportunity = {
        headline: `${detail.client.name} coaching programs are performing ${round1(detail.coachingAvgSatisfaction - detail.workshopAvgSatisfaction)} points above their workshops`,
        detail: "Consider proposing more coaching engagements to this client.",
      };
      break;
    }
  }

  if (!topOpportunity) {
    const best = clientRows
      .filter((c) => c.avgSatisfaction !== null)
      .sort((a, b) => (b.avgSatisfaction ?? 0) - (a.avgSatisfaction ?? 0))[0];
    if (best) {
      topOpportunity = {
        headline: `${best.name} consistently delivers the highest satisfaction at ${best.avgSatisfaction} avg`,
        detail: "A strong reference case for similar prospective clients.",
      };
    }
  }

  return {
    satisfactionThisYear: org.satisfactionThisYear,
    satisfactionDelta: org.satisfactionDelta,
    experiencesThisYear: org.experiencesThisYear,
    experiencesChangePct: org.experiencesChangePct,
    period: org.period,
    topOpportunity,
  };
}
