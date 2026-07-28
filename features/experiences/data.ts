import { createClient } from "@/infrastructure/supabase/server";
import type { ExperienceStatus } from "@/infrastructure/repositories/dashboard";
import type { ExperienceType } from "./schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// Options (for select/filter dropdowns elsewhere in the app)
// ---------------------------------------------------------------------------

export type ExperienceOption = { id: string; title: string; clientId: string | null };

// ---------------------------------------------------------------------------
// Public check-in form (/r/[slug])
// ---------------------------------------------------------------------------

export type CheckinExperienceContext = {
  title: string;
  titleAr: string | null;
  experienceType: ExperienceType;
  venue: string | null;
  startDate: string;
  endDate: string;
};

type CheckinContextRpcRow = {
  title: string;
  title_ar: string | null;
  experience_type: ExperienceType;
  venue: string | null;
  start_date: string;
  end_date: string;
};

/**
 * `experiences` is RLS-scoped to the authenticated user's own organization/
 * workspace, so a signed-out visitor on the public check-in form can't read
 * it via the ordinary session-bound client — that query just comes back
 * empty, no error. get_checkin_context (migration 0021) is a narrow,
 * security definer RPC exposing only what this page needs to display,
 * mirroring get_survey_context and get_materials_by_token's existing
 * pattern for other public, token/slug-driven pages.
 */
export async function getCheckinContextBySlug(slug: string): Promise<CheckinExperienceContext | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_checkin_context", { p_slug: slug }).maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as CheckinContextRpcRow;

  return {
    title: row.title,
    titleAr: row.title_ar,
    experienceType: row.experience_type,
    venue: row.venue,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}

export async function getExperienceOptions(): Promise<ExperienceOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("experiences")
    .select("id, title, client_id")
    .is("deleted_at", null)
    .order("title", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    clientId: row.client_id,
  }));
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export type ExperienceDetailRecord = {
  id: string;
  slug: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  experienceType: ExperienceType;
  programType: string | null;
  tags: string[];
  status: ExperienceStatus;
  startDate: string;
  endDate: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  capacity: number;
  clientId: string | null;
  clientName: string | null;
  engagementId: string | null;
  engagementTitle: string | null;
  clientContactName: string | null;
  clientContactEmail: string | null;
  facilitatorName: string | null;
  facilitatorEmail: string | null;
  facilitatorNotes: string | null;
  materialsNotes: string | null;
  logisticsNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ExperienceRow = {
  id: string;
  slug: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  experience_type: ExperienceType;
  program_type: string | null;
  tags: string[] | null;
  status: ExperienceStatus;
  start_date: string;
  end_date: string;
  venue: string | null;
  city: string | null;
  country: string | null;
  capacity: number;
  client_id: string | null;
  engagement_id: string | null;
  client_name: string | null;
  client_contact_name: string | null;
  client_contact_email: string | null;
  facilitator_name: string | null;
  facilitator_email: string | null;
  facilitator_notes: string | null;
  materials_notes: string | null;
  logistics_notes: string | null;
  created_at: string;
  updated_at: string;
  clients: { name: string } | null;
  engagements: { title: string } | null;
};

const EXPERIENCE_DETAIL_SELECT =
  "id, slug, title, title_ar, description, experience_type, program_type, tags, status, start_date, end_date, venue, city, country, capacity, client_id, engagement_id, client_name, client_contact_name, client_contact_email, facilitator_name, facilitator_email, facilitator_notes, materials_notes, logistics_notes, created_at, updated_at, clients(name), engagements(title)";

function mapExperience(row: ExperienceRow): ExperienceDetailRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    titleAr: row.title_ar,
    description: row.description,
    experienceType: row.experience_type,
    programType: row.program_type,
    tags: row.tags ?? [],
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    venue: row.venue,
    city: row.city,
    country: row.country,
    capacity: row.capacity,
    clientId: row.client_id,
    clientName: row.clients?.name ?? row.client_name,
    engagementId: row.engagement_id,
    engagementTitle: row.engagements?.title ?? null,
    clientContactName: row.client_contact_name,
    clientContactEmail: row.client_contact_email,
    facilitatorName: row.facilitator_name,
    facilitatorEmail: row.facilitator_email,
    facilitatorNotes: row.facilitator_notes,
    materialsNotes: row.materials_notes,
    logisticsNotes: row.logistics_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getExperienceBySlug(slug: string): Promise<ExperienceDetailRecord | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("experiences")
    .select(EXPERIENCE_DETAIL_SELECT)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapExperience(data as unknown as ExperienceRow);
}

/**
 * Same data as getExperienceBySlug — kept as its own named export because
 * the edit page's intent ("give me everything the edit form needs") is a
 * different call site than the detail page's, even though today the query
 * is identical.
 */
export async function getExperienceForEdit(slug: string): Promise<ExperienceDetailRecord | null> {
  return getExperienceBySlug(slug);
}

// ---------------------------------------------------------------------------
// Flat cross-client list (operations view) — filtered, server-side paginated
// ---------------------------------------------------------------------------

export type ExperienceListItem = {
  id: string;
  slug: string;
  title: string;
  experienceType: ExperienceType;
  status: ExperienceStatus;
  startDate: string;
  endDate: string;
  venue: string | null;
  capacity: number;
  clientId: string | null;
  clientName: string | null;
  engagementId: string | null;
  engagementTitle: string | null;
  participantCount: number;
  /** Rounded to 1 decimal; null when this experience has no satisfaction
   * survey responses yet. */
  avgSatisfaction: number | null;
};

export type ExperienceListFilters = {
  search?: string;
  clientId?: string;
  engagementId?: string;
  experienceType?: ExperienceType;
  status?: ExperienceStatus;
  /** Inclusive, "YYYY-MM-DD" — filters on start_date. */
  dateFrom?: string;
  /** Inclusive, "YYYY-MM-DD" — filters on start_date. */
  dateTo?: string;
};

export type PaginatedExperiences = {
  experiences: ExperienceListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ExperienceListRow = {
  id: string;
  slug: string;
  title: string;
  experience_type: ExperienceType;
  status: ExperienceStatus;
  start_date: string;
  end_date: string;
  venue: string | null;
  capacity: number;
  client_id: string | null;
  engagement_id: string | null;
  clients: { name: string } | null;
  engagements: { title: string } | null;
};

const EXPERIENCE_LIST_SELECT =
  "id, slug, title, experience_type, status, start_date, end_date, venue, capacity, client_id, engagement_id, clients(name), engagements(title)";

const EXPERIENCE_DEFAULT_PAGE_SIZE = 25;
const EXPERIENCE_MAX_PAGE_SIZE = 100;

/** Same escaping as features/participants/data.ts's sanitizeSearchTerm —
 * `.ilike()`'s pattern is a raw string, so `%`/`_` need escaping and a
 * literal comma/paren can't reach into PostgREST's own filter syntax. */
function sanitizeExperienceSearchTerm(term: string): string {
  return term.replace(/[,()]/g, "").replace(/[%_]/g, (char) => `\\${char}`);
}

/** "YYYY-MM-DD" -> the next calendar day, so an inclusive `dateTo` can be
 * applied as an exclusive `.lt()` against a timestamptz column without
 * excluding same-day experiences that start after midnight UTC. */
function exclusiveUpperBound(dateOnly: string): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function experiencesSelectQuery(supabase: SupabaseServerClient) {
  return supabase
    .from("experiences")
    .select(EXPERIENCE_LIST_SELECT, { count: "exact" })
    .is("deleted_at", null)
    .order("start_date", { ascending: false });
}

type ExperiencesSelectQuery = ReturnType<typeof experiencesSelectQuery>;

function applyExperienceFilters(query: ExperiencesSelectQuery, filters: ExperienceListFilters): ExperiencesSelectQuery {
  let q = query;

  if (filters.clientId) {
    q = q.eq("client_id", filters.clientId);
  }
  if (filters.engagementId) {
    q = q.eq("engagement_id", filters.engagementId);
  }
  if (filters.experienceType) {
    q = q.eq("experience_type", filters.experienceType);
  }
  if (filters.status) {
    q = q.eq("status", filters.status);
  }
  if (filters.dateFrom) {
    q = q.gte("start_date", `${filters.dateFrom}T00:00:00.000Z`);
  }
  if (filters.dateTo) {
    q = q.lt("start_date", exclusiveUpperBound(filters.dateTo));
  }
  if (filters.search) {
    const term = sanitizeExperienceSearchTerm(filters.search.trim());
    if (term) {
      q = q.ilike("title", `%${term}%`);
    }
  }

  return q;
}

async function fetchExperiencesPage(
  supabase: SupabaseServerClient,
  filters: ExperienceListFilters,
  page: number,
  pageSize: number
): Promise<{ rows: ExperienceListRow[]; count: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const query = applyExperienceFilters(experiencesSelectQuery(supabase), filters).range(from, to);
  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return { rows: (data ?? []) as unknown as ExperienceListRow[], count: count ?? 0 };
}

/**
 * True server-side pagination, mirroring features/participants/data.ts's
 * getAllParticipants: every filter (search, client, engagement, type,
 * status, date range) is applied in the database query itself via
 * `.range()` + an exact count, so only `pageSize` experience rows are ever
 * fetched regardless of how many match. Participant counts and satisfaction
 * averages can't be expressed as a plain join (they're aggregates from two
 * other tables), so they're resolved by a second pair of queries scoped to
 * just this page's experience ids/slugs (at most `pageSize`, well under the
 * .in() URL-length ceiling) — never the whole `participants`/
 * `survey_responses` tables, which is exactly the pattern that silently
 * truncated /dashboard/experiences at scale before.
 */
export async function getAllExperiencesFiltered(
  filters: ExperienceListFilters & { page?: number; pageSize?: number } = {}
): Promise<PaginatedExperiences> {
  const pageSize = Math.min(Math.max(1, filters.pageSize ?? EXPERIENCE_DEFAULT_PAGE_SIZE), EXPERIENCE_MAX_PAGE_SIZE);
  const supabase = await createClient();

  const requestedPage = Math.max(1, filters.page ?? 1);
  let { rows, count } = await fetchExperiencesPage(supabase, filters, requestedPage, pageSize);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  let page = requestedPage;

  // The requested page landed past the last page — most likely a filter
  // narrowed the result set while a stale ?page= from before still pointed
  // further in. Refetch the actual last page rather than return nothing.
  if (rows.length === 0 && count > 0 && requestedPage > 1) {
    page = totalPages;
    ({ rows, count } = await fetchExperiencesPage(supabase, filters, page, pageSize));
  }

  const slugs = rows.map((row) => row.slug);
  const ids = rows.map((row) => row.id);

  const [participantsResult, responsesResult] = await Promise.all([
    slugs.length > 0
      ? supabase.from("participants").select("workshop_slug").in("workshop_slug", slugs)
      : Promise.resolve({ data: [] as { workshop_slug: string }[], error: null }),
    ids.length > 0
      ? supabase
          .from("survey_responses")
          .select("workshop_id, overall_rating")
          .eq("survey_type", "satisfaction")
          .in("workshop_id", ids)
      : Promise.resolve({ data: [] as { workshop_id: string; overall_rating: number | null }[], error: null }),
  ]);

  if (participantsResult.error) {
    throw new Error(participantsResult.error.message);
  }
  if (responsesResult.error) {
    throw new Error(responsesResult.error.message);
  }

  const participantCountBySlug = new Map<string, number>();
  for (const row of participantsResult.data ?? []) {
    participantCountBySlug.set(row.workshop_slug, (participantCountBySlug.get(row.workshop_slug) ?? 0) + 1);
  }

  const ratingsByExperienceId = new Map<string, number[]>();
  for (const row of responsesResult.data ?? []) {
    if (row.overall_rating === null) continue;
    const bucket = ratingsByExperienceId.get(row.workshop_id) ?? [];
    bucket.push(row.overall_rating);
    ratingsByExperienceId.set(row.workshop_id, bucket);
  }

  const experiences: ExperienceListItem[] = rows.map((row) => {
    const ratings = ratingsByExperienceId.get(row.id) ?? [];
    const avgSatisfaction =
      ratings.length > 0 ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10 : null;

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      experienceType: row.experience_type,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      venue: row.venue,
      capacity: row.capacity,
      clientId: row.client_id,
      clientName: row.clients?.name ?? null,
      engagementId: row.engagement_id,
      engagementTitle: row.engagements?.title ?? null,
      participantCount: participantCountBySlug.get(row.slug) ?? 0,
      avgSatisfaction,
    };
  });

  return { experiences, totalCount: count, page, pageSize, totalPages };
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export type SurveyStatus = "not_sent" | "sent" | "opened" | "completed";

export type ExperienceParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  jobTitle: string | null;
  checkedIn: boolean;
  checkedInAt: string;
  registeredAt: string;
  surveyStatus: SurveyStatus;
};

type ParticipantRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  job_title: string | null;
  checked_in: boolean;
  checked_in_at: string;
  created_at: string;
};

type SurveyTokenStatusRow = {
  participant_id: string;
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
};

/**
 * `participants` only carries `workshop_slug` (text, unchanged by the
 * Sprint 11 rename), not an `experience_id` foreign key, so resolving the
 * slug is a required extra step here.
 */
export async function getExperienceParticipants(experienceId: string): Promise<ExperienceParticipant[]> {
  const supabase = await createClient();

  const { data: experienceRow, error: experienceError } = await supabase
    .from("experiences")
    .select("slug")
    .eq("id", experienceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (experienceError) {
    throw new Error(experienceError.message);
  }

  if (!experienceRow) {
    return [];
  }

  const [participantsResult, tokensResult] = await Promise.all([
    supabase
      .from("participants")
      .select("id, first_name, last_name, email, company, job_title, checked_in, checked_in_at, created_at")
      .eq("workshop_slug", experienceRow.slug)
      .order("created_at", { ascending: true }),
    supabase
      .from("survey_tokens")
      .select("participant_id, sent_at, opened_at, completed_at")
      .eq("workshop_id", experienceId)
      .eq("survey_type", "satisfaction"),
  ]);

  if (participantsResult.error) {
    throw new Error(participantsResult.error.message);
  }

  if (tokensResult.error) {
    throw new Error(tokensResult.error.message);
  }

  const participantRows: ParticipantRow[] = participantsResult.data ?? [];
  const tokenRows: SurveyTokenStatusRow[] = tokensResult.data ?? [];
  const tokenByParticipantId = new Map(tokenRows.map((token) => [token.participant_id, token]));

  return participantRows.map((participant) => {
    const token = tokenByParticipantId.get(participant.id) ?? null;

    let surveyStatus: SurveyStatus = "not_sent";
    if (token?.completed_at) {
      surveyStatus = "completed";
    } else if (token?.opened_at) {
      surveyStatus = "opened";
    } else if (token?.sent_at) {
      surveyStatus = "sent";
    }

    return {
      id: participant.id,
      firstName: participant.first_name,
      lastName: participant.last_name,
      email: participant.email,
      company: participant.company,
      jobTitle: participant.job_title,
      checkedIn: participant.checked_in,
      checkedInAt: participant.checked_in_at,
      registeredAt: participant.created_at,
      surveyStatus,
    };
  });
}

// ---------------------------------------------------------------------------
// Survey results
// ---------------------------------------------------------------------------

export type SurveyDimensionAverages = {
  content: number | null;
  facilitator: number | null;
  logistics: number | null;
  overall: number | null;
};

export type SurveyResponseSummary = {
  id: string;
  participantFirstName: string;
  contentRating: number;
  facilitatorRating: number;
  logisticsRating: number;
  overallRating: number;
  highlights: string | null;
  improvements: string | null;
  additionalComments: string | null;
  submittedAt: string;
  flagged: boolean;
};

export type ExperienceSurveyResults = {
  averages: SurveyDimensionAverages;
  responses: SurveyResponseSummary[];
};

type SurveyResponseRow = {
  id: string;
  participant_id: string;
  content_rating: number;
  facilitator_rating: number;
  logistics_rating: number;
  overall_rating: number;
  highlights: string | null;
  improvements: string | null;
  additional_comments: string | null;
  submitted_at: string;
  flagged: boolean;
};

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export async function getExperienceSurveyResults(experienceId: string): Promise<ExperienceSurveyResults> {
  const supabase = await createClient();

  const { data: responseRows, error: responsesError } = await supabase
    .from("survey_responses")
    .select(
      "id, participant_id, content_rating, facilitator_rating, logistics_rating, overall_rating, highlights, improvements, additional_comments, submitted_at, flagged"
    )
    .eq("workshop_id", experienceId)
    // Sprint 17: content_rating/etc. are nullable now — a null here
    // means this response was submitted against a custom template (its
    // answers live in survey_answers, surfaced separately via
    // getSurveyResultsByTemplate) rather than the legacy hardcoded
    // form. Filtering keeps this function's contract exactly as it was
    // for genuinely legacy responses.
    .not("overall_rating", "is", null)
    .order("submitted_at", { ascending: false });

  if (responsesError) {
    throw new Error(responsesError.message);
  }

  const rows: SurveyResponseRow[] = responseRows ?? [];

  // Scoped to just this experience's respondents (never more than a few
  // hundred), not every participant org-wide — avoids both the 1000-row
  // PostgREST cap and fetching thousands of unrelated rows for a lookup.
  const participantIds = [...new Set(rows.map((row) => row.participant_id))];
  const { data: participantRows, error: participantsError } =
    participantIds.length > 0
      ? await supabase.from("participants").select("id, first_name").in("id", participantIds)
      : { data: [] as { id: string; first_name: string }[], error: null };

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  const firstNameByParticipantId = new Map(
    (participantRows ?? []).map((p) => [p.id as string, p.first_name as string])
  );

  const responses: SurveyResponseSummary[] = rows.map((row) => ({
    id: row.id,
    participantFirstName: firstNameByParticipantId.get(row.participant_id) ?? "Participant",
    contentRating: row.content_rating,
    facilitatorRating: row.facilitator_rating,
    logisticsRating: row.logistics_rating,
    overallRating: row.overall_rating,
    highlights: row.highlights,
    improvements: row.improvements,
    additionalComments: row.additional_comments,
    submittedAt: row.submitted_at,
    flagged: row.flagged,
  }));

  const averages: SurveyDimensionAverages = {
    content: average(rows.map((row) => row.content_rating)),
    facilitator: average(rows.map((row) => row.facilitator_rating)),
    logistics: average(rows.map((row) => row.logistics_rating)),
    overall: average(rows.map((row) => row.overall_rating)),
  };

  return { averages, responses };
}

// ---------------------------------------------------------------------------
// Logistics
// ---------------------------------------------------------------------------

export const LOGISTICS_CATEGORIES = [
  "venue",
  "catering",
  "printing",
  "shipping",
  "travel",
  "accommodation",
  "av_equipment",
  "materials",
  "communication",
  "other",
] as const;

export type LogisticsCategory = (typeof LOGISTICS_CATEGORIES)[number];

export type LogisticsStatus = "pending" | "in_progress" | "completed" | "blocked" | "not_applicable";

export type LogisticsTask = {
  id: string;
  category: LogisticsCategory;
  title: string;
  description: string | null;
  assignedTo: string | null;
  dueDate: string | null;
  status: LogisticsStatus;
  notes: string | null;
  completedAt: string | null;
};

export type LogisticsCategoryGroup = {
  category: LogisticsCategory;
  tasks: LogisticsTask[];
};

type LogisticsTaskRow = {
  id: string;
  category: LogisticsCategory;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: LogisticsStatus;
  notes: string | null;
  completed_at: string | null;
};

export async function getExperienceLogisticsTasks(experienceId: string): Promise<LogisticsCategoryGroup[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("logistics_tasks")
    .select("id, category, title, description, assigned_to, due_date, status, notes, completed_at")
    .eq("workshop_id", experienceId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows: LogisticsTaskRow[] = data ?? [];

  const tasksByCategory = new Map<LogisticsCategory, LogisticsTask[]>();
  for (const row of rows) {
    const bucket = tasksByCategory.get(row.category) ?? [];
    bucket.push({
      id: row.id,
      category: row.category,
      title: row.title,
      description: row.description,
      assignedTo: row.assigned_to,
      dueDate: row.due_date,
      status: row.status,
      notes: row.notes,
      completedAt: row.completed_at,
    });
    tasksByCategory.set(row.category, bucket);
  }

  return LOGISTICS_CATEGORIES.filter((category) => tasksByCategory.has(category)).map((category) => ({
    category,
    tasks: tasksByCategory.get(category)!,
  }));
}
