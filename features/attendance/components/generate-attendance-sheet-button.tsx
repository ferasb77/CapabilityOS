"use client";

import { useState, useTransition } from "react";
import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import { generateAttendanceSheet } from "../actions";

type Props = {
  experienceId: string;
  date: string;
};

export function GenerateAttendanceSheetButton({ experienceId, date }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);

    startTransition(async () => {
      const result = await generateAttendanceSheet(experienceId, date);

      if (!result.success) {
        setError(result.error);
        return;
      }

      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
        <FileDown className="size-4" />
        {isPending ? "Generating..." : "Generate Sheet"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
