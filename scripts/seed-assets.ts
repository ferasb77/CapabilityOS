/**
 * Asset inventory demo seed for CapabilityOS.
 *
 * Run with: npx tsx scripts/seed-assets.ts
 *
 * Inserts HNI's demo asset catalog: 6 unique assets (games kits, camera,
 * projector, flipchart stand, tripod) and 8 consumable assets (name cards,
 * USB sticks, workbooks, sticky notes, marker sets, feedback forms,
 * lanyards, certificate folders).
 *
 * Safe to re-run: assets are looked up by (workspace_id, name) first and
 * skipped if they already exist.
 */

import path from "node:path";

import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.resolve(import.meta.dirname, "..", ".env"));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env. Aborting.");
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env. This script needs the service role key " +
      "to bypass RLS (find it in Supabase → Project Settings → API). Aborting."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type UniqueAssetSeed = {
  name: string;
  assetType: "unique";
  category: string;
};

type ConsumableAssetSeed = {
  name: string;
  assetType: "consumable";
  category: string;
  stockQuantity: number;
  stockUnit: string;
  reorderThreshold: number;
  reorderQuantity: number;
};

type AssetSeed = UniqueAssetSeed | ConsumableAssetSeed;

const ASSETS: AssetSeed[] = [
  { name: "Leadership Games Kit A", assetType: "unique", category: "games" },
  { name: "Leadership Games Kit B", assetType: "unique", category: "games" },
  { name: "Professional Camera Kit", assetType: "unique", category: "equipment" },
  { name: "Portable Projector — Epson", assetType: "unique", category: "equipment" },
  { name: "Flipchart Stand Set", assetType: "unique", category: "equipment" },
  { name: "Video Recording Tripod", assetType: "unique", category: "equipment" },
  {
    name: "Name Cards / Tent Cards",
    assetType: "consumable",
    category: "stationery",
    stockQuantity: 500,
    stockUnit: "cards",
    reorderThreshold: 100,
    reorderQuantity: 500,
  },
  {
    name: "USB Sticks 8GB",
    assetType: "consumable",
    category: "equipment",
    stockQuantity: 200,
    stockUnit: "sticks",
    reorderThreshold: 50,
    reorderQuantity: 200,
  },
  {
    name: "Printed Workbooks",
    assetType: "consumable",
    category: "materials",
    stockQuantity: 150,
    stockUnit: "copies",
    reorderThreshold: 30,
    reorderQuantity: 100,
  },
  {
    name: "Sticky Notes Pack",
    assetType: "consumable",
    category: "stationery",
    stockQuantity: 80,
    stockUnit: "packs",
    reorderThreshold: 20,
    reorderQuantity: 50,
  },
  {
    name: "Marker Sets",
    assetType: "consumable",
    category: "stationery",
    stockQuantity: 40,
    stockUnit: "sets",
    reorderThreshold: 10,
    reorderQuantity: 20,
  },
  {
    name: "Feedback Forms",
    assetType: "consumable",
    category: "materials",
    stockQuantity: 300,
    stockUnit: "forms",
    reorderThreshold: 50,
    reorderQuantity: 200,
  },
  {
    name: "Lanyards",
    assetType: "consumable",
    category: "stationery",
    stockQuantity: 250,
    stockUnit: "pieces",
    reorderThreshold: 50,
    reorderQuantity: 200,
  },
  {
    name: "Certificate Folders",
    assetType: "consumable",
    category: "materials",
    stockQuantity: 100,
    stockUnit: "folders",
    reorderThreshold: 25,
    reorderQuantity: 100,
  },
];

/**
 * This app is single-tenant so far, so the first workspace row is the only
 * sensible choice — same reasoning as scripts/seed-clients-engagements.ts.
 */
async function resolveWorkspaceId(): Promise<string> {
  const { data, error } = await supabase.from("workspaces").select("id").limit(1).maybeSingle();

  if (error) {
    throw new Error(`Failed to read workspaces: ${error.message}`);
  }

  if (!data) {
    throw new Error("No workspace found — run migration 0001 (or its seed) before this script.");
  }

  return data.id;
}

async function main() {
  console.log("CapabilityOS asset inventory seed");
  console.log("==================================\n");

  const workspaceId = await resolveWorkspaceId();

  const { data: existingRows, error: existingError } = await supabase
    .from("assets")
    .select("name")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  if (existingError) {
    console.error(`Failed to check existing assets: ${existingError.message}`);
    process.exit(1);
  }

  const existingNames = new Set((existingRows ?? []).map((row) => row.name));

  let insertedCount = 0;

  for (const asset of ASSETS) {
    if (existingNames.has(asset.name)) {
      console.log(`  - ${asset.name} already exists, skipping`);
      continue;
    }

    const { error } = await supabase.from("assets").insert({
      workspace_id: workspaceId,
      name: asset.name,
      asset_type: asset.assetType,
      category: asset.category,
      stock_quantity: asset.assetType === "consumable" ? asset.stockQuantity : 0,
      stock_unit: asset.assetType === "consumable" ? asset.stockUnit : "units",
      reorder_threshold: asset.assetType === "consumable" ? asset.reorderThreshold : null,
      reorder_quantity: asset.assetType === "consumable" ? asset.reorderQuantity : null,
      is_active: true,
    });

    if (error) {
      console.error(`Failed to insert asset "${asset.name}": ${error.message}`);
      process.exit(1);
    }

    insertedCount += 1;
    console.log(`  + ${asset.name} (${asset.assetType})`);
  }

  console.log("\nDone.");
  console.log("Summary");
  console.log("-------");
  console.log(`Assets inserted: ${insertedCount} (of ${ASSETS.length} planned)`);
}

main().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
