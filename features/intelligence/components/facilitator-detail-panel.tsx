import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FacilitatorComparisonRow, FacilitatorDetailIntelligence } from "@/features/intelligence/data";
import { generateFacilitatorInsights } from "@/features/intelligence/insights";
import { formatDateShort, formatPct, formatSatisfaction } from "@/features/intelligence/format";

import { ColumnBarChart, HorizontalBarChart } from "./bar-chart";
import { InsightGrid } from "./insight-card";

const AVAILABILITY_LABELS: Record<string, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-gold/15 text-gold" },
  partially_available: { label: "Partially Available", className: "bg-amber-500/15 text-amber-500" },
  unavailable: { label: "Unavailable", className: "bg-destructive/15 text-destructive" },
};

const CONSISTENCY_CLASS: Record<string, string> = {
  "Highly Consistent": "text-gold",
  Consistent: "text-gold",
  Variable: "text-amber-500",
  "Highly Variable": "text-destructive",
};

export function FacilitatorDetailPanel({ row, data }: { row: FacilitatorComparisonRow; data: FacilitatorDetailIntelligence }) {
  const insights = generateFacilitatorInsights(row, data);
  const availability = AVAILABILITY_LABELS[data.facilitator.availabilityStatus] ?? {
    label: data.facilitator.availabilityStatus,
    className: "bg-secondary text-secondary-foreground",
  };

  const withMultipleExperiences = data.clientPortfolio.filter((c) => c.experienceCount >= 2 && c.avgSatisfaction !== null);
  const strongestClientId =
    withMultipleExperiences.length > 0
      ? withMultipleExperiences.reduce((best, c) => ((c.avgSatisfaction as number) > (best.avgSatisfaction as number) ? c : best)).clientId
      : null;
  const weakestClientId =
    withMultipleExperiences.length > 1
      ? withMultipleExperiences.reduce((worst, c) => ((c.avgSatisfaction as number) < (worst.avgSatisfaction as number) ? c : worst)).clientId
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ivory">{data.facilitator.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.facilitator.expertiseAreas.length > 0 ? data.facilitator.expertiseAreas.join(" · ") : data.facilitator.email}
          </p>
        </div>
        <Badge className={availability.className}>{availability.label}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* A. 5-Year Performance Trend */}
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Performance Trend</CardTitle>
            <CardDescription>Average satisfaction and volume by year.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.yearlyTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No delivery history on record.</p>
            ) : (
              <>
                <ColumnBarChart
                  entries={data.yearlyTrend.map((y) => ({
                    label: y.isPartialCurrentYear ? `${y.year} (YTD)` : String(y.year),
                    value: y.avgSatisfaction ?? 0,
                  }))}
                  formatValue={(v) => (v > 0 ? v.toFixed(1) : "—")}
                />
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {data.yearlyTrend.map((y) => (
                    <span key={y.year}>
                      {y.year}
                      {y.isPartialCurrentYear ? " (YTD)" : ""}: {y.experiences} experiences
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* D. Utilization Pattern */}
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Utilization Pattern</CardTitle>
            <CardDescription>Experiences per month, combined across all years.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColumnBarChart entries={data.monthlyUtilization.map((m) => ({ label: m.monthLabel, value: m.experiences }))} />
            <div className="border-t border-border-subtle pt-4">
              <HorizontalBarChart
                rows={data.quarterlyUtilization.map((q) => ({
                  label: q.label,
                  value: q.experiences,
                  pct: data.totalExperiences > 0 ? Math.round((q.experiences / data.totalExperiences) * 1000) / 10 : 0,
                  colorClassName: q.quarter === data.busiestQuarter ? "bg-gold" : "bg-gold/40",
                }))}
                valueSuffix=" exp."
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Current quarter (Q{data.currentQuarter.quarter} {data.currentQuarter.year}): {data.currentQuarter.experiences} experiences
                {data.currentQuarter.historicalAvgPerQuarter !== null && (
                  <>
                    {" "}
                    vs a historical average of {data.currentQuarter.historicalAvgPerQuarter} per quarter
                    {data.currentQuarter.changePct !== null && ` (${formatPct(data.currentQuarter.changePct, { showSign: true })})`}
                  </>
                )}
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Concentration Risk by Service Line */}
      {data.serviceLineConcentration.length > 0 && (
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Concentration Risk by Service Line</CardTitle>
            <CardDescription>Share of the portfolio&apos;s total delivery of each line this facilitator personally carries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.serviceLineConcentration.map((line) => (
              <div key={line.type} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ivory">{line.label}</span>
                  <span className={cn("text-xs", line.sharePct > 35 ? "text-amber-500" : "text-muted-foreground")}>
                    {line.facilitatorCount} of {line.portfolioCount} portfolio-wide ({line.sharePct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-night/60">
                  <div
                    className={cn("h-full rounded-full", line.sharePct > 35 ? "bg-amber-500" : "bg-gold")}
                    style={{ width: `${Math.min(line.sharePct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {data.serviceLineConcentration.some((l) => l.sharePct > 35) && (
              <p className="rounded-lg border border-amber-500/25 bg-night/40 p-3 text-sm text-ivory">
                High concentration on at least one service line — consider developing backup facilitators.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* B. Client Portfolio — the client affinity matrix */}
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Client Portfolio</CardTitle>
            <CardDescription>Clients this facilitator has served, with satisfaction per client.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.clientPortfolio.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clients on record.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {data.clientPortfolio.map((c) => {
                    const isStrongest = c.clientId === strongestClientId;
                    const isWeakest = c.clientId === weakestClientId;
                    return (
                      <li
                        key={c.clientId}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border bg-night/40 p-3",
                          isStrongest ? "border-gold/40" : isWeakest ? "border-destructive/30" : "border-border-subtle"
                        )}
                      >
                        <span className="font-medium text-ivory">
                          {c.clientName}
                          {isStrongest && <span className="ml-2 text-xs text-gold">strongest</span>}
                          {isWeakest && <span className="ml-2 text-xs text-destructive">weakest</span>}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {c.experienceCount} exp. · {formatSatisfaction(c.avgSatisfaction)} avg
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        {/* C. Experience Type Performance */}
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Experience Type Performance</CardTitle>
            <CardDescription>Average satisfaction by delivery format.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.typePerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground">No delivery history on record.</p>
            ) : (
              <ul className="space-y-2">
                {data.typePerformance.map((t) => (
                  <li key={t.type} className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-night/40 p-3">
                    <span className="font-medium text-ivory">{t.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {t.count} exp. · {formatSatisfaction(t.avgSatisfaction)} avg
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* E. Benchmarking */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Benchmarking</CardTitle>
          <CardDescription>How this facilitator compares to the full portfolio.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">This facilitator</p>
            <p className="mt-1 text-2xl font-semibold text-gold">{formatSatisfaction(data.benchmarking.facilitatorAvg)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Portfolio average</p>
            <p className="mt-1 text-2xl font-semibold text-ivory">{formatSatisfaction(data.benchmarking.portfolioAvg)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Percentile</p>
            <p className="mt-1 text-2xl font-semibold text-ivory">
              {data.benchmarking.percentile !== null ? `${data.benchmarking.percentile}th` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Consistency (std dev {data.consistency.stdDev ?? "—"})</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold",
                data.consistency.label ? CONSISTENCY_CLASS[data.consistency.label] : "text-ivory"
              )}
            >
              {data.consistency.label ?? "—"}
            </p>
            <p className="text-xs text-muted-foreground">n={data.consistency.sampleSize}</p>
          </div>
        </CardContent>
      </Card>

      {/* F. Facilitator-Specific Insights */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <InsightGrid insights={insights} />
        </CardContent>
      </Card>

      {/* G. Availability and Upcoming */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Upcoming (Next 90 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assigned experiences in the next 90 days.</p>
          ) : (
            <ul className="space-y-2">
              {data.upcoming.map((exp) => (
                <li key={exp.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-night/40 p-3">
                  <div>
                    <p className="font-medium text-ivory">{exp.title}</p>
                    {exp.clientName && <p className="text-xs text-muted-foreground">{exp.clientName}</p>}
                  </div>
                  <span className="text-sm text-muted-foreground">{formatDateShort(exp.startDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
