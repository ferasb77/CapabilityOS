import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FacilitatorComparisonRow, FacilitatorDetailIntelligence } from "@/features/intelligence/data";
import { generateFacilitatorInsights } from "@/features/intelligence/insights";
import { formatDateShort, formatSatisfaction } from "@/features/intelligence/format";

import { ColumnBarChart } from "./bar-chart";
import { InsightGrid } from "./insight-card";

const AVAILABILITY_LABELS: Record<string, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-gold/15 text-gold" },
  partially_available: { label: "Partially Available", className: "bg-amber-500/15 text-amber-500" },
  unavailable: { label: "Unavailable", className: "bg-destructive/15 text-destructive" },
};

export function FacilitatorDetailPanel({ row, data }: { row: FacilitatorComparisonRow; data: FacilitatorDetailIntelligence }) {
  const insights = generateFacilitatorInsights(row, data);
  const availability = AVAILABILITY_LABELS[data.facilitator.availabilityStatus] ?? {
    label: data.facilitator.availabilityStatus,
    className: "bg-secondary text-secondary-foreground",
  };

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
          <CardContent>
            <ColumnBarChart entries={data.monthlyUtilization.map((m) => ({ label: m.monthLabel, value: m.experiences }))} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* B. Client Portfolio */}
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Client Portfolio</CardTitle>
            <CardDescription>Clients this facilitator has served.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.clientPortfolio.length === 0 ? (
              <p className="text-sm text-muted-foreground">No clients on record.</p>
            ) : (
              <ul className="space-y-2">
                {data.clientPortfolio.map((c) => (
                  <li key={c.clientId} className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-night/40 p-3">
                    <span className="font-medium text-ivory">{c.clientName}</span>
                    <span className="text-sm text-muted-foreground">
                      {c.experienceCount} exp. · {formatSatisfaction(c.avgSatisfaction)} avg
                    </span>
                  </li>
                ))}
              </ul>
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
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
