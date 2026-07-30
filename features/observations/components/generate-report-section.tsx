"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FacilitatorReport } from "../data";

import { generateFacilitatorReport } from "../actions";
import { ReportEditor } from "./report-editor";

type Props = {
  experienceId: string;
  initialReport: FacilitatorReport | null;
};

export function GenerateReportSection({ experienceId, initialReport }: Props) {
  const [report, setReport] = useState<FacilitatorReport | null>(initialReport);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);

    startTransition(async () => {
      const result = await generateFacilitatorReport(experienceId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setReport(result.report);
    });
  }

  if (report) {
    return <ReportEditor experienceId={experienceId} report={report} onReportChange={setReport} />;
  }

  return (
    <Card className="bg-surface-elevated">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Sparkles className="size-8 text-gold" />
        <div>
          <p className="text-ivory">Ready to draft the final report?</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            CapabilityOS will synthesize every observation recorded on this experience into a
            client-ready draft you can edit and approve.
          </p>
        </div>
        <Button type="button" disabled={isPending} onClick={handleGenerate}>
          {isPending ? "CapabilityOS is drafting your report..." : "Generate Final Report"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
