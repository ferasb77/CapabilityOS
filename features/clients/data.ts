import { createClient } from "@/infrastructure/supabase/server";
import type { ClientType } from "./schema";

const MAX_FETCH_PAGE = 1000;
const IN_FILTER_SAFE_LIMIT = 200;

/** Supabase/PostgREST caps a plain `.select()` at 1000 rows by default —
 * `participants`/`survey_responses` run into the thousands, so any query here
 * that can plausibly exceed 1000 rows goes through this pager instead of
 * risking a silent truncation. Mirrors infrastructure/repositories/dashboard.ts. */
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

/** Fetches rows scoped to a dynamic id/slug list via `.in()` — an `.in()`
 * filter built from an unbounded list is the failure mode that crashed
 * /dashboard/participants (request URL too long). Past IN_FILTER_SAFE_LIMIT
 * entries, falls back to a paginated unfiltered fetch plus client-side
 * filtering instead. Mirrors infrastructure/repositories/dashboard.ts. */
async function fetchScopedByKey<T>(
  keys: string[],
  keyOf: (row: T) => string,
  label: string,
  queryWithIn: (from: number, to: number, keys: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  queryWithoutIn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  if (keys.length === 0) return [];

  if (keys.length > IN_FILTER_SAFE_LIMIT) {
    console.warn(
      `[clients] ${label}: key list has ${keys.length} entries, over the ${IN_FILTER_SAFE_LIMIT}-item .in() safety limit — falling back to an unfiltered fetch with client-side filtering.`
    );
    const keySet = new Set(keys);
    const allRows = await fetchAllRows<T>(queryWithoutIn);
    return allRows.filter((row) => keySet.has(keyOf(row)));
  }

  return fetchAllRows<T>((from, to) => queryWithIn(from, to, keys));
}

// ---------------------------------------------------------------------------
// Directory summary
// ---------------------------------------------------------------------------

export type ClientSummary = {
  id: string;
  name: string;
  type: ClientType;
  industry: string | null;
  country: string | null;
  city: string | null;
  primaryContactName: string | null;
  isActive: boolean;
  engagementCount: number;
  activeEngagementCount: number;
};

type ClientRow = {
  id: string;
  name: string;
  type: ClientType;
  industry: string | null;
  country: string | null;
  city: string | null;
  primary_contact_name: string | null;
  is_active: boolean;
};

export async function getAllClients(): Promise<ClientSummary[]> {
  const supabase = await createClient();

  const [{ data: clientRows, error: clientsError }, { data: engagementRows, error: engagementsError }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, name, type, industry, country, city, primary_contact_name, is_active")
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase.from("engagements").select("client_id, status").is("deleted_at", null),
    ]);

  if (clientsError) {
    throw new Error(clientsError.message);
  }

  if (engagementsError) {
    throw new Error(engagementsError.message);
  }

  const engagementCountByClient = new Map<string, number>();
  const activeEngagementCountByClient = new Map<string, number>();
  for (const row of engagementRows ?? []) {
    engagementCountByClient.set(row.client_id, (engagementCountByClient.get(row.client_id) ?? 0) + 1);
    if (row.status === "active") {
      activeEngagementCountByClient.set(
        row.client_id,
        (activeEngagementCountByClient.get(row.client_id) ?? 0) + 1
      );
    }
  }

  const rows: ClientRow[] = clientRows ?? [];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    industry: row.industry,
    country: row.country,
    city: row.city,
    primaryContactName: row.primary_contact_name,
    isActive: row.is_active,
    engagementCount: engagementCountByClient.get(row.id) ?? 0,
    activeEngagementCount: activeEngagementCountByClient.get(row.id) ?? 0,
  }));
}

export type ClientOption = { id: string; name: string };

export async function getClientOptions(): Promise<ClientOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export type ClientDetailRecord = {
  id: string;
  name: string;
  type: ClientType;
  industry: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ClientDetailRow = {
  id: string;
  name: string;
  type: ClientType;
  industry: string | null;
  country: string | null;
  city: string | null;
  website: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function getClientById(id: string): Promise<ClientDetailRecord | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, name, type, industry, country, city, website, primary_contact_name, primary_contact_email, primary_contact_phone, notes, is_active, created_at, updated_at"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as ClientDetailRow;

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    industry: row.industry,
    country: row.country,
    city: row.city,
    website: row.website,
    primaryContactName: row.primary_contact_name,
    primaryContactEmail: row.primary_contact_email,
    primaryContactPhone: row.primary_contact_phone,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Relationship history
// ---------------------------------------------------------------------------

export type ClientRelationshipHistory = {
  totalExperiences: number;
  totalParticipants: number;
  averageSatisfaction: number | null;
};

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export async function getClientRelationshipHistory(clientId: string): Promise<ClientRelationshipHistory> {
  const supabase = await createClient();

  const { data: experienceRows, error: experiencesError } = await supabase
    .from("experiences")
    .select("id, slug")
    .eq("client_id", clientId)
    .is("deleted_at", null);

  if (experiencesError) {
    throw new Error(experiencesError.message);
  }

  const experiences = experienceRows ?? [];

  if (experiences.length === 0) {
    return { totalExperiences: 0, totalParticipants: 0, averageSatisfaction: null };
  }

  const experienceIds = experiences.map((row) => row.id);
  const slugs = experiences.map((row) => row.slug);

  const [participantRows, responseRows] = await Promise.all([
    fetchScopedByKey<{ id: string; workshop_slug: string }>(
      slugs,
      (row) => row.workshop_slug,
      "getClientRelationshipHistory participants",
      (from, to, keys) => supabase.from("participants").select("id, workshop_slug").in("workshop_slug", keys).range(from, to),
      (from, to) => supabase.from("participants").select("id, workshop_slug").range(from, to)
    ),
    fetchScopedByKey<{ overall_rating: number | null; workshop_id: string }>(
      experienceIds,
      (row) => row.workshop_id,
      "getClientRelationshipHistory survey_responses",
      (from, to, keys) =>
        supabase
          .from("survey_responses")
          .select("overall_rating, workshop_id")
          .in("workshop_id", keys)
          .eq("survey_type", "satisfaction")
          .range(from, to),
      (from, to) =>
        supabase.from("survey_responses").select("overall_rating, workshop_id").eq("survey_type", "satisfaction").range(from, to)
    ),
  ]);

  return {
    totalExperiences: experiences.length,
    totalParticipants: participantRows.length,
    averageSatisfaction: average(responseRows.map((row) => row.overall_rating as number)),
  };
}
