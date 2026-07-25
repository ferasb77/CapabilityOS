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

/** Supabase/PostgREST caps a plain `.select()` at 1000 rows by default, and
 * an `.in(column, ids)` filter built from an unbounded id list can also blow
 * past the request's max URL length once there are thousands of ids (this
 * is exactly what was crashing /dashboard/participants with a 400 Bad
 * Request once the workspace passed ~1000 participants — see Sprint 25's
 * fetchAllRows in infrastructure/repositories/dashboard.ts for the same
 * guard applied there). Every query here that can plausibly return/scope
 * more than 1000 rows goes through this pager and never builds an `.in()`
 * list from a full, unbounded id set. */
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

/**
 * The one place that resolves "which participants match these filters" —
 * shared by the paginated list (getAllParticipants) and the unpaginated
 * CSV export (exportParticipants, in ./actions — a Server Action can't be
 * inlined in this file alongside these server-only data functions once a
 * Client Component imports from it, so the export function itself lives
 * separately and calls back into this shared resolver) so the two can
 * never drift out of sync on what counts as a match.
 *
 * `search` is deliberately not part of ParticipantFilters: the list page
 * applies search client-side against whatever page is already loaded (see
 * ParticipantsView), but the export button still needs it — the exported
 * CSV should reflect the exact rows currently visible on screen, search
 * included — so it's accepted here as an extra, export-only parameter.
 */
export async function fetchFilteredParticipants(
  filters: ParticipantFilters & { search?: string }
): Promise<ParticipantListItem[]> {
  const supabase = await createClient();

  // Always need experience -> {title, clientName} for every candidate
  // participant; when experienceId/clientId filters are active, this same
  // query also determines which workshop_slugs are in scope.
  let experienceQuery = supabase
    .from("experiences")
    .select("id, slug, title, clients(name)")
    .is("deleted_at", null);

  if (filters.experienceId) {
    experienceQuery = experienceQuery.eq("id", filters.experienceId);
  } else if (filters.clientId) {
    experienceQuery = experienceQuery.eq("client_id", filters.clientId);
  }

  const { data: experienceData, error: experienceError } = await experienceQuery;

  if (experienceError) {
    throw new Error(experienceError.message);
  }

  const experienceRows = (experienceData ?? []) as unknown as ExperienceLookupRow[];
  const experienceBySlug = new Map(experienceRows.map((row) => [row.slug, row]));

  const isScoped = Boolean(filters.experienceId || filters.clientId);
  if (isScoped && experienceRows.length === 0) {
    return [];
  }

  const participantRows = await fetchAllRows<ParticipantRow>((from, to) => {
    let query = supabase
      .from("participants")
      .select(
        "id, first_name, last_name, email, mobile, company, job_title, workshop_slug, checked_in, checked_in_at, created_at"
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (isScoped) {
      query = query.in(
        "workshop_slug",
        experienceRows.map((row) => row.slug)
      );
    }

    if (filters.checkinStatus === "checked_in") {
      query = query.eq("checked_in", true);
    } else if (filters.checkinStatus === "not_checked_in") {
      query = query.eq("checked_in", false);
    }

    return query;
  });

  const tokenByParticipantId = await fetchSatisfactionSurveyTokenMap(supabase);

  let items: ParticipantListItem[] = participantRows.map((row) => {
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
  });

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

/**
 * Every satisfaction survey_tokens row, keyed by participant_id. Fetched in
 * full (paginated, not scoped by an `.in(participant_id, ...)` list) so this
 * works the same way whether the caller needs one participant's token or
 * every participant's — an `.in()` filter built from a large id list is
 * exactly what was crashing the unscoped participants list with a 400 Bad
 * Request (see fetchAllRows's comment above).
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

const PAGE_SIZE = 25;

export async function getAllParticipants(
  filters: ParticipantFilters & { page?: number } = {}
): Promise<PaginatedParticipants> {
  const items = await fetchFilteredParticipants(filters);

  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const start = (page - 1) * PAGE_SIZE;

  return {
    participants: items.slice(start, start + PAGE_SIZE),
    totalCount,
    page,
    pageSize: PAGE_SIZE,
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
