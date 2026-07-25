import { Award, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrganizationIntelligence, PeriodInfo } from "@/features/intelligence/data";
import { generateOrgInsights } from "@/features/intelligence/insights";
import { formatCurrency, formatPct, formatSatisfaction } from "@/features/intelligence/format";

import { ColumnBarChart, HorizontalBarChart } from "./bar-chart";
import { InsightGrid } from "./insight-card";
import { MetricComparisonCard } from "./metric-comparison-card";

function changeDirectionFromPct(pct: number | null): "up" | "down" | "flat" {
  if (pct === null || Math.abs(pct) < 0.5) return "flat";
  return pct > 0 ? "up" : "down";
}

function changeDirectionFromDelta(delta: number | null): "up" | "down" | "flat" {
  if (delta === null || Math.abs(delta) < 0.05) return "flat";
  return delta > 0 ? "up" : "down";
}

/** The comparison basis for a "this year" figure — always states the exact
 * period being compared, never a bare year, so a partial year is never
 * implied to be comparable to a full one. */
function comparisonCaption(period: PeriodInfo): string {
  if (period.comparisonYear === null) return "No prior period to compare";
  if (period.isPartial) {
    const fallbackNote = period.comparisonIsFallbackYear ? " (nearest year with data)" : "";
    return `vs ${period.comparisonPeriodLabel}${fallbackNote}`;
  }
  return `vs Full Year ${period.comparisonYear}`;
}

export function OrgIntelligenceView({ data }: { data: OrganizationIntelligence }) {
  const insights = generateOrgInsights(data);
  const yearRows = [...data.yearlyTrend].sort((a, b) => b.year - a.year);
  const { period } = data;
  const periodHeaderLabel = period.isPartial ? period.currentPeriodLabel : String(data.currentYear);

  return (
    <div className="space-y-8">
      {/* Section 1 — Operational Health */}
      <section className="space-y-3">
        {period.isPartial && (
          <p className="flex items-start gap-2 rounded-lg border border-border-subtle bg-night/40 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-gold" />
            {data.currentYear} is a partial year in progress ({period.currentPeriodLabel}). Every &quot;this year&quot;
            figure below is compared against the same window in{" "}
            {period.comparisonYear ?? "the prior year"}
            {period.comparisonIsFallbackYear
              ? " — the nearest earlier year with data, since the immediately preceding year has none"
              : ""}
            , not that year&apos;s full 12 months.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricComparisonCard
            label="Active Engagements"
            value={data.activeEngagements.toLocaleString()}
            changeLabel="this month"
            changeDirection="flat"
          />
          <MetricComparisonCard
            label={`Experiences Delivered (${periodHeaderLabel})`}
            value={data.experiencesThisYear.toLocaleString()}
            changeLabel={`${formatPct(data.experiencesChangePct, { showSign: true })} ${comparisonCaption(period)}`}
            changeDirection={changeDirectionFromPct(data.experiencesChangePct)}
          />
          <MetricComparisonCard
            label={`Participants Trained (${periodHeaderLabel})`}
            value={data.participantsThisYear.toLocaleString()}
            changeLabel={`${formatPct(data.participantsChangePct, { showSign: true })} ${comparisonCaption(period)}`}
            changeDirection={changeDirectionFromPct(data.participantsChangePct)}
          />
          <MetricComparisonCard
            label={`Overall Satisfaction (${periodHeaderLabel})`}
            value={formatSatisfaction(data.satisfactionThisYear)}
            changeLabel={
              data.satisfactionDelta !== null
                ? `${data.satisfactionDelta > 0 ? "+" : ""}${data.satisfactionDelta} ${comparisonCaption(period)}`
                : comparisonCaption(period)
            }
            changeDirection={changeDirectionFromDelta(data.satisfactionDelta)}
          />
        </div>
      </section>

      {/* Section 2 — 5-Year Volume Trend */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Volume Trend</CardTitle>
          <CardDescription>
            Year-by-year delivery across the full history on record.
            {period.isPartial && ` ${data.currentYear}'s change figures are vs the same year-to-date window, not a full year.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead className="text-right">Experiences</TableHead>
                <TableHead className="text-right">Participants</TableHead>
                <TableHead className="text-right">Avg Satisfaction</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearRows.map((row) => (
                <TableRow key={row.year}>
                  <TableCell className="font-medium text-ivory align-top">
                    {row.year}
                    {row.isCurrent && (
                      <Badge className="ml-2 bg-gold/15 text-gold" variant="secondary">
                        {row.isPartial ? "partial year" : "current"}
                      </Badge>
                    )}
                    {row.isPartial && (
                      <p className="mt-1 text-xs font-normal whitespace-normal text-muted-foreground">{row.comparisonPeriodLabel}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-right align-top">
                    <span className={row.year === data.bestVolumeYear ? "font-semibold text-gold" : "text-ivory"}>
                      {row.experiences}
                    </span>
                    {row.experiencesChangePct !== null && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({formatPct(row.experiencesChangePct, { showSign: true })})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right align-top">
                    {row.participants.toLocaleString()}
                    {row.participantsChangePct !== null && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({formatPct(row.participantsChangePct, { showSign: true })})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right align-top">
                    <span className={row.year === data.bestSatisfactionYear ? "font-semibold text-gold" : "text-ivory"}>
                      {formatSatisfaction(row.avgSatisfaction)}
                    </span>
                    {row.satisfactionDelta !== null && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({row.satisfactionDelta > 0 ? "+" : ""}
                        {row.satisfactionDelta})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right align-top text-ivory">{formatCurrency(row.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Section 3 — Experience Type Mix */}
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Experience Type Mix</CardTitle>
            <CardDescription>
              All-time portfolio breakdown{data.previousYear !== null ? ` — ${periodHeaderLabel} vs ${data.previousYear} below` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <HorizontalBarChart rows={data.typeMixAllTime.map((t) => ({ label: t.label, value: t.count, pct: t.pct }))} valueSuffix=" exp." />

            {data.previousYear !== null && (
              <div className="grid grid-cols-2 gap-4 border-t border-border-subtle pt-4 text-xs">
                <div>
                  <p className="mb-2 font-medium text-ivory">
                    {periodHeaderLabel}
                    {period.isPartial && <span className="ml-1 font-normal text-muted-foreground">(partial year, composition only)</span>}
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    {data.typeMixThisYear.map((t) => (
                      <li key={t.type}>
                        {t.label}: {t.pct}%
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 font-medium text-ivory">{data.previousYear}</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {data.typeMixLastYear.map((t) => (
                      <li key={t.type}>
                        {t.label}: {t.pct}%
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4 — Satisfaction Distribution */}
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Satisfaction Distribution</CardTitle>
            <CardDescription>Average overall rating per completed experience, bucketed.</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              rows={data.satisfactionDistribution.map((b) => ({
                label: b.label,
                value: b.count,
                pct: b.pct,
                colorClassName: b.label === "<3.0" ? "bg-destructive" : b.label === "3.0–3.4" ? "bg-amber-500" : "bg-gold",
              }))}
              valueSuffix=" exp."
            />
          </CardContent>
        </Card>
      </div>

      {/* Section 5 — Seasonal Pattern */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Seasonal Pattern</CardTitle>
          <CardDescription>Delivery volume by month, combined across every year on record.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ColumnBarChart
            entries={data.seasonal.map((m) => ({
              label: m.monthLabel,
              value: m.experiences,
              highlight: data.peakMonths.includes(m.monthLabel),
            }))}
          />
          {data.peakMonths.length > 0 && (
            <p className="rounded-lg border border-gold/20 bg-night/40 p-3 text-sm text-ivory">
              Peak delivery months are {data.peakMonths.join(" and ")}. Consider building capacity in advance.
              {data.bestSatisfactionMonths.length > 0 && (
                <span className="text-muted-foreground"> Highest satisfaction: {data.bestSatisfactionMonths.join(", ")}.</span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 6 — Top Insights */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="size-4 text-gold" />
            Top Insights
          </CardTitle>
          <CardDescription>Patterns computed from the full dataset — recommendations for a human to act on.</CardDescription>
        </CardHeader>
        <CardContent>
          <InsightGrid insights={insights} />
        </CardContent>
      </Card>
    </div>
  );
}
