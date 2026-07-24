"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { Material } from "@/features/materials/data";
import {
  AVAILABLE_FROM_LABELS,
  AVAILABLE_FROM_OPTIONS,
  MATERIAL_AUDIENCE_LABELS,
  MATERIAL_AUDIENCES,
  MAX_MATERIAL_FILE_BYTES,
  type AvailableFrom,
  type MaterialAudience,
  type MaterialType,
} from "@/features/materials/schema";

import { addMaterial, fetchLinkPreview, updateMaterial } from "../actions";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experienceId: string;
  experienceSlug: string;
  workspaceId: string;
  material?: Material;
  defaultAudience?: MaterialAudience;
};

export function MaterialFormSheet({
  open,
  onOpenChange,
  experienceId,
  experienceSlug,
  workspaceId,
  material,
  defaultAudience = "participant",
}: Props) {
  const router = useRouter();
  const isEditMode = Boolean(material);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(material?.title ?? "");
  const [description, setDescription] = useState(material?.description ?? "");
  const [materialType, setMaterialType] = useState<MaterialType>(material?.materialType ?? "file");
  const [url, setUrl] = useState(material?.url ?? "");
  const [audience, setAudience] = useState<MaterialAudience>(material?.audience ?? defaultAudience);
  const [availableFrom, setAvailableFrom] = useState<AvailableFrom>(material?.availableFrom ?? "registration");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [linkPreviewTitle, setLinkPreviewTitle] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Debounced best-effort title fetch — purely informational, never blocks
  // saving. A stale-response guard (the `cancelled` flag) keeps a slow
  // earlier fetch from overwriting the result of a newer one if the
  // operator keeps typing.
  useEffect(() => {
    let cancelled = false;
    const trimmedUrl = url.trim();
    const shouldFetch = materialType === "link" && trimmedUrl.length > 0;

    const timeoutId = setTimeout(
      () => {
        if (cancelled) {
          return;
        }
        if (!shouldFetch) {
          setLinkPreviewTitle(null);
          setIsLoadingPreview(false);
          return;
        }

        setIsLoadingPreview(true);
        fetchLinkPreview(trimmedUrl).then((result) => {
          if (!cancelled) {
            setLinkPreviewTitle(result.title);
            setIsLoadingPreview(false);
          }
        });
      },
      shouldFetch ? 600 : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [url, materialType]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_MATERIAL_FILE_BYTES) {
      setError("File must be under 50MB.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("materialType", materialType);
    formData.set("url", url);
    formData.set("audience", audience);
    formData.set("availableFrom", availableFrom);
    if (materialType === "file" && selectedFile) {
      formData.set("file", selectedFile);
    }

    const result =
      isEditMode && material
        ? await updateMaterial(material.id, experienceId, experienceSlug, formData)
        : await addMaterial(experienceId, experienceSlug, workspaceId, formData);

    setIsSaving(false);

    if (result.success) {
      onOpenChange(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  const currentFileLabel = selectedFile
    ? `${selectedFile.name} (${formatBytes(selectedFile.size)})`
    : material?.fileName
      ? `${material.fileName}${material.fileSizeBytes ? ` (${formatBytes(material.fileSizeBytes)})` : ""}`
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditMode ? "Edit Material" : "Add Material"}</SheetTitle>
          <SheetDescription>Share a file or link with participants or facilitators.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label htmlFor="material-title">
              Title <span className="text-gold">*</span>
            </Label>
            <Input id="material-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="material-description">Description (optional)</Label>
            <Textarea
              id="material-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={materialType === "file" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setMaterialType("file")}
              >
                File Upload
              </Button>
              <Button
                type="button"
                variant={materialType === "link" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setMaterialType("link")}
              >
                External Link
              </Button>
            </div>
          </div>

          {materialType === "file" ? (
            <div className="space-y-2">
              <Label htmlFor="material-file">File {!isEditMode && <span className="text-gold">*</span>}</Label>
              <input
                ref={fileInputRef}
                id="material-file"
                type="file"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
              />
              {currentFileLabel && <p className="text-xs text-muted-foreground">{currentFileLabel}</p>}
              <p className="text-xs text-muted-foreground">Any file type, up to 50MB.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="material-url">
                URL <span className="text-gold">*</span>
              </Label>
              <Input
                id="material-url"
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
              {url.trim() && (
                <div className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-night/40 px-3 py-2 text-xs text-muted-foreground">
                  <Link2 className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {isLoadingPreview ? "Loading preview..." : (linkPreviewTitle ?? url.trim())}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="material-audience">Audience</Label>
            <Select
              value={audience}
              onValueChange={(value) => value && setAudience(value as MaterialAudience)}
              items={MATERIAL_AUDIENCES.map((value) => ({ value, label: MATERIAL_AUDIENCE_LABELS[value] }))}
            >
              <SelectTrigger id="material-audience" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_AUDIENCES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {MATERIAL_AUDIENCE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="material-available-from">Available from</Label>
            <Select
              value={availableFrom}
              onValueChange={(value) => value && setAvailableFrom(value as AvailableFrom)}
              items={AVAILABLE_FROM_OPTIONS.map((value) => ({ value, label: AVAILABLE_FROM_LABELS[value] }))}
            >
              <SelectTrigger id="material-available-from" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_FROM_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {AVAILABLE_FROM_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter>
          <Button type="button" disabled={isSaving || title.trim().length === 0} onClick={handleSave}>
            {isSaving ? "Saving..." : "Save Material"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
