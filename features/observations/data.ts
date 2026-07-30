import { createClient } from "@/infrastructure/supabase/server";
import { getSessionContext } from "@/infrastructure/session/session-context";

// ---------------------------------------------------------------------------
// Experience context for the AI report — mirrors
// features/reports/data.ts's own direct experience select (Sprint 29):
// each PDF/AI generator queries exactly the fields it needs rather than
// reusing the dashboard's general-purpose ExperienceDetailRecord.
// ---------------------------------------------------------------------------

export type ObservationExperienceContext = {
  title: string;
  clientName: string | null;
  venue: string | null;
  startDate: string;
  endDate: string;
  facilitatorName: string | null;
};

type ObservationExperienceRow = {
  title: string;
  client_name: string | null;
  venue: string | null;
  start_date: string;
  end_date: string;
  facilitator_name: string | null;
  clients: { name: string } | null;
};

export async function getExperienceContextForReport(
  experienceId: string
): Promise<ObservationExperienceContext | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("experiences")
    .select("title, client_name, venue, start_date, end_date, facilitator_name, clients(name)")
    .eq("id", experienceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as ObservationExperienceRow;

  return {
    title: row.title,
    clientName: row.clients?.name ?? row.client_name,
    venue: row.venue,
    startDate: row.start_date,
    endDate: row.end_date,
    facilitatorName: row.facilitator_name,
  };
}

// ---------------------------------------------------------------------------
// Observation tags — per-experience, operator-customizable. Every
// experience "starts with the defaults" (Sprint 31 brief) without a
// one-time backfill: getObservationTags seeds these seven the first time an
// experience's tags are read and none exist yet (see migration 0027's
// closing comment).
// ---------------------------------------------------------------------------

export type ObservationTag = {
  id: string;
  label: string;
  color: string;
  orderIndex: number;
};

const DEFAULT_OBSERVATION_TAGS: { label: string; color: string }[] = [
  { label: "Leadership", color: "#8B5CF6" },
  { label: "Quiet", color: "#6B7280" },
  { label: "Influential", color: "#F59E0B" },
  { label: "Analytical", color: "#3B82F6" },
  { label: "Resistant", color: "#EF4444" },
  { label: "Collaborative", color: "#10B981" },
  { label: "Engaged", color: "#C9A96E" },
];

type ObservationTagRow = { id: string; label: string; color: string; order_index: number };

function mapTag(row: ObservationTagRow): ObservationTag {
  return { id: row.id, label: row.label, color: row.color, orderIndex: row.order_index };
}

export async function getObservationTags(experienceId: string): Promise<ObservationTag[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("observation_tags")
    .select("id, label, color, order_index")
    .eq("experience_id", experienceId)
    .order("order_index", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  if (data && data.length > 0) {
    return data.map(mapTag);
  }

  const session = await getSessionContext();

  const { data: seeded, error: seedError } = await supabase
    .from("observation_tags")
    .insert(
      DEFAULT_OBSERVATION_TAGS.map((tag, index) => ({
        organization_id: session.organizationId,
        workspace_id: session.workspaceId,
        experience_id: experienceId,
        label: tag.label,
        color: tag.color,
        order_index: index,
      }))
    )
    .select("id, label, color, order_index");

  if (seedError) {
    throw new Error(seedError.message);
  }

  return (seeded ?? []).map(mapTag).sort((a, b) => a.orderIndex - b.orderIndex);
}

// ---------------------------------------------------------------------------
// Participant observations
// ---------------------------------------------------------------------------

export type ParticipantObservation = {
  id: string;
  participantId: string;
  facilitatorName: string;
  notes: string | null;
  tags: string[];
  updatedAt: string;
};

type ParticipantObservationRow = {
  id: string;
  participant_id: string;
  facilitator_name: string;
  notes: string | null;
  tags: string[];
  updated_at: string;
};

function mapParticipantObservation(row: ParticipantObservationRow): ParticipantObservation {
  return {
    id: row.id,
    participantId: row.participant_id,
    facilitatorName: row.facilitator_name,
    notes: row.notes,
    tags: row.tags ?? [],
    updatedAt: row.updated_at,
  };
}

/**
 * "The" observation for a participant, from this codebase's own perspective
 * — there is no facilitator-specific login (see migration 0027's header
 * comment), so "mine" means the row whose facilitator_name matches the
 * signed-in user's profile name, the value the observation panel's
 * Facilitator Name field defaults to. Other facilitators' observations of
 * the same participant are read via getAllParticipantObservations and shown
 * as a separate, read-only stacked list.
 */
export async function getParticipantObservation(
  experienceId: string,
  participantId: string
): Promise<ParticipantObservation | null> {
  const session = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("participant_observations")
    .select("id, participant_id, facilitator_name, notes, tags, updated_at")
    .eq("experience_id", experienceId)
    .eq("participant_id", participantId)
    .eq("facilitator_name", session.fullName ?? "")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapParticipantObservation(data as ParticipantObservationRow) : null;
}

export async function getAllParticipantObservations(experienceId: string): Promise<ParticipantObservation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("participant_observations")
    .select("id, participant_id, facilitator_name, notes, tags, updated_at")
    .eq("experience_id", experienceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapParticipantObservation(row as ParticipantObservationRow));
}

// ---------------------------------------------------------------------------
// Experience-level (overall) observations
// ---------------------------------------------------------------------------

export type ExperienceObservation = {
  id: string;
  facilitatorName: string;
  groupDynamics: string | null;
  keyThemes: string | null;
  recommendations: string | null;
  generalNotes: string | null;
  updatedAt: string;
};

type ExperienceObservationRow = {
  id: string;
  facilitator_name: string;
  group_dynamics: string | null;
  key_themes: string | null;
  recommendations: string | null;
  general_notes: string | null;
  updated_at: string;
};

function mapExperienceObservation(row: ExperienceObservationRow): ExperienceObservation {
  return {
    id: row.id,
    facilitatorName: row.facilitator_name,
    groupDynamics: row.group_dynamics,
    keyThemes: row.key_themes,
    recommendations: row.recommendations,
    generalNotes: row.general_notes,
    updatedAt: row.updated_at,
  };
}

/** "Mine" — see getParticipantObservation for why facilitator_name is the identity key. */
export async function getExperienceObservation(experienceId: string): Promise<ExperienceObservation | null> {
  const session = await getSessionContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("experience_observations")
    .select("id, facilitator_name, group_dynamics, key_themes, recommendations, general_notes, updated_at")
    .eq("experience_id", experienceId)
    .eq("facilitator_name", session.fullName ?? "")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapExperienceObservation(data as ExperienceObservationRow) : null;
}

/** Every facilitator's overall observations — the AI report context needs
 * all of them, not just the current user's. */
export async function getAllExperienceObservations(experienceId: string): Promise<ExperienceObservation[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("experience_observations")
    .select("id, facilitator_name, group_dynamics, key_themes, recommendations, general_notes, updated_at")
    .eq("experience_id", experienceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapExperienceObservation(row as ExperienceObservationRow));
}

// ---------------------------------------------------------------------------
// AI-drafted facilitator report
// ---------------------------------------------------------------------------

export type FacilitatorReportStatus = "draft" | "edited" | "approved" | "exported";

export type FacilitatorReport = {
  id: string;
  facilitatorName: string;
  draftContent: string;
  editedContent: string | null;
  status: FacilitatorReportStatus;
  generatedAt: string;
  approvedAt: string | null;
  exportedAt: string | null;
};

type FacilitatorReportRow = {
  id: string;
  facilitator_name: string;
  draft_content: string;
  edited_content: string | null;
  status: FacilitatorReportStatus;
  generated_at: string;
  approved_at: string | null;
  exported_at: string | null;
};

function mapFacilitatorReport(row: FacilitatorReportRow): FacilitatorReport {
  return {
    id: row.id,
    facilitatorName: row.facilitator_name,
    draftContent: row.draft_content,
    editedContent: row.edited_content,
    status: row.status,
    generatedAt: row.generated_at,
    approvedAt: row.approved_at,
    exportedAt: row.exported_at,
  };
}

/** The most recently updated report for this experience — in the common
 * case of a single facilitator drafting one report, this is simply "the"
 * report; see migration 0027 for why the underlying table allows more than
 * one (one per facilitator name). */
export async function getFacilitatorReport(experienceId: string): Promise<FacilitatorReport | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("facilitator_reports")
    .select(
      "id, facilitator_name, draft_content, edited_content, status, generated_at, approved_at, exported_at"
    )
    .eq("experience_id", experienceId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapFacilitatorReport(data as FacilitatorReportRow) : null;
}
