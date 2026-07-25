"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/infrastructure/supabase/server";
import { getSessionContext } from "@/infrastructure/session/session-context";

import { assetFormSchema, assignAssetSchema, stockAdjustmentSchema } from "./schema";

const ASSETS_PATH = "/dashboard/assets";

function experiencePath(experienceSlug: string) {
  return `/dashboard/experiences/${experienceSlug}`;
}

// ---------------------------------------------------------------------------
// Asset catalog CRUD
// ---------------------------------------------------------------------------

type AssetFormInput = {
  name: FormDataEntryValue | null;
  category: FormDataEntryValue | null;
  assetType: FormDataEntryValue | null;
  description: FormDataEntryValue | null;
  notes: FormDataEntryValue | null;
  isActive: FormDataEntryValue | null;
  serialNumber: FormDataEntryValue | null;
  location: FormDataEntryValue | null;
  stockQuantity: FormDataEntryValue | null;
  stockUnit: FormDataEntryValue | null;
  reorderThreshold: FormDataEntryValue | null;
  reorderQuantity: FormDataEntryValue | null;
};

function readAssetForm(formData: FormData): AssetFormInput {
  return {
    name: formData.get("name"),
    category: formData.get("category"),
    assetType: formData.get("assetType"),
    description: formData.get("description"),
    notes: formData.get("notes"),
    isActive: formData.get("isActive"),
    serialNumber: formData.get("serialNumber"),
    location: formData.get("location"),
    stockQuantity: formData.get("stockQuantity"),
    stockUnit: formData.get("stockUnit"),
    reorderThreshold: formData.get("reorderThreshold"),
    reorderQuantity: formData.get("reorderQuantity"),
  };
}

export type SaveAssetResult = { success: true; assetId: string } | { success: false; error: string };

export async function createAsset(formData: FormData): Promise<SaveAssetResult> {
  const raw = readAssetForm(formData);
  const parsed = assetFormSchema.safeParse({ ...raw, isActive: raw.isActive === "on" || raw.isActive === "true" });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the fields." };
  }

  const data = parsed.data;
  const session = await getSessionContext();
  const supabase = await createClient();

  const { data: inserted, error } = await supabase
    .from("assets")
    .insert({
      workspace_id: session.workspaceId,
      name: data.name,
      description: data.description ?? null,
      asset_type: data.assetType,
      category: data.category ?? null,
      serial_number: data.assetType === "unique" ? (data.serialNumber ?? null) : null,
      location: data.assetType === "unique" ? (data.location ?? null) : null,
      stock_quantity: data.assetType === "consumable" ? (data.stockQuantity ?? 0) : 0,
      stock_unit: data.assetType === "consumable" ? (data.stockUnit ?? "units") : "units",
      reorder_threshold: data.assetType === "consumable" ? (data.reorderThreshold ?? null) : null,
      reorder_quantity: data.assetType === "consumable" ? (data.reorderQuantity ?? null) : null,
      is_active: data.isActive,
      notes: data.notes ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, error: error?.message ?? "Unable to add asset." };
  }

  revalidatePath(ASSETS_PATH);

  return { success: true, assetId: inserted.id };
}

export async function updateAsset(assetId: string, formData: FormData): Promise<SaveAssetResult> {
  const raw = readAssetForm(formData);
  const parsed = assetFormSchema.safeParse({ ...raw, isActive: raw.isActive === "on" || raw.isActive === "true" });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the fields." };
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("assets")
    .update({
      name: data.name,
      description: data.description ?? null,
      asset_type: data.assetType,
      category: data.category ?? null,
      serial_number: data.assetType === "unique" ? (data.serialNumber ?? null) : null,
      location: data.assetType === "unique" ? (data.location ?? null) : null,
      stock_quantity: data.assetType === "consumable" ? (data.stockQuantity ?? 0) : 0,
      stock_unit: data.assetType === "consumable" ? (data.stockUnit ?? "units") : "units",
      reorder_threshold: data.assetType === "consumable" ? (data.reorderThreshold ?? null) : null,
      reorder_quantity: data.assetType === "consumable" ? (data.reorderQuantity ?? null) : null,
      is_active: data.isActive,
      notes: data.notes ?? null,
    })
    .eq("id", assetId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(ASSETS_PATH);

  return { success: true, assetId };
}

export type DeleteAssetResult = { success: true } | { success: false; error: string };

export async function deleteAsset(assetId: string): Promise<DeleteAssetResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assetId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(ASSETS_PATH);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Assignment — hard-blocked conflict check for unique assets, explicit
// (not trigger-driven) stock deduction for consumables.
// ---------------------------------------------------------------------------

export type AssignAssetResult = { success: true } | { success: false; error: string };

type ConflictRpcRow = {
  conflict_experience_id: string;
  conflict_experience_title: string;
  conflict_start_date: string;
  conflict_end_date: string;
};

export async function assignAsset(
  experienceId: string,
  experienceSlug: string,
  workspaceId: string,
  formData: FormData
): Promise<AssignAssetResult> {
  const parsed = assignAssetSchema.safeParse({
    assetId: formData.get("assetId"),
    quantityNeeded: formData.get("quantityNeeded") || undefined,
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the fields." };
  }

  const { assetId, quantityNeeded, notes } = parsed.data;
  const session = await getSessionContext();
  const supabase = await createClient();

  const [{ data: experience, error: experienceError }, { data: asset, error: assetError }] = await Promise.all([
    supabase.from("experiences").select("id, title, start_date, end_date").eq("id", experienceId).maybeSingle(),
    supabase.from("assets").select("id, asset_type, stock_quantity").eq("id", assetId).maybeSingle(),
  ]);

  if (experienceError) {
    return { success: false, error: experienceError.message };
  }
  if (!experience) {
    return { success: false, error: "Experience not found." };
  }
  if (assetError) {
    return { success: false, error: assetError.message };
  }
  if (!asset) {
    return { success: false, error: "Asset not found." };
  }

  if (asset.asset_type === "unique") {
    const { data: conflicts, error: conflictError } = await supabase.rpc("check_unique_asset_conflict", {
      p_asset_id: assetId,
      p_experience_id: experienceId,
      p_start_date: experience.start_date,
      p_end_date: experience.end_date,
    });

    if (conflictError) {
      return { success: false, error: conflictError.message };
    }

    const conflict = (conflicts as ConflictRpcRow[] | null)?.[0];
    if (conflict) {
      const start = new Date(conflict.conflict_start_date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const end = new Date(conflict.conflict_end_date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      return {
        success: false,
        error: `This asset is already assigned to ${conflict.conflict_experience_title} from ${start} to ${end}. Choose a different asset or resolve the conflict first.`,
      };
    }
  } else {
    if (quantityNeeded > asset.stock_quantity) {
      return { success: false, error: `Only ${asset.stock_quantity} in stock — cannot assign ${quantityNeeded}.` };
    }
  }

  const { error: insertError } = await supabase.from("experience_assets").insert({
    experience_id: experienceId,
    asset_id: assetId,
    workspace_id: workspaceId,
    quantity_needed: asset.asset_type === "consumable" ? quantityNeeded : 1,
    quantity_deducted: asset.asset_type === "consumable" ? quantityNeeded : 0,
    status: "confirmed",
    notes: notes ?? null,
    assigned_by: session.userId,
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  if (asset.asset_type === "consumable") {
    const { error: stockError } = await supabase
      .from("assets")
      .update({ stock_quantity: asset.stock_quantity - quantityNeeded })
      .eq("id", assetId);

    if (stockError) {
      return { success: false, error: stockError.message };
    }
  }

  revalidatePath(experiencePath(experienceSlug));
  revalidatePath(ASSETS_PATH);

  return { success: true };
}

export type RemoveAssignmentResult = { success: true } | { success: false; error: string };

/**
 * Marks the assignment 'returned' rather than deleting the row — the given
 * schema has no deleted_at on experience_assets and no 'cancelled' status,
 * and check_unique_asset_conflict already excludes status = 'returned' from
 * conflict checks, so it's the schema's own built-in "no longer active"
 * signal. Consumable stock is always restored — no exceptions, per the
 * sprint's architecture rules.
 */
export async function removeAssetAssignment(assignmentId: string, experienceSlug: string): Promise<RemoveAssignmentResult> {
  const supabase = await createClient();

  const { data: assignment, error: fetchError } = await supabase
    .from("experience_assets")
    .select("id, asset_id, quantity_needed, assets(asset_type, stock_quantity)")
    .eq("id", assignmentId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }
  if (!assignment) {
    return { success: false, error: "Assignment not found." };
  }

  const asset = assignment.assets as unknown as { asset_type: string; stock_quantity: number } | null;

  const { error: updateError } = await supabase
    .from("experience_assets")
    .update({ status: "returned", returned_at: new Date().toISOString() })
    .eq("id", assignmentId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  if (asset?.asset_type === "consumable") {
    const { error: stockError } = await supabase
      .from("assets")
      .update({ stock_quantity: asset.stock_quantity + assignment.quantity_needed })
      .eq("id", assignment.asset_id);

    if (stockError) {
      return { success: false, error: stockError.message };
    }
  }

  revalidatePath(experiencePath(experienceSlug));
  revalidatePath(ASSETS_PATH);

  return { success: true };
}

export type UpdateAssignmentStatusResult = { success: true } | { success: false; error: string };

export async function updateAssignmentStatus(
  assignmentId: string,
  status: "requested" | "confirmed" | "delivered",
  experienceSlug: string
): Promise<UpdateAssignmentStatusResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("experience_assets").update({ status }).eq("id", assignmentId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(experiencePath(experienceSlug));

  return { success: true };
}

// ---------------------------------------------------------------------------
// Stock adjustment — logged to asset_stock_adjustments, applied to
// assets.stock_quantity in the same action (no trigger), matching how
// assignAsset/removeAssetAssignment already handle deduction explicitly.
// ---------------------------------------------------------------------------

export type AdjustStockResult = { success: true } | { success: false; error: string };

export async function adjustStock(assetId: string, formData: FormData): Promise<AdjustStockResult> {
  const parsed = stockAdjustmentSchema.safeParse({
    quantityChange: formData.get("quantityChange"),
    reason: formData.get("reason"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Please check the fields." };
  }

  const { quantityChange, reason, notes } = parsed.data;
  const session = await getSessionContext();
  const supabase = await createClient();

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, workspace_id, stock_quantity")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError) {
    return { success: false, error: assetError.message };
  }
  if (!asset) {
    return { success: false, error: "Asset not found." };
  }

  const nextQuantity = asset.stock_quantity + quantityChange;
  if (nextQuantity < 0) {
    return { success: false, error: `This adjustment would take stock below zero (currently ${asset.stock_quantity}).` };
  }

  const { error: updateError } = await supabase.from("assets").update({ stock_quantity: nextQuantity }).eq("id", assetId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  const { error: logError } = await supabase.from("asset_stock_adjustments").insert({
    asset_id: assetId,
    workspace_id: asset.workspace_id,
    quantity_change: quantityChange,
    reason,
    notes: notes ?? null,
    adjusted_by: session.userId,
  });

  if (logError) {
    return { success: false, error: logError.message };
  }

  revalidatePath(ASSETS_PATH);

  return { success: true };
}
