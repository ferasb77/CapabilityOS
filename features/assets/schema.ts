import { z } from "zod";

export const ASSET_TYPES = ["unique", "consumable"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  unique: "Unique",
  consumable: "Consumable",
};

export const ASSIGNMENT_STATUSES = ["requested", "confirmed", "delivered", "returned"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  delivered: "Delivered",
  returned: "Returned",
};

export const STOCK_ADJUSTMENT_REASONS = ["received", "damaged", "lost", "correction"] as const;
export type StockAdjustmentReason = (typeof STOCK_ADJUSTMENT_REASONS)[number];

export const STOCK_ADJUSTMENT_REASON_LABELS: Record<StockAdjustmentReason, string> = {
  received: "Received new stock",
  damaged: "Damaged",
  lost: "Lost",
  correction: "Correction",
};

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const assetFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    category: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    assetType: z.enum(ASSET_TYPES),
    description: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    isActive: z.boolean().default(true),
    // Unique-only
    serialNumber: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    location: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    // Consumable-only
    stockQuantity: z.coerce.number().int().min(0).optional(),
    stockUnit: z.preprocess(emptyToUndefined, z.string().trim().optional()),
    reorderThreshold: z.coerce.number().int().min(0).optional(),
    reorderQuantity: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.assetType === "consumable" && (data.stockQuantity === undefined || Number.isNaN(data.stockQuantity))) {
      ctx.addIssue({ code: "custom", path: ["stockQuantity"], message: "Stock quantity is required" });
    }
  });

export type AssetFormValues = z.infer<typeof assetFormSchema>;

export const stockAdjustmentSchema = z.object({
  quantityChange: z.coerce.number().int().refine((value) => value !== 0, "Enter a non-zero quantity"),
  reason: z.enum(STOCK_ADJUSTMENT_REASONS),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type StockAdjustmentValues = z.infer<typeof stockAdjustmentSchema>;

export const assignAssetSchema = z.object({
  assetId: z.string().uuid(),
  quantityNeeded: z.coerce.number().int().min(1).default(1),
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type AssignAssetValues = z.infer<typeof assignAssetSchema>;
