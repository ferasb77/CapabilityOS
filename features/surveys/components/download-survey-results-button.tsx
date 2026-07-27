"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

import { downloadSurveyResults } from "../actions";

type Props = {
  experienceId: string;
  experienceSlug: string;
};

export function DownloadSurveyResultsButton({ experienceId, experienceSlug }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setIsExporting(true);
    setError(null);
    try {
      const result = await downloadSurveyResults(experienceId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${experienceSlug}-survey-results.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={handleDownload} disabled={isExporting}>
        <Download className="size-4" />
        {isExporting ? "Exporting..." : "Download Results CSV"}
      </Button>
      {error && <p className="max-w-60 text-right text-xs text-destructive">{error}</p>}
    </div>
  );
}
