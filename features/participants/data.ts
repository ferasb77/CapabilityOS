import { createClient } from "@/infrastructure/supabase/server";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type CheckinFilter = "checked_in" | "not_checked_in";
export type ParticipantSurveyStatus = "not_sent" | "sent" | "completed";

export type ParticipantFilters = {
  experienceId?: string;
  clientId?: string;
  checkinStatus?: CheckinFilter;
  surveyStatus?: ParticipantSurveyStatus;
  search?: string;
};

export type ParticipantListItem = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  mobile: string;
  company: string | null;
  jobTitle: string | null;
  experienceId: string | null;
  experienceSlug: string;
  experienceTitle: string | null;
  clientName: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  registeredAt: string;
  surveyStatus: ParticipantSurveyStatus;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const MAX_FETCH_PAGE = 1000;
const IN_FILTER_SAFE_LIMIT = 200;

/** Supabase/PostgREST caps a plain `.select()` at 1000 rows by default, and
 * an `.in(column, ids)` filter built from an unbounded id list can also blow
 * past the request's max URL length once there are thousands of ids (this
 * is exactly what was crashing /dashboard/participants with a 400 Bad
 * Request once the workspace passed ~1000 participants — see Sprint 25's
 * fetchAllRows in infrastructure/repositories/dashboard.ts for the same
 * guard applied there). Every query here that can plausibly return/scope
 * more than 1000 rows goes through this pager and never builds an `.in()`
 * list from a full, unbounded id set. Now only used by the CSV export path
 * and by resolveSurveyStatusIdFilter, whose id list is bounded by "surveys
 * ever sent" rather than by the total participant count. */
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

type ParticipantRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  company: string | null;
  job_title: string | null;
  workshop_slug: string;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
};

const PARTICIPANT_COLUMNS =
  "id, first_name, last_name, email, mobile, company, job_title, workshop_slug, checked_in, checked_in_at, created_at";

type ExperienceLookupRow = {
  id: string;
  slug: string;
  title: string;
  clients: { name: string } | null;
};

type SurveyTokenRow = {
  participant_id: string;
  sent_at: string | null;
  completed_at: string | null;
};

function resolveSurveyStatus(
  tokenByParticipantId: Map<string, SurveyTokenRow>,
  participantId: string
): ParticipantSurveyStatus {
  const token = tokenByParticipantId.get(participantId);
  if (!token) {
    return "not_sent";
  }
  return token.completed_at ? "completed" : "sent";
}

function toListItem(
  row: ParticipantRow,
  experienceBySlug: Map<string, ExperienceLookupRow>,
  tokenByParticipantId: Map<string, SurveyTokenRow>
): ParticipantListItem {
  const experience = experienceBySlug.get(row.workshop_slug);

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    mobile: row.mobile,
    company: row.company,
    jobTitle: row.job_title,
    experienceId: experience?.id ?? null,
    experienceSlug: row.workshop_slug,
    experienceTitle: experience?.title ?? null,
    clientName: experience?.clients?.name ?? null,
    checkedIn: row.checked_in,
    checkedInAt: row.checked_in ? row.checked_in_at : null,
    registeredAt: row.created_at,
    surveyStatus: resolveSurveyStatus(tokenByParticipantId, row.id),
  };
}

/**
 * Resolves the `experienceId`/`clientId` filters down to the set of
 * `workshop_slug`s in scope, plus a slug -> {title, clientName} lookup for
 * hydrating rows. When neither filter is set, `isScoped` is false and every
 * participant is in scope — the lookup map is then built separately,
 * scoped to just the slugs actually present on whichever page is being
 * rendered (see fetchExperienceLookup), since fetching every experience up
 * front isn't needed for the paginated list to work.
 */
async function resolveExperienceScope(
  supabase: SupabaseServerClient,
  filters: Pick<ParticipantFilters, "experienceId" | "clientId">
): Promise<{ isScoped: boolean; slugs: string[]; experienceBySlug: Map<string, ExperienceLookupRow>; empty: boolean }> {
  if (!filters.experienceId && !filters.clientId) {
    return { isScoped: false, slugs: [], experienceBySlug: new Map(), empty: false };
  }

  let experienceQuery = supabase
    .from("experiences")
    .select("id, slug, title, clients(name)")
    .is("deleted_at", null);

  if (filters.experienceId) {
    experienceQuery = experienceQuery.eq("id", filters.experienceId);
  } else if (filters.clientId) {
    experienceQuery = experienceQuery.eq("client_id", filters.clientId);
  }

  const { data, error } = await experienceQuery;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as ExperienceLookupRow[];
  const experienceBySlug = new Map(rows.map((row) => [row.slug, row]));

  return {
    isScoped: true,
    slugs: rows.map((row) => row.slug),
    experienceBySlug,
    empty: rows.length === 0,
  };
}

/** Hydrates title/client name for whichever slugs are actually present in a
 * result set — scoped to at most `pageSize` distinct slugs when called from
 * the paginated list, so an unfiltered list load never scans the whole
 * experiences table just to label 25 rows. */
async function fetchExperienceLookup(
  supabase: SupabaseServerClient,
  slugs: string[]
): Promise<Map<string, ExperienceLookupRow>> {
  if (slugs.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("experiences")
    .select("id, slug, title, clients(name)")
    .in("slug", slugs);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as ExperienceLookupRow[];
  return new Map(rows.map((row) => [row.slug, row]));
}

/**
 * Every satisfaction survey_tokens row, keyed by participant_id — used by
 * the unpaginated CSV export, which needs survey status for every matching
 * participant regardless of page.
 */
async function fetchSatisfactionSurveyTokenMap(supabase: SupabaseServerClient): Promise<Map<string, SurveyTokenRow>> {
  const rows = await fetchAllRows<SurveyTokenRow>((from, to) =>
    supabase
      .from("survey_tokens")
      .select("participant_id, sent_at, completed_at")
      .eq("survey_type", "satisfaction")
      .range(from, to)
  );

  return new Map(rows.map((row) => [row.participant_id, row]));
}

/** Scoped version of the map above — only the ids on the current page, so
 * an unfiltered paginated list load never reads the whole survey_tokens
 * table just to render a status badge for `pageSize` rows. */
async function fetchSatisfactionSurveyTokenMapForIds(
  supabase: SupabaseServerClient,
  participantIds: string[]
): Promise<Map<string, SurveyTokenRow>> {
  if (participantIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("survey_tokens")
    .select("participant_id, sent_at, completed_at")
    .eq("survey_type", "satisfaction")
    .in("participant_id", participantIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map((data ?? []).map((row) => [row.participant_id as string, row as SurveyTokenRow]));
}

/**
 * The one place that resolves "which participants match these filters" for
 * the unpaginated CSV export (exportParticipants, in ./actions — a Server
 * Action can't be inlined in this file alongside these server-only data
 * functions once a Client Component imports from it, so the export
 * function itself lives separately and calls back into this shared
 * resolver).
 *
 * The paginated list (getAllParticipants below) does NOT use this — it
 * applies the same filters directly in the database query instead of
 * fetching every matching row, which is the whole point of that function's
 * rework. This one stays only for the export path, which genuinely needs
 * every matching row regardless of page.
 *
 * `search` here matches against the concatenated "fullName company" string
 * client-side, same as the list page used to. The paginated list's
 * server-side search (an OR of ilike on first_name/last_name/company) is
 * close but not byte-for-byte identical for a multi-word query that spans
 * both a name and a company — an acceptable, narrow divergence between
 * what's on screen and what's in the export for those edge-case queries;
 * matching it exactly would mean running this same client-side pass over
 * every row in the paginated path too, defeating the point of doing the
 * filtering in the database.
 */
export async function fetchFilteredParticipants(filters: ParticipantFilters): Promise<ParticipantListItem[]> {
  const supabase = await createClient();

  const scope = await resolveExperienceScope(supabase, filters);
  if (scope.isScoped && scope.empty) {
    return [];
  }

  const participantRows = await fetchAllRows<ParticipantRow>((from, to) => {
    let query = supabase
      .from("participants")
      .select(PARTICIPANT_COLUMNS)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (scope.isScoped) {
      query = query.in("workshop_slug", scope.slugs);
    }

    if (filters.checkinStatus === "checked_in") {
      query = query.eq("checked_in", true);
    } else if (filters.checkinStatus === "not_checked_in") {
      query = query.eq("checked_in", false);
    }

    return query;
  });

  const experienceBySlug = scope.isScoped
    ? scope.experienceBySlug
    : await fetchExperienceLookup(supabase, [...new Set(participantRows.map((row) => row.workshop_slug))]);

  const tokenByParticipantId = await fetchSatisfactionSurveyTokenMap(supabase);

  let items = participantRows.map((row) => toListItem(row, experienceBySlug, tokenByParticipantId));

  if (filters.surveyStatus) {
    items = items.filter((item) => item.surveyStatus === filters.surveyStatus);
  }

  if (filters.search) {
    const query = filters.search.trim().toLowerCase();
    if (query) {
      items = items.filter((item) =>
        [item.fullName, item.company ?? ""].join(" ").toLowerCase().includes(query)
      );
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Paginated list
// ---------------------------------------------------------------------------

export type PaginatedParticipants = {
  participants: ParticipantListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

type SurveyIdFilter = { mode: "in" | "not_in"; ids: string[] };

/**
 * `surveyStatus` isn't a column on `participants` — it's derived from
 * whether/how a satisfaction survey_tokens row exists for that participant.
 * To push this filter into the database query (rather than fetching every
 * participant and filtering in JS) it's resolved to a bounded id list
 * first: "sent"/"completed" become an `.in(id, ...)` list of the
 * participants who do have a token in that state; "not_sent" becomes a
 * `.not(id, in, ...)` exclusion of participants who have ANY satisfaction
 * token. Either way the list's size tracks how many surveys have ever been
 * sent, not how many participants exist in total, so it stays small even
 * on a workspace with thousands of participants.
 */
async function resolveSurveyStatusIdFilter(
  supabase: SupabaseServerClient,
  surveyStatus: ParticipantSurveyStatus | undefined
): Promise<{ filter: SurveyIdFilter; tokens: SurveyTokenRow[] } | null> {
  if (!surveyStatus) {
    return null;
  }

  const tokens = await fetchAllRows<SurveyTokenRow>((from, to) =>
    supabase
      .from("survey_tokens")
      .select("participant_id, sent_at, completed_at")
      .eq("survey_type", "satisfaction")
      .range(from, to)
  );

  if (surveyStatus === "not_sent") {
    return { filter: { mode: "not_in", ids: tokens.map((token) => token.participant_id) }, tokens };
  }

  const wantCompleted = surveyStatus === "completed";
  const ids = tokens
    .filter((token) => Boolean(token.completed_at) === wantCompleted)
    .map((token) => token.participant_id);

  return { filter: { mode: "in", ids }, tokens };
}

/** PostgREST's `.or()` takes a raw filter-string fragment, not a
 * parameterized value — commas and parens are the syntax's own condition/
 * group separators and can't be escaped inside it, so they're stripped
 * rather than passed through (this only ever narrows what a search term
 * can match, never widens it into a different filter). `%`/`_` are then
 * escaped so a literal one in someone's name or company doesn't act as a
 * SQL LIKE wildcard. */
function sanitizeSearchTerm(term: string): string {
  return term.replace(/[,()]/g, "").replace(/[%_]/g, (char) => `\\${char}`);
}

type ParticipantsQueryFilters = {
  isScoped: boolean;
  slugs: string[];
  checkinStatus?: CheckinFilter;
  searchTerm?: string;
  surveyIdFilter: SurveyIdFilter | null;
};

function participantsSelectQuery(supabase: SupabaseServerClient) {
  return supabase
    .from("participants")
    .select(PARTICIPANT_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false });
}

type ParticipantsSelectQuery = ReturnType<typeof participantsSelectQuery>;

function applyParticipantFilters(
  query: ParticipantsSelectQuery,
  params: ParticipantsQueryFilters
): ParticipantsSelectQuery {
  let q = query;

  if (params.isScoped) {
    q = q.in("workshop_slug", params.slugs);
  }

  if (params.checkinStatus === "checked_in") {
    q = q.eq("checked_in", true);
  } else if (params.checkinStatus === "not_checked_in") {
    q = q.eq("checked_in", false);
  }

  if (params.searchTerm) {
    const term = sanitizeSearchTerm(params.searchTerm);
    if (term) {
      q = q.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,company.ilike.%${term}%`);
    }
  }

  if (params.surveyIdFilter) {
    if (params.surveyIdFilter.mode === "in") {
      q = q.in("id", params.surveyIdFilter.ids);
    } else {
      q = q.not("id", "in", `(${params.surveyIdFilter.ids.join(",")})`);
    }
  }

  return q;
}

async function fetchParticipantsPage(
  supabase: SupabaseServerClient,
  queryParams: ParticipantsQueryFilters,
  page: number,
  pageSize: number
): Promise<{ rows: ParticipantRow[]; count: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const query = applyParticipantFilters(participantsSelectQuery(supabase), queryParams).range(from, to);
  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return { rows: (data ?? []) as unknown as ParticipantRow[], count: count ?? 0 };
}

function emptyPage(pageSize: number): PaginatedParticipants {
  return { participants: [], totalCount: 0, page: 1, pageSize, totalPages: 1 };
}

/** Same shape as getAllParticipants, but via the old fetch-everything path
 * — used only as a fallback when a surveyStatus filter's id list grows
 * past IN_FILTER_SAFE_LIMIT, mirroring the safety trade-off
 * infrastructure/repositories/dashboard.ts already makes for unbounded
 * `.in()` lists elsewhere in this codebase: correctness over speed, rather
 * than a request URL long enough to get rejected outright. */
async function getAllParticipantsViaFullScan(
  filters: ParticipantFilters & { page?: number },
  pageSize: number
): Promise<PaginatedParticipants> {
  const items = await fetchFilteredParticipants(filters);

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const start = (page - 1) * pageSize;

  return {
    participants: items.slice(start, start + pageSize),
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * True server-side pagination: only `pageSize` rows ever come back from
 * `participants` (via `.range()`), and `totalCount` comes from that same
 * query's exact count rather than the length of a fully-fetched array.
 * Before this, every request loaded every matching participant — up to
 * ~8,268 rows workspace-wide — just to slice 25 of them for display.
 * Every filter (experience, client, check-in, survey status, search) is
 * applied in the database query itself; only `surveyStatus`, on the rare
 * workspace where the number of participants who've ever been sent a
 * satisfaction survey exceeds IN_FILTER_SAFE_LIMIT, falls back to
 * getAllParticipantsViaFullScan above.
 */
export async function getAllParticipants(
  filters: ParticipantFilters & { page?: number; pageSize?: number } = {}
): Promise<PaginatedParticipants> {
  const pageSize = Math.min(Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const supabase = await createClient();

  const scope = await resolveExperienceScope(supabase, filters);
  if (scope.isScoped && scope.empty) {
    return emptyPage(pageSize);
  }

  const survey = await resolveSurveyStatusIdFilter(supabase, filters.surveyStatus);

  if (survey?.filter.mode === "in" && survey.filter.ids.length === 0) {
    return emptyPage(pageSize);
  }

  if (survey && survey.filter.ids.length > IN_FILTER_SAFE_LIMIT) {
    console.warn(
      `[participants] surveyStatus filter id list has ${survey.filter.ids.length} entries, over the ${IN_FILTER_SAFE_LIMIT}-item safety limit — falling back to fetch-and-filter-in-JS for this request.`
    );
    return getAllParticipantsViaFullScan(filters, pageSize);
  }

  const queryParams: ParticipantsQueryFilters = {
    isScoped: scope.isScoped,
    slugs: scope.slugs,
    checkinStatus: filters.checkinStatus,
    searchTerm: filters.search?.trim(),
    surveyIdFilter: survey?.filter ?? null,
  };

  const requestedPage = Math.max(1, filters.page ?? 1);
  let { rows, count } = await fetchParticipantsPage(supabase, queryParams, requestedPage, pageSize);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  let page = requestedPage;

  // The requested page landed past the last page — most likely a filter
  // narrowed the result set while a stale ?page= from before still pointed
  // further in. Refetch the actual last page rather than return nothing.
  if (rows.length === 0 && count > 0 && requestedPage > 1) {
    page = totalPages;
    ({ rows, count } = await fetchParticipantsPage(supabase, queryParams, page, pageSize));
  }

  const experienceBySlug = scope.isScoped
    ? scope.experienceBySlug
    : await fetchExperienceLookup(supabase, [...new Set(rows.map((row) => row.workshop_slug))]);

  const tokenByParticipantId = survey
    ? new Map(survey.tokens.map((token) => [token.participant_id, token]))
    : await fetchSatisfactionSurveyTokenMapForIds(supabase, rows.map((row) => row.id));

  return {
    participants: rows.map((row) => toListItem(row, experienceBySlug, tokenByParticipantId)),
    totalCount: count,
    page,
    pageSize,
    totalPages,
  };
}

// ---------------------------------------------------------------------------
// Participant detail
// ---------------------------------------------------------------------------

export type ParticipantDetailRecord = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  mobile: string;
  company: string | null;
  jobTitle: string | null;
};

export type ParticipantExperienceHistoryItem = {
  participantRowId: string;
  experienceId: string | null;
  experienceSlug: string;
  experienceTitle: string | null;
  clientName: string | null;
  engagementTitle: string | null;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  checkedIn: boolean;
  checkedInAt: string | null;
  surveyStatus: ParticipantSurveyStatus;
  satisfactionScore: number | null;
};

export type ParticipantDetail = {
  participant: ParticipantDetailRecord;
  experienceHistory: ParticipantExperienceHistoryItem[];
};

type ExperienceDetailLookupRow = {
  id: string;
  slug: string;
  title: string;
  venue: string | null;
  start_date: string;
  end_date: string;
  clients: { name: string } | null;
  engagements: { title: string } | null;
};

/**
 * A person can register for more than one experience — each registration
 * is its own row in `participants` (matched only by email, there's no
 * person-level table). Both the detail page's experience history and its
 * survey history need "every row belonging to this same person," so that
 * resolution lives here once.
 */
async function resolvePersonParticipantRows(
  supabase: SupabaseServerClient,
  anchorId: string
): Promise<ParticipantRow[] | null> {
  const { data: anchor, error: anchorError } = await supabase
    .from("participants")
    .select("email")
    .eq("id", anchorId)
    .maybeSingle();

  if (anchorError) {
    throw new Error(anchorError.message);
  }

  if (!anchor) {
    return null;
  }

  const { data: rows, error: rowsError } = await supabase
    .from("participants")
    .select(
      "id, first_name, last_name, email, mobile, company, job_title, workshop_slug, checked_in, checked_in_at, created_at"
    )
    .ilike("email", anchor.email)
    .order("created_at", { ascending: false });

  if (rowsError) {
    throw new Error(rowsError.message);
  }

  return rows ?? [];
}

export async function getParticipantById(anchorId: string): Promise<ParticipantDetail | null> {
  const supabase = await createClient();

  const personRows = await resolvePersonParticipantRows(supabase, anchorId);

  if (!personRows || personRows.length === 0) {
    return null;
  }

  // Most recent registration wins for the header display — company/job
  // title can legitimately change between registrations.
  const mostRecent = personRows[0];

  const slugs = [...new Set(personRows.map((row) => row.workshop_slug))];

  const { data: experienceData, error: experienceError } =
    slugs.length > 0
      ? await supabase
          .from("experiences")
          .select("id, slug, title, venue, start_date, end_date, clients(name), engagements(title)")
          .in("slug", slugs)
      : { data: [] as ExperienceDetailLookupRow[], error: null };

  if (experienceError) {
    throw new Error(experienceError.message);
  }

  const experienceBySlug = new Map(
    ((experienceData ?? []) as unknown as ExperienceDetailLookupRow[]).map((row) => [row.slug, row])
  );

  const participantIds = personRows.map((row) => row.id);
  const tokenByParticipantId = await fetchSatisfactionSurveyTokenMap(supabase);

  const { data: responseRows, error: responseError } = await supabase
    .from("survey_responses")
    .select("participant_id, overall_rating")
    .in("participant_id", participantIds)
    .eq("survey_type", "satisfaction");

  if (responseError) {
    throw new Error(responseError.message);
  }

  const satisfactionByParticipantId = new Map(
    (responseRows ?? []).map((row) => [row.participant_id as string, row.overall_rating as number])
  );

  const experienceHistory: ParticipantExperienceHistoryItem[] = personRows.map((row) => {
    const experience = experienceBySlug.get(row.workshop_slug);

    return {
      participantRowId: row.id,
      experienceId: experience?.id ?? null,
      experienceSlug: row.workshop_slug,
      experienceTitle: experience?.title ?? null,
      clientName: experience?.clients?.name ?? null,
      engagementTitle: experience?.engagements?.title ?? null,
      startDate: experience?.start_date ?? null,
      endDate: experience?.end_date ?? null,
      venue: experience?.venue ?? null,
      checkedIn: row.checked_in,
      checkedInAt: row.checked_in ? row.checked_in_at : null,
      surveyStatus: resolveSurveyStatus(tokenByParticipantId, row.id),
      satisfactionScore: satisfactionByParticipantId.get(row.id) ?? null,
    };
  });

  return {
    participant: {
      id: mostRecent.id,
      firstName: mostRecent.first_name,
      lastName: mostRecent.last_name,
      fullName: `${mostRecent.first_name} ${mostRecent.last_name}`.trim(),
      email: mostRecent.email,
      mobile: mostRecent.mobile,
      company: mostRecent.company,
      jobTitle: mostRecent.job_title,
    },
    experienceHistory,
  };
}

// ---------------------------------------------------------------------------
// Survey response history
// ---------------------------------------------------------------------------

export type ParticipantSurveyResponseItem = {
  id: string;
  experienceId: string;
  experienceTitle: string | null;
  contentRating: number;
  facilitatorRating: number;
  logisticsRating: number;
  overallRating: number;
  highlights: string | null;
  improvements: string | null;
  additionalComments: string | null;
  submittedAt: string;
};

export async function getParticipantSurveyHistory(
  anchorId: string
): Promise<ParticipantSurveyResponseItem[]> {
  const supabase = await createClient();

  const personRows = await resolvePersonParticipantRows(supabase, anchorId);

  if (!personRows || personRows.length === 0) {
    return [];
  }

  const participantIds = personRows.map((row) => row.id);

  const { data: responseRows, error: responseError } = await supabase
    .from("survey_responses")
    .select(
      "id, workshop_id, content_rating, facilitator_rating, logistics_rating, overall_rating, highlights, improvements, additional_comments, submitted_at"
    )
    .in("participant_id", participantIds)
    .eq("survey_type", "satisfaction")
    .order("submitted_at", { ascending: false });

  if (responseError) {
    throw new Error(responseError.message);
  }

  const rows = responseRows ?? [];
  const experienceIds = [...new Set(rows.map((row) => row.workshop_id as string))];

  const { data: experienceRows, error: experienceError } =
    experienceIds.length > 0
      ? await supabase.from("experiences").select("id, title").in("id", experienceIds)
      : { data: [] as { id: string; title: string }[], error: null };

  if (experienceError) {
    throw new Error(experienceError.message);
  }

  const titleByExperienceId = new Map((experienceRows ?? []).map((row) => [row.id, row.title]));

  return rows.map((row) => ({
    id: row.id as string,
    experienceId: row.workshop_id as string,
    experienceTitle: titleByExperienceId.get(row.workshop_id as string) ?? null,
    contentRating: row.content_rating as number,
    facilitatorRating: row.facilitator_rating as number,
    logisticsRating: row.logistics_rating as number,
    overallRating: row.overall_rating as number,
    highlights: row.highlights as string | null,
    improvements: row.improvements as string | null,
    additionalComments: row.additional_comments as string | null,
    submittedAt: row.submitted_at as string,
  }));
}
