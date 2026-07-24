"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Material } from "@/features/materials/data";

import { deleteMaterial, releaseMaterial, reorderMaterials } from "../actions";
import { AudienceBadge, AvailabilityBadge, FacilitatorOnlyBadge, UploadedByBadge } from "./material-badges";
import { MaterialFormSheet } from "./material-form-sheet";
import { MaterialTypeIcon } from "./material-type-icon";

function MaterialRow({
  material,
  index,
  section,
  experienceSlug,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onEdit,
  onDelete,
}: {
  material: Material;
  index: number;
  section: "participant" | "facilitator";
  experienceSlug: string;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isReleasing, startReleaseTransition] = useTransition();
  const router = useRouter();

  function handleRelease() {
    startReleaseTransition(async () => {
      await releaseMaterial(material.id, material.experienceId, experienceSlug);
      router.refresh();
    });
  }

  return (
    <li
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(index);
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-night/40 p-3 transition-colors",
        isDragging ? "opacity-40" : "opacity-100",
        isDragOver ? "border-gold/60" : "border-border-subtle"
      )}
    >
      <span className="mt-1 cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden>
        <GripVertical className="size-4" />
      </span>

      <MaterialTypeIcon material={material} className="mt-0.5 size-4 shrink-0 text-gold" />

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium text-ivory">{material.title}</p>
        {material.description && <p className="text-xs text-muted-foreground">{material.description}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <AudienceBadge audience={material.audience} />
          <AvailabilityBadge material={material} />
          {section === "facilitator" && material.audience === "facilitator" && <FacilitatorOnlyBadge />}
          <UploadedByBadge material={material} />
        </div>
        {material.availableFrom === "manual" && (
          <div className="flex items-center gap-2 pt-1">
            <Switch
              checked={material.isReleased}
              disabled={material.isReleased || isReleasing}
              onCheckedChange={handleRelease}
            />
            <span className="text-xs text-muted-foreground">
              {material.isReleased ? "Released" : "Release to participants"}
            </span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit material">
          <Pencil className="size-4" />
        </Button>
        {confirmingDelete ? (
          <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
            Confirm?
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirmingDelete(true)}
            onBlur={() => setConfirmingDelete(false)}
            aria-label="Delete material"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        )}
      </div>
    </li>
  );
}

type Props = {
  title: string;
  description: string;
  addLabel: string;
  section: "participant" | "facilitator";
  experienceId: string;
  experienceSlug: string;
  workspaceId: string;
  materials: Material[];
};

export function MaterialListEditor({
  title,
  description,
  addLabel,
  section,
  experienceId,
  experienceSlug,
  workspaceId,
  materials,
}: Props) {
  const router = useRouter();
  const [localMaterials, setLocalMaterials] = useState(materials);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | undefined>(undefined);
  const [sheetInstance, setSheetInstance] = useState(0);

  function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...localMaterials];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    setLocalMaterials(reordered);
    setDragIndex(null);
    setDragOverIndex(null);

    reorderMaterials(
      experienceSlug,
      reordered.map((material) => material.id)
    ).then(() => router.refresh());
  }

  async function handleDelete(materialId: string) {
    setLocalMaterials((prev) => prev.filter((material) => material.id !== materialId));
    await deleteMaterial(materialId, experienceSlug);
    router.refresh();
  }

  function openAddSheet() {
    setEditingMaterial(undefined);
    setSheetInstance((n) => n + 1);
    setSheetOpen(true);
  }

  function openEditSheet(material: Material) {
    setEditingMaterial(material);
    setSheetInstance((n) => n + 1);
    setSheetOpen(true);
  }

  return (
    <Card className="bg-surface-elevated">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button type="button" onClick={openAddSheet}>
          <Plus className="size-4" />
          {addLabel}
        </Button>
      </CardHeader>
      <CardContent>
        {localMaterials.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing shared yet.</p>
        ) : (
          <ul className="space-y-2">
            {localMaterials.map((material, index) => (
              <MaterialRow
                key={material.id}
                material={material}
                index={index}
                section={section}
                experienceSlug={experienceSlug}
                isDragging={dragIndex === index}
                isDragOver={dragOverIndex === index}
                onDragStart={setDragIndex}
                onDragOver={setDragOverIndex}
                onDrop={handleDrop}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onEdit={() => openEditSheet(material)}
                onDelete={() => handleDelete(material.id)}
              />
            ))}
          </ul>
        )}
      </CardContent>

      <MaterialFormSheet
        key={sheetInstance}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        experienceId={experienceId}
        experienceSlug={experienceSlug}
        workspaceId={workspaceId}
        material={editingMaterial}
        defaultAudience={section === "facilitator" ? "facilitator" : "participant"}
      />
    </Card>
  );
}
