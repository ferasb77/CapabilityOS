import { createClient } from "@/infrastructure/supabase/server";
import type { AvailableFrom, MaterialAudience, MaterialType } from "./schema";

export type Material = {
  id: string;
  experienceId: string;
  title: string;
  description: string | null;
  materialType: MaterialType;
  filePath: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  url: string | null;
  audience: MaterialAudience;
  availableFrom: AvailableFrom;
  isReleased: boolean;
  orderIndex: number;
  uploadedByName: string | null;
  uploadedByFacilitatorName: string | null;
  createdAt: string;
  updatedAt: string;
};

type MaterialRow = {
  id: string;
  experience_id: string;
  title: string;
  description: string | null;
  material_type: MaterialType;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  url: string | null;
  audience: MaterialAudience;
  available_from: AvailableFrom;
  is_released: boolean;
  order_index: number;
  uploaded_by: string | null;
  uploaded_by_facilitator_id: string | null;
  created_at: string;
  updated_at: string;
};

const MATERIAL_SELECT =
  "id, experience_id, title, description, material_type, file_path, file_name, file_size_bytes, mime_type, url, audience, available_from, is_released, order_index, uploaded_by, uploaded_by_facilitator_id, created_at, updated_at";

/**
 * `audienceFilter` maps to the underlying `audience` values a section
 * cares about: the Participant Materials section wants
 * ('participant','both'), the Facilitator Resources section wants
 * ('facilitator','both'). Omit it to fetch everything (used internally
 * before splitting into sections, so both lists come from one query).
 */
export async function getExperienceMaterials(
  experienceId: string,
  audienceFilter?: "participant" | "facilitator"
): Promise<Material[]> {
  const supabase = await createClient();

  let query = supabase
    .from("experience_materials")
    .select(MATERIAL_SELECT)
    .eq("experience_id", experienceId)
    .is("deleted_at", null)
    .order("order_index", { ascending: true });

  if (audienceFilter === "participant") {
    query = query.in("audience", ["participant", "both"]);
  } else if (audienceFilter === "facilitator") {
    query = query.in("audience", ["facilitator", "both"]);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MaterialRow[];

  const profileIds = [...new Set(rows.map((row) => row.uploaded_by).filter((id): id is string => Boolean(id)))];
  const facilitatorIds = [
    ...new Set(rows.map((row) => row.uploaded_by_facilitator_id).filter((id): id is string => Boolean(id))),
  ];

  const [profilesResult, facilitatorsResult] = await Promise.all([
    profileIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null }),
    facilitatorIds.length > 0
      ? supabase.from("facilitators").select("id, first_name, last_name").in("id", facilitatorIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[], error: null }),
  ]);

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }
  if (facilitatorsResult.error) {
    throw new Error(facilitatorsResult.error.message);
  }

  const profileNameById = new Map((profilesResult.data ?? []).map((row) => [row.id, row.full_name]));
  const facilitatorNameById = new Map(
    (facilitatorsResult.data ?? []).map((row) => [row.id, `${row.first_name} ${row.last_name}`.trim()])
  );

  return rows.map((row) => ({
    id: row.id,
    experienceId: row.experience_id,
    title: row.title,
    description: row.description,
    materialType: row.material_type,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    mimeType: row.mime_type,
    url: row.url,
    audience: row.audience,
    availableFrom: row.available_from,
    isReleased: row.is_released,
    orderIndex: row.order_index,
    uploadedByName: row.uploaded_by ? (profileNameById.get(row.uploaded_by) ?? null) : null,
    uploadedByFacilitatorName: row.uploaded_by_facilitator_id
      ? (facilitatorNameById.get(row.uploaded_by_facilitator_id) ?? null)
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export type PortalMaterial = {
  id: string;
  title: string;
  description: string | null;
  materialType: MaterialType;
  filePath: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  url: string | null;
  availableFrom: AvailableFrom;
};

export type MaterialsPortalData = {
  participantFirstName: string;
  experienceTitle: string;
  experienceStartDate: string;
  experienceEndDate: string;
  experienceVenue: string | null;
  materials: PortalMaterial[];
};

type RpcMaterialRow = {
  id: string;
  title: string;
  description: string | null;
  material_type: MaterialType;
  file_path: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  url: string | null;
  available_from: AvailableFrom;
  order_index: number;
};

type RpcRow = {
  token_id: string | null;
  participant_id: string | null;
  experience_id: string | null;
  participant_first_name: string | null;
  experience_title: string | null;
  experience_start_date: string | null;
  experience_end_date: string | null;
  experience_venue: string | null;
  materials: RpcMaterialRow[] | null;
};

export async function getMaterialsByToken(token: string): Promise<MaterialsPortalData | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_materials_by_token", { p_token: token }).maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as RpcRow;

  if (!row.token_id) {
    return null;
  }

  return {
    participantFirstName: row.participant_first_name ?? "there",
    experienceTitle: row.experience_title ?? "the experience",
    experienceStartDate: row.experience_start_date ?? "",
    experienceEndDate: row.experience_end_date ?? "",
    experienceVenue: row.experience_venue,
    materials: (row.materials ?? []).map((material) => ({
      id: material.id,
      title: material.title,
      description: material.description,
      materialType: material.material_type,
      filePath: material.file_path,
      fileName: material.file_name,
      fileSizeBytes: material.file_size_bytes,
      mimeType: material.mime_type,
      url: material.url,
      availableFrom: material.available_from,
    })),
  };
}

export type MaterialTokenRow = {
  id: string;
  token: string;
};

export async function getParticipantMaterialToken(
  participantId: string,
  experienceId: string
): Promise<MaterialTokenRow | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("participant_material_tokens")
    .select("id, token")
    .eq("participant_id", participantId)
    .eq("experience_id", experienceId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
