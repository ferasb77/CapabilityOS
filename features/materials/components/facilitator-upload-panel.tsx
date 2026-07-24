"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { addFacilitatorMaterial } from "../actions";

type Props = {
  facilitatorId: string;
  experienceId: string;
  experienceSlug: string;
  workspaceId: string;
};

export function FacilitatorUploadPanel({ facilitatorId, experienceId, experienceSlug, workspaceId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setDescription("");
    setFileName(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("file", file);

    startTransition(async () => {
      const result = await addFacilitatorMaterial(facilitatorId, experienceId, experienceSlug, workspaceId, formData);
      if (result.success) {
        reset();
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add My Resource
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border-subtle bg-surface p-5"
    >
      <div className="flex items-center justify-between">
        <p className="font-medium text-ivory">Add My Resource</p>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-muted-foreground hover:text-ivory"
          aria-label="Cancel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="facilitator-material-title">
          Title <span className="text-gold">*</span>
        </Label>
        <Input id="facilitator-material-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="facilitator-material-description">Description (optional)</Label>
        <Textarea
          id="facilitator-material-description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="facilitator-material-file">File</Label>
        <input
          ref={fileInputRef}
          id="facilitator-material-file"
          type="file"
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
        />
        {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
        <p className="text-xs text-muted-foreground">Any file type, up to 50MB.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isSaving || title.trim().length === 0}>
        <UploadCloud className="size-4" />
        {isSaving ? "Uploading..." : "Upload"}
      </Button>
    </form>
  );
}
