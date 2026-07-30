"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";

import { downloadSatisfactionReportPdf } from "../actions";

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type Props = {
  experienceId: string;
};

export function DownloadSatisfactionReportButton({ experienceId }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await downloadSatisfactionReportPdf(experienceId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      const bytes = base64ToBytes(result.base64);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" onClick={handleClick} disabled={isGenerating}>
        <FileDown className="size-4" />
        {isGenerating ? "Generating..." : "Download Report"}
      </Button>
      {error && <p className="max-w-60 text-xs text-destructive">{error}</p>}
    </div>
  );
}
