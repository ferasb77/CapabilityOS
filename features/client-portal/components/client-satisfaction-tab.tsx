import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SatisfactionReportData } from "@/features/reports/data";

import { DownloadSatisfactionReportButton } from "./download-satisfaction-report-button";

const DISTRIBUTION_LABELS = [1, 2, 3, 4, 5];

function scoreColorClass(score: number): string {
  if (score >= 4.0) return "text-emerald-400";
  if (score >= 3.0) return "text-amber-400";
  return "text-destructive";
}

function DimensionCard({ label, average, distribution }: { label: string; average: number | null; distribution: number[] }) {
  const maxCount = Math.max(...distribution, 1);

  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className={`font-heading text-3xl font-semibold ${average !== null ? scoreColorClass(average) : "text-muted-foreground"}`}>
          {average !== null ? average.toFixed(1) : "—"}
          <span className="text-sm font-normal text-muted-foreground">/5</span>
        </p>
        <div className="space-y-1.5">
          {DISTRIBUTION_LABELS.map((star, index) => (
            <div key={star} className="flex items-center gap-2">
              <span className="w-6 text-xs text-muted-foreground">{star}★</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-night/60">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{ width: `${(distribution[index] / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-4 text-right text-xs text-muted-foreground">{distribution[index]}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type Props = {
  data: SatisfactionReportData | null;
  experienceId: string;
};

export function ClientSatisfactionTab({ data, experienceId }: Props) {
  if (!data) {
    return (
      <Card className="bg-surface-elevated">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No survey results are available for this program yet.
        </CardContent>
      </Card>
    );
  }

  const overall = data.dimensions.find((dimension) => dimension.key === "overall");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <p className="text-sm text-muted-foreground">Overall Satisfaction</p>
          <p className={`font-heading text-5xl font-semibold ${overall?.average !== null && overall?.average !== undefined ? scoreColorClass(overall.average) : "text-muted-foreground"}`}>
            {overall?.average !== null && overall?.average !== undefined ? overall.average.toFixed(1) : "—"}
            <span className="text-lg font-normal text-muted-foreground">/5</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {data.responseRate}% response rate ({data.surveysCompleted} of {data.surveysSent})
          </p>
        </div>
        <DownloadSatisfactionReportButton experienceId={experienceId} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.dimensions.map((dimension) => (
          <DimensionCard
            key={dimension.key}
            label={dimension.label}
            average={dimension.average}
            distribution={dimension.distribution}
          />
        ))}
      </div>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Open Responses</CardTitle>
          <CardDescription>Shown anonymously.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(
            [
              { heading: "What participants found most valuable", items: data.feedback.valuable },
              { heading: "Areas for improvement", items: data.feedback.improvements },
              { heading: "Additional comments", items: data.feedback.additionalComments },
            ] as const
          ).map((section) => (
            <div key={section.heading}>
              <p className="text-sm font-medium text-ivory">{section.heading}</p>
              {section.items.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">No responses provided.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {section.items.map((item, index) => (
                    <li key={index} className="rounded-lg border border-border-subtle bg-night/40 p-2.5 text-sm text-ivory">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
