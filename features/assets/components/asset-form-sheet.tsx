"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Asset } from "@/features/assets/data";
import type { AssetType } from "@/features/assets/schema";

import { createAsset, updateAsset } from "../actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: Asset;
};

export function AssetFormSheet({ open, onOpenChange, asset }: Props) {
  const router = useRouter();
  const isEditMode = Boolean(asset);

  const [name, setName] = useState(asset?.name ?? "");
  const [category, setCategory] = useState(asset?.category ?? "");
  const [assetType, setAssetType] = useState<AssetType>(asset?.assetType ?? "unique");
  const [serialNumber, setSerialNumber] = useState(asset?.serialNumber ?? "");
  const [location, setLocation] = useState(asset?.location ?? "");
  const [stockQuantity, setStockQuantity] = useState(String(asset?.stockQuantity ?? 0));
  const [stockUnit, setStockUnit] = useState(asset?.stockUnit ?? "units");
  const [reorderThreshold, setReorderThreshold] = useState(
    asset?.reorderThreshold !== null && asset?.reorderThreshold !== undefined ? String(asset.reorderThreshold) : ""
  );
  const [reorderQuantity, setReorderQuantity] = useState(
    asset?.reorderQuantity !== null && asset?.reorderQuantity !== undefined ? String(asset.reorderQuantity) : ""
  );
  const [description, setDescription] = useState(asset?.description ?? "");
  const [notes, setNotes] = useState(asset?.notes ?? "");
  const [isActive, setIsActive] = useState(asset?.isActive ?? true);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setError(null);
    setIsSaving(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("category", category);
    formData.set("assetType", assetType);
    formData.set("description", description);
    formData.set("notes", notes);
    if (isActive) formData.set("isActive", "on");
    formData.set("serialNumber", serialNumber);
    formData.set("location", location);
    formData.set("stockQuantity", stockQuantity);
    formData.set("stockUnit", stockUnit);
    formData.set("reorderThreshold", reorderThreshold);
    formData.set("reorderQuantity", reorderQuantity);

    const result = isEditMode && asset ? await updateAsset(asset.id, formData) : await createAsset(formData);

    setIsSaving(false);

    if (result.success) {
      onOpenChange(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditMode ? "Edit Asset" : "Add Asset"}</SheetTitle>
          <SheetDescription>Track a physical asset in the inventory catalog.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label htmlFor="asset-name">
              Name <span className="text-gold">*</span>
            </Label>
            <Input id="asset-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-category">Category</Label>
            <Input
              id="asset-category"
              placeholder="e.g. games, equipment"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={assetType === "unique" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setAssetType("unique")}
              >
                Unique
              </Button>
              <Button
                type="button"
                variant={assetType === "consumable" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setAssetType("consumable")}
              >
                Consumable
              </Button>
            </div>
          </div>

          {assetType === "unique" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="asset-serial">Serial Number (optional)</Label>
                <Input id="asset-serial" value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-location">Location (optional)</Label>
                <Input id="asset-location" value={location} onChange={(event) => setLocation(event.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="asset-stock">
                    Current Stock <span className="text-gold">*</span>
                  </Label>
                  <Input
                    id="asset-stock"
                    type="number"
                    min={0}
                    value={stockQuantity}
                    onChange={(event) => setStockQuantity(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-unit">Unit</Label>
                  <Input
                    id="asset-unit"
                    placeholder="e.g. cards, sticks"
                    value={stockUnit}
                    onChange={(event) => setStockUnit(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="asset-reorder-threshold">Reorder Threshold</Label>
                  <Input
                    id="asset-reorder-threshold"
                    type="number"
                    min={0}
                    value={reorderThreshold}
                    onChange={(event) => setReorderThreshold(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-reorder-quantity">Reorder Quantity</Label>
                  <Input
                    id="asset-reorder-quantity"
                    type="number"
                    min={0}
                    value={reorderQuantity}
                    onChange={(event) => setReorderQuantity(event.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="asset-description">Description (optional)</Label>
            <Textarea
              id="asset-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="asset-notes">Notes (optional)</Label>
            <Textarea id="asset-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-night/40 px-3 py-2.5">
            <Label htmlFor="asset-active" className="cursor-pointer">
              Active
            </Label>
            <Switch id="asset-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter>
          <Button type="button" disabled={isSaving || name.trim().length === 0} onClick={handleSave}>
            {isSaving ? "Saving..." : "Save Asset"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
