import { cache } from "react";

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
  /** Satisfaction responses submitted via a custom survey template, not
   * reflected in satisfactionThisYear/satisfactionLastYear/yearlyTrend or
   * any other average here — see RawDataset.excludedResponseCount. */
  excludedResponseCount: number;
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

export type HealthSignalStatus = "positive" | "neutral" | "negative";

export type HealthSignal = { label: string; status: HealthSignalStatus; detail: string };

export type ClientHealthAssessment = {
  /** Exactly 4, in order: Satisfaction Trend, Activity Recency, Volume
   * Trend, Engagement Frequency. */
  signals: HealthSignal[];
  score: number;
  risk: "healthy" | "monitor" | "at_risk";
  /** Human-readable "why" — e.g. "This client is flagged as Monitor because
   * satisfaction has declined 0.3 points over 2 years and no engagement has
   * been recorded in 14 months." */
  reasoning: string;
};

export type ClientLifecycle = {
  firstActivityDate: string | null;
  mostRecentActivityDate: string | null;
  relationshipDurationYears: number | null;
  /** Average gap between consecutive experience deliveries, in months — the
   * `engagements` table rows are annual buckets (one per client per year),
   * so individual experience dates are the more meaningful cadence signal
   * for "how often do we touch this client." */
  avgIntervalMonths: number | null;
  longestGapMonths: number | null;
  /** % of the calendar years spanning the relationship that had at least
   * one experience delivered. */
  repeatEngagementRatePct: number | null;
  /** True when the service-type mix in the later half of the relationship
   * includes more distinct types than the earlier half (e.g. started
   * workshop-only, now also buys assessment/coaching). */
  expansionSignal: boolean;
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
  health: ClientHealthAssessment;
  lifecycle: ClientLifecycle;
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

export type ServiceLineConcentration = {
  type: ExperienceTypeBucket;
  label: string;
  facilitatorCount: number;
  portfolioCount: number;
  sharePct: number;
};

export type ConsistencyLabel = "Highly Consistent" | "Consistent" | "Variable" | "Highly Variable";

export type ConsistencyScore = {
  stdDev: number | null;
  label: ConsistencyLabel | null;
  sampleSize: number;
};

export type QuarterlyUtilizationEntry = { quarter: number; label: string; experiences: number };

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
  /** For each service line this facilitator has delivered, what share of
   * the ENTIRE portfolio's delivery of that line they personally carry —
   * distinct from clientPortfolio's per-client share. */
  serviceLineConcentration: ServiceLineConcentration[];
  consistency: ConsistencyScore;
  quarterlyUtilization: QuarterlyUtilizationEntry[];
  busiestQuarter: number | null;
  currentQuarter: {
    quarter: number;
    year: number;
    experiences: number;
    historicalAvgPerQuarter: number | null;
    changePct: number | null;
  };
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
  venue: string | null;
  city: string | null;
  country: string | null;
};
type FacilitatorRow = { id: string; first_name: string; last_name: string; email: string; expertise_areas: string[] | null; availability_status: string };
type ParticipantRow = { workshop_slug: string };
type DimensionResponseRow = {
  workshop_id: string;
  content_rating: number | null;
  facilitator_rating: number | null;
  logistics_rating: number | null;
  overall_rating: number | null;
};

type RawDataset = {
  clients: ClientRow[];
  engagements: EngagementRow[];
  experiences: ExperienceRow[];
  facilitators: FacilitatorRow[];
  participantCountBySlug: Map<string, number>;
  responsesByExperienceId: Map<string, number[]>;
  dimensionResponses: DimensionResponseRow[];
  /** Satisfaction survey responses submitted via a custom template — not
   * reflected in any average below. See loadDataset's comment. */
  excludedResponseCount: number;
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

// Every getXIntelligence function below calls this, and buildAssistantContext
// (features/intelligence/assistant-context.ts) calls several of them plus
// getClientDetailIntelligence/getFacilitatorDetailIntelligence once per
// client/facilitator — 20+ calls in a single render of /dashboard/intelligence
// or /dashboard/intelligence/ask. Each call re-fetches every paginated table
// (participants alone is 8,000+ rows) from scratch, which was slow enough to
// intermittently 503 that route. `cache()` memoizes per request (keyed on the
// workspaceId argument), so all of those collapse into one real fetch.
const loadDataset = cache(async function loadDataset(workspaceId?: string): Promise<RawDataset> {
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
        .select(
          "id, slug, title, start_date, end_date, client_id, engagement_id, experience_type, facilitator_name, facilitator_email, status, venue, city, country"
        )
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
    fetchAllRows<DimensionResponseRow>((from, to) =>
      supabase.from("survey_responses").select("workshop_id, content_rating, facilitator_rating, logistics_rating, overall_rating").range(from, to)
    ),
  ]);

  const participantCountBySlug = new Map<string, number>();
  for (const row of participantRows) {
    if (!slugs.has(row.workshop_slug)) continue;
    participantCountBySlug.set(row.workshop_slug, (participantCountBySlug.get(row.workshop_slug) ?? 0) + 1);
  }

  const responsesByExperienceId = new Map<string, number[]>();
  const dimensionResponses: DimensionResponseRow[] = [];
  // A null overall_rating means this response was submitted against a
  // custom survey template (its answers live in survey_answers, not the
  // legacy rating columns — see Sprint 17's comment on getExperienceSurveyResults).
  // Every average below is built from these dimension columns only, so a
  // custom-template response is invisible to it; counting the exclusions
  // here is what lets computeOrgIntelligence surface that honestly instead
  // of silently under-representing satisfaction data (CLAUDE.md's
  // Intelligence Assistant Rule: never present partial data as complete).
  let excludedResponseCount = 0;
  for (const row of responseRows) {
    if (!experienceIds.has(row.workshop_id)) continue;
    dimensionResponses.push(row);
    if (row.overall_rating === null) {
      excludedResponseCount++;
      continue;
    }
    const bucket = responsesByExperienceId.get(row.workshop_id) ?? [];
    bucket.push(row.overall_rating);
    responsesByExperienceId.set(row.workshop_id, bucket);
  }

  return {
    clients,
    engagements,
    experiences,
    facilitators,
    participantCountBySlug,
    responsesByExperienceId,
    dimensionResponses,
    excludedResponseCount,
  };
});

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pluralize(n: number, unit: string): string {
  return `${n} ${unit}${Math.abs(n) === 1 ? "" : "s"}`;
}

function avgOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Population standard deviation — null with fewer than 2 values, since a
 * single data point has no meaningful spread. */
function stdDevOrNull(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
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

// ---------------------------------------------------------------------------
// Geography — experiences.country/city are populated directly for the vast
// majority of rows (the historical seed sets them explicitly); a handful of
// earlier demo rows only ever set the free-text `venue`, so those fall back
// to parsing it against a small known city/country list for this dataset.
// ---------------------------------------------------------------------------

const KNOWN_COUNTRIES = new Set(["Saudi Arabia", "UAE", "Qatar", "Egypt", "Lebanon", "Jordan", "Kuwait"]);

const CITY_TO_COUNTRY: Record<string, string> = {
  Riyadh: "Saudi Arabia",
  Jeddah: "Saudi Arabia",
  Dhahran: "Saudi Arabia",
  Dubai: "UAE",
  "Abu Dhabi": "UAE",
  Doha: "Qatar",
  Cairo: "Egypt",
  Beirut: "Lebanon",
  Amman: "Jordan",
  "Kuwait City": "Kuwait",
};

function countryOf(experience: Pick<ExperienceRow, "country" | "venue">): string {
  if (experience.country) return experience.country;
  if (!experience.venue) return "Unknown";
  const parts = experience.venue.split(",").map((p) => p.trim());
  const lastPart = parts[parts.length - 1];
  if (lastPart && KNOWN_COUNTRIES.has(lastPart)) return lastPart;
  for (const part of parts) {
    if (CITY_TO_COUNTRY[part]) return CITY_TO_COUNTRY[part];
  }
  return "Unknown";
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
    excludedResponseCount: dataset.excludedResponseCount,
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

/** Same "last 2 full years vs prior 2 full years" window as recentTrendDelta,
 * but for total experience volume rather than satisfaction — used for the
 * client health model's Volume Trend signal. */
function recentVolumeChangePct(yearMetrics: { year: number; experiences: number; isPartialCurrentYear: boolean }[]): number | null {
  const withData = yearMetrics.filter((y) => !y.isPartialCurrentYear).sort((a, b) => b.year - a.year);
  if (withData.length < 2) return null;

  const recent = withData.slice(0, Math.min(2, withData.length));
  const prior = withData.slice(2, 4);
  if (prior.length === 0) return null;

  const recentTotal = recent.reduce((sum, y) => sum + y.experiences, 0);
  const priorTotal = prior.reduce((sum, y) => sum + y.experiences, 0);
  return pctChange(recentTotal, priorTotal);
}

/** Average and longest gap, in months, between consecutive dates in a
 * chronologically-sorted list. */
function intervalStats(sortedDates: string[]): { avgMonths: number | null; longestGapMonths: number | null } {
  if (sortedDates.length < 2) return { avgMonths: null, longestGapMonths: null };
  const gaps: number[] = [];
  for (let i = 1; i < sortedDates.length; i++) {
    const diffMs = new Date(sortedDates[i]).getTime() - new Date(sortedDates[i - 1]).getTime();
    gaps.push(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  }
  return { avgMonths: round1(gaps.reduce((sum, v) => sum + v, 0) / gaps.length), longestGapMonths: round1(Math.max(...gaps)) };
}

/** The average of every client's own average delivery interval — the
 * baseline the Engagement Frequency health signal compares each client
 * against. Cheap at this scale (a handful of clients, dataset already
 * loaded in memory). */
function portfolioAvgIntervalMonths(dataset: RawDataset): number | null {
  const perClientAvgs: number[] = [];
  for (const client of dataset.clients) {
    const dates = dataset.experiences
      .filter((e) => e.client_id === client.id)
      .map((e) => e.start_date)
      .sort();
    const { avgMonths } = intervalStats(dates);
    if (avgMonths !== null) perClientAvgs.push(avgMonths);
  }
  return avgOrNull(perClientAvgs);
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
  const monthsGap = monthsSince(lastActiveDate);
  const volumeChangePct = recentVolumeChangePct(yearlyTrend);

  // --- Lifecycle metrics ---
  const sortedDates = [...clientExperiences.map((e) => e.start_date)].sort();
  const firstActivityDate = sortedDates[0] ?? null;
  const mostRecentActivityDate = lastActiveDate;
  const relationshipDurationYears =
    firstActivityDate && mostRecentActivityDate
      ? round1((new Date(mostRecentActivityDate).getTime() - new Date(firstActivityDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : null;
  const { avgMonths: avgIntervalMonths, longestGapMonths } = intervalStats(sortedDates);
  const relationshipSpanYears =
    firstActivityDate && mostRecentActivityDate ? yearOf(mostRecentActivityDate) - yearOf(firstActivityDate) + 1 : null;
  const repeatEngagementRatePct =
    relationshipSpanYears && relationshipSpanYears > 0 ? round1((years.length / relationshipSpanYears) * 100) : null;

  const typeDistributionEarly = typeMix(clientExperiences.filter((e) => earlyYears.has(yearOf(e.start_date))));
  const typeDistributionLate = typeMix(clientExperiences.filter((e) => lateYears.has(yearOf(e.start_date))));
  const expansionSignal = earlyYears.size > 0 && lateYears.size > 0 && typeDistributionLate.length > typeDistributionEarly.length;

  const lifecycle: ClientLifecycle = {
    firstActivityDate,
    mostRecentActivityDate,
    relationshipDurationYears,
    avgIntervalMonths,
    longestGapMonths,
    repeatEngagementRatePct,
    expansionSignal,
  };

  // --- Health signals: four independently-computed indicators, combined
  // into a composite score. Each carries its own plain-language "detail" so
  // the composite reasoning sentence can be assembled from real numbers
  // rather than a canned phrase. ---
  const satisfactionSignal: HealthSignal =
    delta === null
      ? { label: "Satisfaction Trend", status: "neutral", detail: "not enough year-over-year data to assess a satisfaction trend" }
      : delta > 0.15
        ? { label: "Satisfaction Trend", status: "positive", detail: `satisfaction has improved ${delta} points over the last two full years` }
        : delta < -0.15
          ? { label: "Satisfaction Trend", status: "negative", detail: `satisfaction has declined ${round1(Math.abs(delta))} points over the last two full years` }
          : { label: "Satisfaction Trend", status: "neutral", detail: "satisfaction has stayed roughly stable" };

  const recencySignal: HealthSignal =
    !Number.isFinite(monthsGap)
      ? { label: "Activity Recency", status: "negative", detail: "no experience has ever been delivered for this client" }
      : monthsGap < 6
        ? { label: "Activity Recency", status: "positive", detail: `active within the last 6 months (${pluralize(Math.round(monthsGap), "month")} ago)` }
        : monthsGap < 12
          ? { label: "Activity Recency", status: "neutral", detail: `no engagement has been recorded in ${pluralize(Math.round(monthsGap), "month")}` }
          : { label: "Activity Recency", status: "negative", detail: `no engagement has been recorded in ${pluralize(Math.round(monthsGap), "month")}` };

  const volumeSignal: HealthSignal =
    volumeChangePct === null
      ? { label: "Volume Trend", status: "neutral", detail: "not enough year-over-year data to assess a volume trend" }
      : volumeChangePct > 15
        ? { label: "Volume Trend", status: "positive", detail: `delivery volume has grown ${volumeChangePct}% over the last two years` }
        : volumeChangePct < -15
          ? { label: "Volume Trend", status: "negative", detail: `delivery volume has declined ${Math.abs(volumeChangePct)}% over the last two years` }
          : { label: "Volume Trend", status: "neutral", detail: "delivery volume has stayed roughly stable" };

  const portfolioInterval = portfolioAvgIntervalMonths(dataset);
  const frequencySignal: HealthSignal =
    avgIntervalMonths === null || portfolioInterval === null
      ? { label: "Engagement Frequency", status: "neutral", detail: "not enough delivery history to compare engagement frequency" }
      : avgIntervalMonths < portfolioInterval * 0.85
        ? {
            label: "Engagement Frequency",
            status: "positive",
            detail: `engages more frequently (every ${pluralize(avgIntervalMonths, "month")}) than the portfolio average (${pluralize(portfolioInterval, "month")})`,
          }
        : avgIntervalMonths > portfolioInterval * 1.15
          ? {
              label: "Engagement Frequency",
              status: "negative",
              detail: `engages less frequently (every ${pluralize(avgIntervalMonths, "month")}) than the portfolio average (${pluralize(portfolioInterval, "month")})`,
            }
          : {
              label: "Engagement Frequency",
              status: "neutral",
              detail: `engages about as often as the portfolio average (every ${pluralize(portfolioInterval, "month")})`,
            };

  const signals = [satisfactionSignal, recencySignal, volumeSignal, frequencySignal];
  const signalScore = (status: HealthSignalStatus) => (status === "positive" ? 1 : status === "negative" ? -1 : 0);
  const score = signals.reduce((sum, s) => sum + signalScore(s.status), 0);
  const risk: "healthy" | "monitor" | "at_risk" = score >= 1 ? "healthy" : score <= -2 ? "at_risk" : "monitor";

  const negatives = signals.filter((s) => s.status === "negative");
  const positives = signals.filter((s) => s.status === "positive");
  const reasoning =
    risk === "healthy"
      ? `Healthy — ${positives.length > 0 ? positives.map((s) => s.detail).join(", and ") : "no concerning signals detected"}.`
      : `This client is flagged as ${risk === "at_risk" ? "At Risk" : "Monitor"} because ${
          negatives.length > 0 ? negatives.map((s) => s.detail).join(", and ") : "signals are mixed with no clear positive trend"
        }.`;

  const health: ClientHealthAssessment = { signals, score, risk, reasoning };

  return {
    client: { id: client.id, name: client.name, type: client.type, industry: client.industry, country: client.country },
    yearlyTrend,
    typeDistribution: typeMix(clientExperiences),
    typeDistributionEarly,
    typeDistributionLate,
    facilitatorAffinity,
    engagements: engagementsHealth,
    overallAvgSatisfaction: avgOrNull(clientResponses),
    portfolioAvgSatisfaction: avgOrNull(allResponses),
    workshopAvgSatisfaction: avgOrNull(workshopResponses),
    coachingAvgSatisfaction: avgOrNull(coachingResponses),
    quarterlyDistribution,
    lastActiveDate,
    recentTrendDelta: delta,
    relationshipRisk: risk,
    health,
    lifecycle,
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

  // Concentration risk by service line — what share of the PORTFOLIO's
  // total delivery of each type this one facilitator personally carries.
  const serviceLineConcentration: ServiceLineConcentration[] = [...typeGroups.entries()].map(([type, v]) => {
    const portfolioCount = dataset.experiences.filter((e) => bucketExperienceType(e.experience_type) === type).length;
    return {
      type,
      label: EXPERIENCE_TYPE_LABELS[type],
      facilitatorCount: v.count,
      portfolioCount,
      sharePct: portfolioCount > 0 ? round1((v.count / portfolioCount) * 100) : 0,
    };
  });

  // Consistency — std dev of this facilitator's PER-EXPERIENCE average
  // satisfaction (not individual responses), so a facilitator who is
  // reliably ~4.3 every time reads differently from one who swings between
  // 3.5 and 5.0 across deliveries.
  const perExperienceAverages = own.map((e) => avgOrNull(responsesFor(e, dataset))).filter((v): v is number => v !== null);
  const consistencyStdDev = stdDevOrNull(perExperienceAverages);
  const consistencyLabel: ConsistencyLabel | null =
    consistencyStdDev === null
      ? null
      : consistencyStdDev < 0.3
        ? "Highly Consistent"
        : consistencyStdDev < 0.5
          ? "Consistent"
          : consistencyStdDev < 0.7
            ? "Variable"
            : "Highly Variable";
  const consistency: ConsistencyScore = { stdDev: consistencyStdDev, label: consistencyLabel, sampleSize: perExperienceAverages.length };

  // Utilization by quarter, pooled across all years.
  const QUARTER_LABELS = ["Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)"];
  const quarterlyUtilization: QuarterlyUtilizationEntry[] = [1, 2, 3, 4].map((quarter) => ({
    quarter,
    label: QUARTER_LABELS[quarter - 1],
    experiences: own.filter((e) => quarterOf(e.start_date) === quarter).length,
  }));
  const busiestQuarter =
    quarterlyUtilization.some((q) => q.experiences > 0)
      ? quarterlyUtilization.reduce((best, q) => (q.experiences > best.experiences ? q : best)).quarter
      : null;

  // Current quarter's workload vs. this facilitator's own historical
  // average per quarter — computed from prior years only, so the current
  // (possibly still-accumulating) quarter isn't compared against a baseline
  // that already includes itself.
  const thisQuarter = quarterOf(now.toISOString());
  const thisCalendarYear = now.getUTCFullYear();
  const currentQuarterExperiences = own.filter(
    (e) => yearOf(e.start_date) === thisCalendarYear && quarterOf(e.start_date) === thisQuarter
  ).length;
  const priorYearsOwn = own.filter((e) => yearOf(e.start_date) !== thisCalendarYear);
  const priorYearsCount = new Set(priorYearsOwn.map((e) => yearOf(e.start_date))).size;
  const historicalAvgPerQuarter = priorYearsCount > 0 ? round1(priorYearsOwn.length / (priorYearsCount * 4)) : null;

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
    serviceLineConcentration,
    consistency,
    quarterlyUtilization,
    busiestQuarter,
    currentQuarter: {
      quarter: thisQuarter,
      year: thisCalendarYear,
      experiences: currentQuarterExperiences,
      historicalAvgPerQuarter,
      changePct: historicalAvgPerQuarter !== null ? pctChange(currentQuarterExperiences, historicalAvgPerQuarter) : null,
    },
  };
}

export async function getFacilitatorDetailIntelligence(facilitatorId: string): Promise<FacilitatorDetailIntelligence | null> {
  const dataset = await loadDataset();
  return computeFacilitatorDetail(dataset, facilitatorId);
}

// ---------------------------------------------------------------------------
// Portfolio Intelligence
// ---------------------------------------------------------------------------

export type ServiceMixYearRow = {
  year: number;
  workshopPct: number;
  assessmentPct: number;
  coachingPct: number;
  otherPct: number;
  total: number;
};

export type ServiceLineShift = {
  type: ExperienceTypeBucket;
  label: string;
  earlyPct: number;
  latePct: number;
  deltaPp: number;
};

export type TopExperienceTitle = { title: string; count: number; avgSatisfaction: number | null };

export type GeographyEntry = { country: string; count: number; pct: number; avgSatisfaction: number | null };

export type SectorMixEntry = { type: string; label: string; count: number; pct: number; avgSatisfaction: number | null };

export type SectorYearRow = {
  year: number;
  corporateCount: number;
  governmentCount: number;
  corporatePct: number;
  governmentPct: number;
  corporateAvgSatisfaction: number | null;
  governmentAvgSatisfaction: number | null;
};

export type ClientRevenueEntry = { clientId: string; clientName: string; totalContractValue: number; pct: number };

export type RevenueYearRow = { year: number; revenue: number; changePct: number | null };

export type PortfolioIntelligence = {
  totalExperiences: number;
  serviceMixByYear: ServiceMixYearRow[];
  /** Early-half years vs late-half years, for the ">10 percentage points
   * over the period" shift-detection rule. */
  serviceLineShifts: ServiceLineShift[];
  topTitles: TopExperienceTitle[];
  portfolioAvgSatisfaction: number | null;
  geography: GeographyEntry[];
  geographyThisYearTop: string | null;
  geographyLastYearTop: string | null;
  sectorMix: SectorMixEntry[];
  sectorMixByYear: SectorYearRow[];
  revenueByYear: RevenueYearRow[];
  /** Top 5 clients by total contract value. */
  revenueByClient: ClientRevenueEntry[];
  totalRevenue: number;
  revenueConcentrationTop2Pct: number | null;
  avgEngagementValueByType: { type: string; label: string; avg: number | null; count: number }[];
};

function computePortfolioIntelligence(dataset: RawDataset): PortfolioIntelligence {
  const { experiences } = dataset;
  const now = new Date();
  const years = [...new Set(experiences.map((e) => yearOf(e.start_date)))].sort((a, b) => a - b);
  const currentYear = years.length > 0 ? years[years.length - 1] : now.getUTCFullYear();
  const previousYear = years.length > 1 ? years[years.length - 2] : null;

  // Section 1 — Service Mix Evolution
  const serviceMixByYear: ServiceMixYearRow[] = years.map((year) => {
    const yearExperiences = experiences.filter((e) => yearOf(e.start_date) === year);
    const mix = typeMix(yearExperiences);
    const pctOf = (type: ExperienceTypeBucket) => mix.find((m) => m.type === type)?.pct ?? 0;
    return {
      year,
      workshopPct: pctOf("workshop"),
      assessmentPct: pctOf("assessment"),
      coachingPct: pctOf("coaching"),
      otherPct: pctOf("other"),
      total: yearExperiences.length,
    };
  });

  const midpoint = Math.ceil(years.length / 2);
  const earlyYears = new Set(years.slice(0, midpoint));
  const lateYears = new Set(years.slice(midpoint));
  const earlyMix = typeMix(experiences.filter((e) => earlyYears.has(yearOf(e.start_date))));
  const lateMix = typeMix(experiences.filter((e) => lateYears.has(yearOf(e.start_date))));
  const allTypes: ExperienceTypeBucket[] = ["workshop", "assessment", "coaching", "other"];
  const serviceLineShifts: ServiceLineShift[] = allTypes.map((type) => {
    const earlyPct = earlyMix.find((m) => m.type === type)?.pct ?? 0;
    const latePct = lateMix.find((m) => m.type === type)?.pct ?? 0;
    return { type, label: EXPERIENCE_TYPE_LABELS[type], earlyPct, latePct, deltaPp: round1(latePct - earlyPct) };
  });

  // Section 2 — Topic/Theme Concentration (exact title match)
  const titleGroups = new Map<string, { count: number; responses: number[] }>();
  for (const exp of experiences) {
    const entry = titleGroups.get(exp.title) ?? { count: 0, responses: [] };
    entry.count += 1;
    entry.responses.push(...responsesFor(exp, dataset));
    titleGroups.set(exp.title, entry);
  }
  const topTitles: TopExperienceTitle[] = [...titleGroups.entries()]
    .map(([title, v]) => ({ title, count: v.count, avgSatisfaction: avgOrNull(v.responses) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const portfolioAvgSatisfaction = avgOrNull(experiences.flatMap((e) => responsesFor(e, dataset)));

  // Section 3 — Geographic Distribution
  const geoGroups = new Map<string, { count: number; responses: number[] }>();
  for (const exp of experiences) {
    const country = countryOf(exp);
    const entry = geoGroups.get(country) ?? { count: 0, responses: [] };
    entry.count += 1;
    entry.responses.push(...responsesFor(exp, dataset));
    geoGroups.set(country, entry);
  }
  const geography: GeographyEntry[] = [...geoGroups.entries()]
    .map(([country, v]) => ({
      country,
      count: v.count,
      pct: experiences.length > 0 ? round1((v.count / experiences.length) * 100) : 0,
      avgSatisfaction: avgOrNull(v.responses),
    }))
    .sort((a, b) => b.count - a.count);

  function topCountryForYear(year: number | null): string | null {
    if (year === null) return null;
    const counts = new Map<string, number>();
    for (const exp of experiences.filter((e) => yearOf(e.start_date) === year)) {
      const c = countryOf(exp);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  const geographyThisYearTop = topCountryForYear(currentYear);
  const geographyLastYearTop = topCountryForYear(previousYear);

  // Section 4 — Client Sector Mix (government vs everything else, matching
  // the same corporate/government split used by the Overview page's
  // government-vs-private-sector insight).
  function sectorOf(exp: ExperienceRow): "corporate" | "government" {
    return dataset.clients.find((c) => c.id === exp.client_id)?.type === "government" ? "government" : "corporate";
  }
  const sectorGroups = new Map<"corporate" | "government", { count: number; responses: number[] }>();
  for (const exp of experiences) {
    const sector = sectorOf(exp);
    const entry = sectorGroups.get(sector) ?? { count: 0, responses: [] };
    entry.count += 1;
    entry.responses.push(...responsesFor(exp, dataset));
    sectorGroups.set(sector, entry);
  }
  const sectorMix: SectorMixEntry[] = (["corporate", "government"] as const).map((type) => {
    const v = sectorGroups.get(type) ?? { count: 0, responses: [] };
    return {
      type,
      label: type === "government" ? "Government" : "Corporate",
      count: v.count,
      pct: experiences.length > 0 ? round1((v.count / experiences.length) * 100) : 0,
      avgSatisfaction: avgOrNull(v.responses),
    };
  });

  const sectorMixByYear: SectorYearRow[] = years.map((year) => {
    const yearExperiences = experiences.filter((e) => yearOf(e.start_date) === year);
    const corp = yearExperiences.filter((e) => sectorOf(e) === "corporate");
    const gov = yearExperiences.filter((e) => sectorOf(e) === "government");
    return {
      year,
      corporateCount: corp.length,
      governmentCount: gov.length,
      corporatePct: yearExperiences.length > 0 ? round1((corp.length / yearExperiences.length) * 100) : 0,
      governmentPct: yearExperiences.length > 0 ? round1((gov.length / yearExperiences.length) * 100) : 0,
      corporateAvgSatisfaction: avgOrNull(corp.flatMap((e) => responsesFor(e, dataset))),
      governmentAvgSatisfaction: avgOrNull(gov.flatMap((e) => responsesFor(e, dataset))),
    };
  });

  // Section 5 — Revenue Intelligence
  const revenueByYear: RevenueYearRow[] = years.map((year, index) => {
    const revenue = dataset.engagements
      .filter((eng) => engagementYear(eng, currentYear) === year)
      .reduce((sum, eng) => sum + contractValueOf(eng), 0);
    const priorYear = index > 0 ? years[index - 1] : null;
    const priorRevenue =
      priorYear !== null
        ? dataset.engagements.filter((eng) => engagementYear(eng, currentYear) === priorYear).reduce((sum, eng) => sum + contractValueOf(eng), 0)
        : null;
    return { year, revenue, changePct: priorRevenue !== null ? pctChange(revenue, priorRevenue) : null };
  });

  const totalRevenue = dataset.engagements.reduce((sum, eng) => sum + contractValueOf(eng), 0);

  const allClientRevenue: ClientRevenueEntry[] = dataset.clients
    .map((client) => {
      const total = dataset.engagements.filter((eng) => eng.client_id === client.id).reduce((sum, eng) => sum + contractValueOf(eng), 0);
      return { clientId: client.id, clientName: client.name, totalContractValue: total, pct: totalRevenue > 0 ? round1((total / totalRevenue) * 100) : 0 };
    })
    .filter((c) => c.totalContractValue > 0)
    .sort((a, b) => b.totalContractValue - a.totalContractValue);

  const revenueConcentrationTop2Pct =
    allClientRevenue.length >= 2 && totalRevenue > 0
      ? round1(((allClientRevenue[0].totalContractValue + allClientRevenue[1].totalContractValue) / totalRevenue) * 100)
      : null;

  const avgEngagementValueByType = (["corporate", "government"] as const).map((type) => {
    const clientIds = new Set(
      dataset.clients.filter((c) => (type === "government" ? c.type === "government" : c.type !== "government")).map((c) => c.id)
    );
    const values = dataset.engagements
      .filter((eng) => clientIds.has(eng.client_id))
      .map((eng) => contractValueOf(eng))
      .filter((v) => v > 0);
    return {
      type,
      label: type === "government" ? "Government" : "Corporate",
      avg: values.length > 0 ? round1(values.reduce((sum, v) => sum + v, 0) / values.length) : null,
      count: values.length,
    };
  });

  return {
    totalExperiences: experiences.length,
    serviceMixByYear,
    serviceLineShifts,
    topTitles,
    portfolioAvgSatisfaction,
    geography,
    geographyThisYearTop,
    geographyLastYearTop,
    sectorMix,
    sectorMixByYear,
    revenueByYear,
    revenueByClient: allClientRevenue.slice(0, 5),
    totalRevenue,
    revenueConcentrationTop2Pct,
    avgEngagementValueByType,
  };
}

export async function getPortfolioIntelligence(workspaceId: string): Promise<PortfolioIntelligence> {
  const dataset = await loadDataset(workspaceId);
  return computePortfolioIntelligence(dataset);
}

// ---------------------------------------------------------------------------
// Satisfaction Intelligence
// ---------------------------------------------------------------------------

export type VarianceBucketLabel = "Highly Consistent" | "Consistent" | "Variable" | "Highly Variable";

export type VarianceBucketEntry = { label: VarianceBucketLabel; count: number; pct: number };

export type SatisfactionDimension = "content" | "facilitator" | "logistics" | "overall";

export type DimensionAverage = { dimension: SatisfactionDimension; label: string; avg: number | null };

export type SatisfactionOutlier = {
  experienceId: string;
  title: string;
  clientName: string | null;
  startDate: string;
  facilitatorName: string | null;
  avgSatisfaction: number;
  deltaFromPortfolioAvg: number;
};

export type SatisfactionIntelligence = {
  portfolioAvgSatisfaction: number | null;
  /** One bucket per completed experience with 2+ individual responses,
   * based on the std dev of THOSE individual overall_rating responses —
   * i.e. how much participants within one session agreed with each other.
   * This is a different measurement from a facilitator's consistency score
   * (data.ts's ConsistencyScore), which looks at the spread of per-experience
   * AVERAGES across many sessions, not individual responses within one. */
  varianceDistribution: VarianceBucketEntry[];
  varianceSampleSize: number;
  dimensionAverages: DimensionAverage[];
  lowestDimension: { dimension: SatisfactionDimension; label: string; avg: number; gapFromHighest: number } | null;
  /** Experiences whose average overall rating sat more than 1.0 point below
   * the portfolio average — worth a human reviewing. */
  outliers: SatisfactionOutlier[];
};

const DIMENSION_LABELS: Record<SatisfactionDimension, string> = {
  content: "Content",
  facilitator: "Facilitator",
  logistics: "Logistics",
  overall: "Overall",
};

function computeSatisfactionIntelligence(dataset: RawDataset): SatisfactionIntelligence {
  const { experiences } = dataset;
  const portfolioAvgSatisfaction = avgOrNull(experiences.flatMap((e) => responsesFor(e, dataset)));

  const varianceCounts: Record<VarianceBucketLabel, number> = {
    "Highly Consistent": 0,
    Consistent: 0,
    Variable: 0,
    "Highly Variable": 0,
  };
  let varianceSampleSize = 0;
  for (const exp of experiences) {
    const sd = stdDevOrNull(responsesFor(exp, dataset));
    if (sd === null) continue;
    varianceSampleSize += 1;
    // Individual participant responses naturally spread wider than
    // per-experience averages, so these cutoffs run looser than the
    // facilitator ConsistencyScore's 0.3/0.5/0.7 bands.
    const label: VarianceBucketLabel = sd < 0.5 ? "Highly Consistent" : sd < 0.8 ? "Consistent" : sd < 1.1 ? "Variable" : "Highly Variable";
    varianceCounts[label] += 1;
  }
  const varianceDistribution: VarianceBucketEntry[] = (
    ["Highly Consistent", "Consistent", "Variable", "Highly Variable"] as VarianceBucketLabel[]
  ).map((label) => ({
    label,
    count: varianceCounts[label],
    pct: varianceSampleSize > 0 ? round1((varianceCounts[label] / varianceSampleSize) * 100) : 0,
  }));

  const dimensionValues: Record<SatisfactionDimension, number[]> = { content: [], facilitator: [], logistics: [], overall: [] };
  for (const row of dataset.dimensionResponses) {
    if (row.content_rating !== null) dimensionValues.content.push(row.content_rating);
    if (row.facilitator_rating !== null) dimensionValues.facilitator.push(row.facilitator_rating);
    if (row.logistics_rating !== null) dimensionValues.logistics.push(row.logistics_rating);
    if (row.overall_rating !== null) dimensionValues.overall.push(row.overall_rating);
  }
  const dimensionAverages: DimensionAverage[] = (["content", "facilitator", "logistics", "overall"] as SatisfactionDimension[]).map(
    (dimension) => ({ dimension, label: DIMENSION_LABELS[dimension], avg: avgOrNull(dimensionValues[dimension]) })
  );

  const withAvg = dimensionAverages.filter((d): d is { dimension: SatisfactionDimension; label: string; avg: number } => d.avg !== null);
  let lowestDimension: SatisfactionIntelligence["lowestDimension"] = null;
  if (withAvg.length >= 2) {
    const lowest = withAvg.reduce((min, d) => (d.avg < min.avg ? d : min));
    const highest = withAvg.reduce((max, d) => (d.avg > max.avg ? d : max));
    if (lowest.dimension !== highest.dimension && highest.avg - lowest.avg > 0.05) {
      lowestDimension = { dimension: lowest.dimension, label: lowest.label, avg: lowest.avg, gapFromHighest: round1(highest.avg - lowest.avg) };
    }
  }

  const outliers: SatisfactionOutlier[] = [];
  if (portfolioAvgSatisfaction !== null) {
    for (const exp of experiences) {
      const avg = avgOrNull(responsesFor(exp, dataset));
      if (avg === null) continue;
      const delta = round1(portfolioAvgSatisfaction - avg);
      if (delta > 1.0) {
        outliers.push({
          experienceId: exp.id,
          title: exp.title,
          clientName: dataset.clients.find((c) => c.id === exp.client_id)?.name ?? null,
          startDate: exp.start_date,
          facilitatorName: exp.facilitator_name,
          avgSatisfaction: avg,
          deltaFromPortfolioAvg: delta,
        });
      }
    }
    outliers.sort((a, b) => b.deltaFromPortfolioAvg - a.deltaFromPortfolioAvg);
  }

  return { portfolioAvgSatisfaction, varianceDistribution, varianceSampleSize, dimensionAverages, lowestDimension, outliers };
}

export async function getSatisfactionIntelligence(workspaceId: string): Promise<SatisfactionIntelligence> {
  const dataset = await loadDataset(workspaceId);
  return computeSatisfactionIntelligence(dataset);
}

// ---------------------------------------------------------------------------
// Operational Efficiency
//
// Reads tables (participants.checked_in, survey_tokens, certificates,
// logistics_tasks, experience_materials) that no other intelligence query
// needs, so — unlike everything above — this pulls its own fetches scoped
// to the same completed-experience set `loadDataset` already resolved,
// rather than growing the shared RawDataset for every other page's sake.
// ---------------------------------------------------------------------------

export type EfficiencyBenchmark = "good" | "acceptable" | "needs_attention" | "no_data";

export type EfficiencyMetric = {
  key: string;
  label: string;
  pct: number | null;
  numerator: number;
  denominator: number;
  benchmark: EfficiencyBenchmark;
};

export type OperationalEfficiency = {
  surveyResponseRate: EfficiencyMetric;
  checkInRate: EfficiencyMetric;
  certificateIssuanceRate: EfficiencyMetric;
  materialsReadiness: EfficiencyMetric;
  logisticsCompletionRate: EfficiencyMetric;
};

type CheckedInParticipantRow = { workshop_slug: string; checked_in: boolean };
type SurveyTokenEfficiencyRow = { workshop_id: string; completed_at: string | null };
type CertificateEfficiencyRow = { experience_id: string; revoked_at: string | null };
type LogisticsTaskEfficiencyRow = { workshop_id: string; status: string; completed_at: string | null };
type MaterialEfficiencyRow = { experience_id: string; created_at: string; deleted_at: string | null };

function benchmarkOf(pct: number | null): EfficiencyBenchmark {
  if (pct === null) return "no_data";
  if (pct >= 80) return "good";
  if (pct >= 60) return "acceptable";
  return "needs_attention";
}

function buildEfficiencyMetric(key: string, label: string, numerator: number, denominator: number): EfficiencyMetric {
  const pct = denominator > 0 ? round1((numerator / denominator) * 100) : null;
  return { key, label, pct, numerator, denominator, benchmark: benchmarkOf(pct) };
}

export async function getOperationalEfficiency(workspaceId: string): Promise<OperationalEfficiency> {
  const dataset = await loadDataset(workspaceId);
  const supabase = await createClient();
  const { experiences } = dataset;
  const experienceIds = new Set(experiences.map((e) => e.id));
  const slugs = new Set(experiences.map((e) => e.slug));
  const startDateById = new Map(experiences.map((e) => [e.id, e.start_date]));

  const [participantRows, tokenRows, certificateRows, logisticsRows, materialRows] = await Promise.all([
    fetchAllRows<CheckedInParticipantRow>((from, to) => supabase.from("participants").select("workshop_slug, checked_in").range(from, to)),
    fetchAllRows<SurveyTokenEfficiencyRow>((from, to) => supabase.from("survey_tokens").select("workshop_id, completed_at").range(from, to)),
    fetchAllRows<CertificateEfficiencyRow>((from, to) => supabase.from("certificates").select("experience_id, revoked_at").range(from, to)),
    fetchAllRows<LogisticsTaskEfficiencyRow>((from, to) =>
      supabase.from("logistics_tasks").select("workshop_id, status, completed_at").range(from, to)
    ),
    fetchAllRows<MaterialEfficiencyRow>((from, to) =>
      supabase.from("experience_materials").select("experience_id, created_at, deleted_at").range(from, to)
    ),
  ]);

  const scopedParticipants = participantRows.filter((p) => slugs.has(p.workshop_slug));
  const checkedIn = scopedParticipants.filter((p) => p.checked_in).length;

  const scopedTokens = tokenRows.filter((t) => experienceIds.has(t.workshop_id));
  const completedTokens = scopedTokens.filter((t) => t.completed_at !== null).length;

  // Eligible = every participant of a completed experience; approximate,
  // since completion-criteria configuration isn't modeled here.
  const scopedCertificates = certificateRows.filter((c) => experienceIds.has(c.experience_id) && c.revoked_at === null);

  const scopedLogistics = logisticsRows.filter((t) => experienceIds.has(t.workshop_id));
  const completedLogisticsBeforeStart = scopedLogistics.filter((t) => {
    if (t.status !== "completed" || !t.completed_at) return false;
    const startDate = startDateById.get(t.workshop_id);
    return startDate ? new Date(t.completed_at).getTime() <= new Date(startDate).getTime() : false;
  }).length;

  const experiencesWithMaterialBeforeStart = new Set<string>();
  for (const m of materialRows) {
    if (m.deleted_at !== null || !experienceIds.has(m.experience_id)) continue;
    const startDate = startDateById.get(m.experience_id);
    if (startDate && new Date(m.created_at).getTime() <= new Date(startDate).getTime()) {
      experiencesWithMaterialBeforeStart.add(m.experience_id);
    }
  }

  return {
    surveyResponseRate: buildEfficiencyMetric("survey_response_rate", "Survey Response Rate", completedTokens, scopedTokens.length),
    checkInRate: buildEfficiencyMetric("check_in_rate", "Check-In Rate", checkedIn, scopedParticipants.length),
    certificateIssuanceRate: buildEfficiencyMetric(
      "certificate_issuance_rate",
      "Certificate Issuance Rate",
      scopedCertificates.length,
      scopedParticipants.length
    ),
    materialsReadiness: buildEfficiencyMetric(
      "materials_readiness",
      "Materials Readiness",
      experiencesWithMaterialBeforeStart.size,
      experiences.length
    ),
    logisticsCompletionRate: buildEfficiencyMetric(
      "logistics_completion_rate",
      "Logistics Completion Rate",
      completedLogisticsBeforeStart,
      scopedLogistics.length
    ),
  };
}

// ---------------------------------------------------------------------------
// Financial Intelligence
//
// Reads payment_milestones directly — a table no other intelligence query
// touches — scoped to the same clients/engagements `loadDataset` already
// resolved for this workspace. Same "own fetch, reuse loadDataset for
// lookups" pattern as Operational Efficiency above, rather than growing the
// shared RawDataset for every other page's sake.
// ---------------------------------------------------------------------------

export type FinancialStatusBucket = "collected" | "invoiced" | "triggered" | "pending";

export type RevenueByStatusEntry = { status: FinancialStatusBucket; label: string; amount: number; pct: number };

export type CollectedByClientEntry = { clientId: string; clientName: string; collected: number; pct: number };

export type ReceivablesByClientEntry = { clientId: string; clientName: string; outstanding: number; pct: number };

export type FinancialIntelligence = {
  totalMilestoneValue: number;
  revenueByStatus: RevenueByStatusEntry[];
  /** % of ever-triggered milestones that reached "collected" within 30 days
   * of their trigger date. Null when no milestone has ever been triggered. */
  collectionEfficiencyPct: number | null;
  avgDaysToInvoice: number | null;
  avgDaysToCollect: number | null;
  revenueConcentrationTop3: CollectedByClientEntry[];
  outstandingReceivablesByClient: ReceivablesByClientEntry[];
  triggeredNotInvoicedOver14Days: { count: number; totalAmount: number };
};

type FinancialMilestoneRow = {
  engagement_id: string;
  amount: number | string;
  status: "pending" | "triggered" | "invoiced" | "collected" | "overdue";
  triggered_at: string | null;
  invoiced_at: string | null;
  collected_at: string | null;
};

function daysBetweenIso(earlier: string, later: string): number {
  return (new Date(later).getTime() - new Date(earlier).getTime()) / (1000 * 60 * 60 * 24);
}

export async function getFinancialIntelligence(workspaceId: string): Promise<FinancialIntelligence> {
  const dataset = await loadDataset(workspaceId);
  const supabase = await createClient();

  const data = await fetchAllRows<FinancialMilestoneRow>((from, to) =>
    supabase
      .from("payment_milestones")
      .select("engagement_id, amount, status, triggered_at, invoiced_at, collected_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .range(from, to)
  );

  const milestones = data;

  const engagementClientId = new Map(dataset.engagements.map((e) => [e.id, e.client_id]));
  const clientName = new Map(dataset.clients.map((c) => [c.id, c.name]));

  const totalMilestoneValue = milestones.reduce((sum, m) => sum + Number(m.amount), 0);

  const statusBuckets: FinancialStatusBucket[] = ["collected", "invoiced", "triggered", "pending"];
  const revenueByStatus: RevenueByStatusEntry[] = statusBuckets.map((status) => {
    const amount = milestones
      .filter((m) => (status === "pending" ? m.status === "pending" || m.status === "overdue" : m.status === status))
      .reduce((sum, m) => sum + Number(m.amount), 0);
    return {
      status,
      label: status[0].toUpperCase() + status.slice(1),
      amount,
      pct: totalMilestoneValue > 0 ? round1((amount / totalMilestoneValue) * 100) : 0,
    };
  });

  const everTriggered = milestones.filter((m) => m.triggered_at !== null);
  const collectedWithin30 = everTriggered.filter(
    (m) => m.status === "collected" && m.collected_at && daysBetweenIso(m.triggered_at as string, m.collected_at) <= 30
  );
  const collectionEfficiencyPct = everTriggered.length > 0 ? round1((collectedWithin30.length / everTriggered.length) * 100) : null;

  const invoiceLagDays = milestones
    .filter((m) => m.triggered_at && m.invoiced_at)
    .map((m) => daysBetweenIso(m.triggered_at as string, m.invoiced_at as string));
  const avgDaysToInvoice = invoiceLagDays.length > 0 ? round1(invoiceLagDays.reduce((s, v) => s + v, 0) / invoiceLagDays.length) : null;

  const collectLagDays = milestones
    .filter((m) => m.invoiced_at && m.collected_at)
    .map((m) => daysBetweenIso(m.invoiced_at as string, m.collected_at as string));
  const avgDaysToCollect = collectLagDays.length > 0 ? round1(collectLagDays.reduce((s, v) => s + v, 0) / collectLagDays.length) : null;

  const collectedByClient = new Map<string, number>();
  for (const m of milestones.filter((m) => m.status === "collected")) {
    const clientId = engagementClientId.get(m.engagement_id);
    if (!clientId) continue;
    collectedByClient.set(clientId, (collectedByClient.get(clientId) ?? 0) + Number(m.amount));
  }
  const totalCollected = [...collectedByClient.values()].reduce((s, v) => s + v, 0);
  const revenueConcentrationTop3: CollectedByClientEntry[] = [...collectedByClient.entries()]
    .map(([clientId, collected]) => ({
      clientId,
      clientName: clientName.get(clientId) ?? "Unknown client",
      collected,
      pct: totalCollected > 0 ? round1((collected / totalCollected) * 100) : 0,
    }))
    .sort((a, b) => b.collected - a.collected)
    .slice(0, 3);

  const outstandingByClient = new Map<string, number>();
  for (const m of milestones.filter((m) => m.status === "invoiced")) {
    const clientId = engagementClientId.get(m.engagement_id);
    if (!clientId) continue;
    outstandingByClient.set(clientId, (outstandingByClient.get(clientId) ?? 0) + Number(m.amount));
  }
  const totalOutstanding = [...outstandingByClient.values()].reduce((s, v) => s + v, 0);
  const outstandingReceivablesByClient: ReceivablesByClientEntry[] = [...outstandingByClient.entries()]
    .map(([clientId, outstanding]) => ({
      clientId,
      clientName: clientName.get(clientId) ?? "Unknown client",
      outstanding,
      pct: totalOutstanding > 0 ? round1((outstanding / totalOutstanding) * 100) : 0,
    }))
    .sort((a, b) => b.outstanding - a.outstanding);

  const now = new Date().toISOString();
  const over14 = milestones.filter(
    (m) => m.status === "triggered" && m.triggered_at && daysBetweenIso(m.triggered_at, now) > 14
  );

  return {
    totalMilestoneValue,
    revenueByStatus,
    collectionEfficiencyPct,
    avgDaysToInvoice,
    avgDaysToCollect,
    revenueConcentrationTop3,
    outstandingReceivablesByClient,
    triggeredNotInvoicedOver14Days: {
      count: over14.length,
      totalAmount: over14.reduce((sum, m) => sum + Number(m.amount), 0),
    },
  };
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
