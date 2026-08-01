"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

function formatSavedAt(savedAt: string | null): string | null {
  if (!savedAt) return null;
  return new Date(savedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function SaveSectionFooter({ error, savedAt }: { error?: string; savedAt: string | null }) {
  const { pending } = useFormStatus();
  const formattedSavedAt = formatSavedAt(savedAt);

  return (
    <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && formattedSavedAt && <p className="text-xs text-muted-foreground">Last saved {formattedSavedAt}</p>}
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
