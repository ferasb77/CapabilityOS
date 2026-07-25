"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AssetWithStatus } from "@/features/assets/data";

import { AssetFormSheet } from "./asset-form-sheet";
import { ConsumableAssetsTable } from "./consumable-assets-table";
import { StockAdjustmentSheet } from "./stock-adjustment-sheet";
import { UniqueAssetsTable } from "./unique-assets-table";

const TABS = [
  { key: "unique", label: "Unique Assets" },
  { key: "consumable", label: "Consumable Assets" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className="bg-surface-elevated">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-2xl font-bold", accent ? "text-amber-500" : "text-ivory")}>{value}</p>
      </CardContent>
    </Card>
  );
}

type Props = {
  assets: AssetWithStatus[];
};

export function AssetInventory({ assets }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("unique");
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetWithStatus | undefined>(undefined);
  const [formSheetInstance, setFormSheetInstance] = useState(0);
  const [stockSheetOpen, setStockSheetOpen] = useState(false);
  const [adjustingAsset, setAdjustingAsset] = useState<AssetWithStatus | null>(null);

  const uniqueAssets = useMemo(() => assets.filter((asset) => asset.assetType === "unique"), [assets]);
  const consumableAssets = useMemo(() => assets.filter((asset) => asset.assetType === "consumable"), [assets]);

  const stats = useMemo(() => {
    const assignedUnique = uniqueAssets.filter((asset) => asset.currentAssignment !== null).length;
    const lowStockCount = consumableAssets.filter(
      (asset) => asset.reorderThreshold !== null && asset.stockQuantity <= asset.reorderThreshold
    ).length;
    const totalCategories = new Set(assets.map((asset) => asset.category).filter((c): c is string => Boolean(c))).size;

    return {
      totalUnique: uniqueAssets.length,
      assignedUnique,
      lowStockCount,
      totalCategories,
    };
  }, [assets, uniqueAssets, consumableAssets]);

  function openAddSheet() {
    setEditingAsset(undefined);
    setFormSheetInstance((n) => n + 1);
    setFormSheetOpen(true);
  }

  function openEditSheet(asset: AssetWithStatus) {
    setEditingAsset(asset);
    setFormSheetInstance((n) => n + 1);
    setFormSheetOpen(true);
  }

  function openStockSheet(asset: AssetWithStatus) {
    setAdjustingAsset(asset);
    setStockSheetOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Asset Inventory</h1>
          <p className="mt-2 text-muted-foreground">Physical assets available to assign to experiences.</p>
        </div>
        <Button size="lg" onClick={openAddSheet}>
          <Plus className="size-4" />
          Add Asset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Unique Assets" value={stats.totalUnique} />
        <StatCard label="Currently Assigned" value={stats.assignedUnique} />
        <StatCard label="Below Reorder Threshold" value={stats.lowStockCount} accent={stats.lowStockCount > 0} />
        <StatCard label="Asset Categories" value={stats.totalCategories} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border-subtle">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                isActive ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-ivory"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "unique" ? (
        <UniqueAssetsTable assets={uniqueAssets} onEdit={openEditSheet} />
      ) : (
        <ConsumableAssetsTable assets={consumableAssets} onEdit={openEditSheet} onAdjustStock={openStockSheet} />
      )}

      <AssetFormSheet key={formSheetInstance} open={formSheetOpen} onOpenChange={setFormSheetOpen} asset={editingAsset} />
      <StockAdjustmentSheet open={stockSheetOpen} onOpenChange={setStockSheetOpen} asset={adjustingAsset} />
    </div>
  );
}
