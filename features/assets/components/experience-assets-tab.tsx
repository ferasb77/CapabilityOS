"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AvailableAsset, ExperienceAsset } from "@/features/assets/data";
import { ASSIGNMENT_STATUS_LABELS } from "@/features/assets/schema";

import { assignAsset, removeAssetAssignment } from "../actions";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function AssignedAssetRow({ assignment, experienceSlug }: { assignment: ExperienceAsset; experienceSlug: string }) {
  const router = useRouter();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [isRemoving, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      await removeAssetAssignment(assignment.id, experienceSlug);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border-subtle bg-night/40 p-3">
      <div className="min-w-0 space-y-1.5">
        <p className="text-sm font-medium text-ivory">{assignment.assetName}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{assignment.assetType === "unique" ? "Unique" : "Consumable"}</Badge>
          <Badge className="bg-gold/15 text-gold">{ASSIGNMENT_STATUS_LABELS[assignment.status]}</Badge>
          {assignment.assetType === "consumable" && (
            <span className="text-xs text-muted-foreground">
              {assignment.quantityNeeded} {assignment.stockUnit ?? "units"}
            </span>
          )}
        </div>
        {assignment.notes && <p className="text-xs text-muted-foreground">{assignment.notes}</p>}
      </div>

      {confirmingRemove ? (
        <Button type="button" variant="destructive" size="sm" disabled={isRemoving} onClick={handleRemove}>
          Confirm?
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setConfirmingRemove(true)}
          onBlur={() => setConfirmingRemove(false)}
          aria-label={`Remove ${assignment.assetName}`}
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      )}
    </li>
  );
}

function AvailableAssetRow({
  asset,
  experienceId,
  experienceSlug,
  workspaceId,
}: {
  asset: AvailableAsset;
  experienceId: string;
  experienceSlug: string;
  workspaceId: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAssigning, startTransition] = useTransition();

  const isBlocked = asset.assetType === "unique" && asset.conflict !== null;
  const isOutOfStock = asset.assetType === "consumable" && asset.stockQuantity <= 0;

  function handleAssign() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("assetId", asset.id);
      formData.set("quantityNeeded", asset.assetType === "consumable" ? quantity : "1");
      formData.set("notes", notes);

      const result = await assignAsset(experienceId, experienceSlug, workspaceId, formData);
      if (result.success) {
        setExpanded(false);
        setQuantity("1");
        setNotes("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <li className="rounded-lg border border-border-subtle bg-night/40 p-3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-ivory">{asset.name}</p>
          {asset.category && <p className="text-xs text-muted-foreground">{asset.category}</p>}
        </div>

        {asset.assetType === "unique" ? (
          isBlocked ? (
            <Badge variant="destructive">
              Conflict — {asset.conflict!.experienceTitle} {formatDate(asset.conflict!.startDate)}–
              {formatDate(asset.conflict!.endDate)}
            </Badge>
          ) : (
            <Badge className="bg-gold/15 text-gold">Available</Badge>
          )
        ) : (
          <Badge className={cn(isOutOfStock ? "bg-destructive/15 text-destructive" : "bg-gold/15 text-gold")}>
            {asset.stockQuantity} {asset.stockUnit} available
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border-subtle pt-3">
          {asset.assetType === "consumable" && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Quantity needed</label>
              <Input
                type="number"
                min={1}
                max={asset.stockQuantity}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Notes (optional)</label>
            <Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" size="sm" disabled={isAssigning || isBlocked || isOutOfStock} onClick={handleAssign}>
            {isAssigning ? "Assigning..." : "Assign"}
          </Button>
        </div>
      )}
    </li>
  );
}

type Props = {
  experienceId: string;
  experienceSlug: string;
  workspaceId: string;
  assignedAssets: ExperienceAsset[];
  availableAssets: AvailableAsset[];
};

export function ExperienceAssetsTab({
  experienceId,
  experienceSlug,
  workspaceId,
  assignedAssets,
  availableAssets,
}: Props) {
  const [search, setSearch] = useState("");

  const assignedAssetIds = useMemo(() => new Set(assignedAssets.map((assignment) => assignment.assetId)), [assignedAssets]);

  const catalog = useMemo(() => {
    const query = search.trim().toLowerCase();

    return availableAssets
      .filter((asset) => !assignedAssetIds.has(asset.id))
      .filter(
        (asset) =>
          !query || asset.name.toLowerCase().includes(query) || (asset.category ?? "").toLowerCase().includes(query)
      );
  }, [availableAssets, assignedAssetIds, search]);

  return (
    <div className="space-y-6">
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Assigned Assets</CardTitle>
          <CardDescription>Assets currently allocated to this experience.</CardDescription>
        </CardHeader>
        <CardContent>
          {assignedAssets.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No assets assigned yet.</p>
          ) : (
            <ul className="space-y-2">
              {assignedAssets.map((assignment) => (
                <AssignedAssetRow key={assignment.id} assignment={assignment} experienceSlug={experienceSlug} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Add Asset</CardTitle>
          <CardDescription>Search the catalog and assign an asset to this experience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assets by name or category..."
              className="h-11 pl-9 md:h-9"
            />
          </div>

          {catalog.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No matching assets in the catalog.</p>
          ) : (
            <ul className="space-y-2">
              {catalog.map((asset) => (
                <AvailableAssetRow
                  key={asset.id}
                  asset={asset}
                  experienceId={experienceId}
                  experienceSlug={experienceSlug}
                  workspaceId={workspaceId}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
