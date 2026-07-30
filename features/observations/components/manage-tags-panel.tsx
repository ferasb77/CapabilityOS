"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ObservationTag } from "../data";

import { saveObservationTags } from "../actions";

type LocalTag = { label: string; color: string };

function toLocal(tags: ObservationTag[]): LocalTag[] {
  return tags.map((tag) => ({ label: tag.label, color: tag.color }));
}

type TagRowProps = {
  tag: LocalTag;
  index: number;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
  onRemove: () => void;
};

function TagRow({ tag, index, isDragging, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd, onRemove }: TagRowProps) {
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
        "flex items-center gap-2 rounded-lg border bg-night/40 px-3 py-2 transition-colors",
        isDragging ? "opacity-40" : "opacity-100",
        isDragOver ? "border-gold/60" : "border-border-subtle"
      )}
    >
      <span className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-hidden>
        <GripVertical className="size-4" />
      </span>
      <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} aria-hidden />
      <span className="flex-1 text-sm text-ivory">{tag.label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${tag.label}`}
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="size-4" />
      </button>
    </li>
  );
}

type Props = {
  experienceId: string;
  initialTags: ObservationTag[];
};

export function ManageTagsPanel({ experienceId, initialTags }: Props) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<LocalTag[]>(toLocal(initialTags));
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#C9A96E");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function persist(next: LocalTag[]) {
    setTags(next);
    setError(null);
    startTransition(async () => {
      const result = await saveObservationTags(experienceId, next);
      if (!result.success) {
        setError(result.error);
      }
    });
  }

  function handleAdd() {
    const label = newLabel.trim();
    if (!label) {
      return;
    }
    persist([...tags, { label, color: newColor }]);
    setNewLabel("");
  }

  function handleRemove(index: number) {
    persist(tags.filter((_, i) => i !== index));
  }

  function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...tags];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    setDragIndex(null);
    setDragOverIndex(null);
    persist(reordered);
  }

  return (
    <Card className="bg-surface-elevated">
      <CardHeader
        className="flex cursor-pointer flex-row items-center justify-between"
        onClick={() => setOpen((value) => !value)}
      >
        <CardTitle>Manage Tags</CardTitle>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={open ? "Collapse" : "Expand"}>
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </CardHeader>

      {open && (
        <CardContent className="space-y-4">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags yet. Add one below.</p>
          ) : (
            <ul className="space-y-1.5">
              {tags.map((tag, index) => (
                <TagRow
                  key={`${tag.label}-${index}`}
                  tag={tag}
                  index={index}
                  isDragging={dragIndex === index}
                  isDragOver={dragOverIndex === index}
                  onDragStart={setDragIndex}
                  onDragOver={setDragOverIndex}
                  onDrop={handleDrop}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onRemove={() => handleRemove(index)}
                />
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
            <input
              type="color"
              value={newColor}
              onChange={(event) => setNewColor(event.target.value)}
              className="h-9 w-10 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
              aria-label="Tag color"
            />
            <Input
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="New tag label"
              className="min-w-40 flex-1"
            />
            <Button type="button" variant="outline" onClick={handleAdd} disabled={!newLabel.trim()}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      )}
    </Card>
  );
}
