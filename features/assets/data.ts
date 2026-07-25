import { createClient } from "@/infrastructure/supabase/server";
import type { AssetType, AssignmentStatus } from "./schema";

export type Asset = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  assetType: AssetType;
  category: string | null;
  serialNumber: string | null;
  location: string | null;
  stockQuantity: number;
  stockUnit: string;
  reorderThreshold: number | null;
  reorderQuantity: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type AssetRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  asset_type: AssetType;
  category: string | null;
  serial_number: string | null;
  location: string | null;
  stock_quantity: number;
  stock_unit: string;
  reorder_threshold: number | null;
  reorder_quantity: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const ASSET_SELECT =
  "id, workspace_id, name, description, asset_type, category, serial_number, location, stock_quantity, stock_unit, reorder_threshold, reorder_quantity, is_active, notes, created_at, updated_at";

function toAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    assetType: row.asset_type,
    category: row.category,
    serialNumber: row.serial_number,
    location: row.location,
    stockQuantity: row.stock_quantity,
    stockUnit: row.stock_unit,
    reorderThreshold: row.reorder_threshold,
    reorderQuantity: row.reorder_quantity,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CurrentAssignment = {
  experienceId: string;
  experienceTitle: string;
  startDate: string;
  endDate: string;
};

export type AssetWithStatus = Asset & {
  currentAssignment: CurrentAssignment | null;
};

type LinkedExperience = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
  deleted_at: string | null;
};

type ActiveAssignmentRow = {
  asset_id: string;
  experiences: LinkedExperience | null;
};

/**
 * All active assets in the workspace, each carrying its live status for the
 * Unique Assets table: `currentAssignment` is set only when today falls
 * inside an active (non-cancelled/completed) experience's date range, per
 * the brief's "computed live — overlapping today" rule. A unique asset with
 * a future or past assignment but nothing active today shows as Available.
 */
export async function getAllAssets(workspaceId: string): Promise<AssetWithStatus[]> {
  const supabase = await createClient();

  const [assetsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("assets")
      .select(ASSET_SELECT)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("experience_assets")
      .select("asset_id, experiences(id, title, start_date, end_date, status, deleted_at)")
      .eq("workspace_id", workspaceId)
      .neq("status", "returned"),
  ]);

  if (assetsResult.error) {
    throw new Error(assetsResult.error.message);
  }
  if (assignmentsResult.error) {
    throw new Error(assignmentsResult.error.message);
  }

  const rows = (assetsResult.data ?? []) as AssetRow[];
  const assignmentRows = (assignmentsResult.data ?? []) as unknown as ActiveAssignmentRow[];

  const now = Date.now();
  const currentAssignmentByAssetId = new Map<string, CurrentAssignment>();

  for (const row of assignmentRows) {
    const experience = row.experiences;
    if (!experience || experience.deleted_at) {
      continue;
    }
    if (experience.status === "cancelled" || experience.status === "completed") {
      continue;
    }

    const start = new Date(experience.start_date).getTime();
    const end = new Date(experience.end_date).getTime();
    if (now < start || now > end) {
      continue;
    }

    // A unique asset should never legitimately have two assignments
    // overlapping today — assignAsset hard-blocks that before it can
    // happen — so the first match found is kept.
    if (!currentAssignmentByAssetId.has(row.asset_id)) {
      currentAssignmentByAssetId.set(row.asset_id, {
        experienceId: experience.id,
        experienceTitle: experience.title,
        startDate: experience.start_date,
        endDate: experience.end_date,
      });
    }
  }

  return rows.map((row) => ({
    ...toAsset(row),
    currentAssignment: currentAssignmentByAssetId.get(row.id) ?? null,
  }));
}

export async function getAssetById(assetId: string): Promise<Asset | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assets")
    .select(ASSET_SELECT)
    .eq("id", assetId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? toAsset(data as AssetRow) : null;
}

export type ExperienceAsset = {
  id: string;
  experienceId: string;
  assetId: string;
  assetName: string;
  assetType: AssetType;
  category: string | null;
  stockUnit: string | null;
  quantityNeeded: number;
  status: AssignmentStatus;
  notes: string | null;
  assignedAt: string;
};

type ExperienceAssetRow = {
  id: string;
  experience_id: string;
  asset_id: string;
  quantity_needed: number;
  status: AssignmentStatus;
  notes: string | null;
  assigned_at: string;
  assets: { name: string; asset_type: AssetType; category: string | null; stock_unit: string } | null;
};

export async function getExperienceAssets(experienceId: string): Promise<ExperienceAsset[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("experience_assets")
    .select(
      "id, experience_id, asset_id, quantity_needed, status, notes, assigned_at, assets(name, asset_type, category, stock_unit)"
    )
    .eq("experience_id", experienceId)
    .neq("status", "returned")
    .order("assigned_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as ExperienceAssetRow[];

  return rows.map((row) => ({
    id: row.id,
    experienceId: row.experience_id,
    assetId: row.asset_id,
    assetName: row.assets?.name ?? "Unknown asset",
    assetType: row.assets?.asset_type ?? "unique",
    category: row.assets?.category ?? null,
    stockUnit: row.assets?.stock_unit ?? null,
    quantityNeeded: row.quantity_needed,
    status: row.status,
    notes: row.notes,
    assignedAt: row.assigned_at,
  }));
}

export type AvailableAsset = Asset & {
  conflict: CurrentAssignment | null;
};

type ConflictRpcRow = {
  conflict_experience_id: string;
  conflict_experience_title: string;
  conflict_start_date: string;
  conflict_end_date: string;
};

/**
 * The catalog view used by the experience Assets tab's "Add Asset" search.
 * Note this takes `workspaceId` explicitly (every other list fetch in this
 * feature does too) rather than resolving it internally via
 * getSessionContext — data.ts stays session-agnostic, matching the rest of
 * the codebase's data-fetching layer.
 *
 * Conflict detection for unique assets goes through check_unique_asset_conflict
 * (one RPC call per unique asset) rather than replicating the overlap logic
 * here, per the sprint's "never replicate this logic in application code"
 * rule — this listing and the hard block in assignAsset share one source of
 * truth.
 */
export async function getAvailableAssets(
  workspaceId: string,
  experienceId: string,
  startDate: string,
  endDate: string
): Promise<AvailableAsset[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assets")
    .select(ASSET_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const assets = ((data ?? []) as AssetRow[]).map(toAsset);
  const uniqueAssets = assets.filter((asset) => asset.assetType === "unique");

  const conflictResults = await Promise.all(
    uniqueAssets.map((asset) =>
      supabase.rpc("check_unique_asset_conflict", {
        p_asset_id: asset.id,
        p_experience_id: experienceId,
        p_start_date: startDate,
        p_end_date: endDate,
      })
    )
  );

  const conflictByAssetId = new Map<string, CurrentAssignment>();
  uniqueAssets.forEach((asset, index) => {
    const result = conflictResults[index];
    const row = (result.data as ConflictRpcRow[] | null)?.[0];
    if (row) {
      conflictByAssetId.set(asset.id, {
        experienceId: row.conflict_experience_id,
        experienceTitle: row.conflict_experience_title,
        startDate: row.conflict_start_date,
        endDate: row.conflict_end_date,
      });
    }
  });

  return assets.map((asset) => ({
    ...asset,
    conflict: asset.assetType === "unique" ? (conflictByAssetId.get(asset.id) ?? null) : null,
  }));
}

export async function getLowStockAssets(workspaceId: string): Promise<Asset[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assets")
    .select(ASSET_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("asset_type", "consumable")
    .eq("is_active", true)
    .is("deleted_at", null)
    .not("reorder_threshold", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AssetRow[])
    .map(toAsset)
    .filter((asset) => asset.reorderThreshold !== null && asset.stockQuantity <= asset.reorderThreshold);
}

export type AssetConflict = {
  assetId: string;
  assetName: string;
  experienceAId: string;
  experienceATitle: string;
  experienceBId: string;
  experienceBTitle: string;
};

type ConflictScanRow = {
  id: string;
  name: string;
  experience_assets: {
    status: AssignmentStatus;
    experiences: LinkedExperience | null;
  }[];
};

/**
 * Safety-net scan for the dashboard's asset_conflict attention flag —
 * assignAsset's hard block should make this permanently empty, but this
 * exists in case a conflict is ever introduced outside the app (e.g. a
 * manual DB edit).
 */
export async function getAssetConflicts(workspaceId: string): Promise<AssetConflict[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assets")
    .select(
      "id, name, experience_assets(status, experiences(id, title, start_date, end_date, status, deleted_at))"
    )
    .eq("workspace_id", workspaceId)
    .eq("asset_type", "unique")
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as ConflictScanRow[];
  const conflicts: AssetConflict[] = [];

  for (const row of rows) {
    const active = row.experience_assets
      .filter(
        (ea) =>
          ea.status !== "returned" &&
          ea.experiences &&
          !ea.experiences.deleted_at &&
          ea.experiences.status !== "cancelled" &&
          ea.experiences.status !== "completed"
      )
      .map((ea) => ea.experiences as LinkedExperience);

    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        const overlaps = new Date(a.start_date) <= new Date(b.end_date) && new Date(b.start_date) <= new Date(a.end_date);

        if (overlaps) {
          conflicts.push({
            assetId: row.id,
            assetName: row.name,
            experienceAId: a.id,
            experienceATitle: a.title,
            experienceBId: b.id,
            experienceBTitle: b.title,
          });
        }
      }
    }
  }

  return conflicts;
}
