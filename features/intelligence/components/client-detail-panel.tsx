import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClientComparisonRow, ClientDetailIntelligence } from "@/features/intelligence/data";
import { generateClientInsights } from "@/features/intelligence/insights";
import { formatCurrency, formatDateMonthYear, formatSatisfaction } from "@/features/intelligence/format";

import { ColumnBarChart, HorizontalBarChart } from "./bar-chart";
import { InsightGrid } from "./insight-card";
import { RelationshipRiskBadge } from "./relationship-risk-badge";

const RISK_EXPLANATION: Record<ClientDetailIntelligence["relationshipRisk"], string> = {
  healthy: "Satisfaction is stable or improving and this client has been active within the last 6 months.",
  monitor: "Satisfaction is declining, or there has been no engagement in 6–12 months.",
  at_risk: "Satisfaction is declining significantly, or there has been no engagement in 12+ months.",
};

export function ClientDetailPanel({ row, data }: { row: ClientComparisonRow; data: ClientDetailIntelligence }) {
  const insights = generateClientInsights(row, data);
  const strongAffinity = data.facilitatorAffinity[0] && data.facilitatorAffinity[0].shareOfClientExperiences > 40;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-ivory">{data.client.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground capitalize">
            {data.client.type}
            {data.client.industry ? ` · ${data.client.industry}` : ""}
            {data.client.country ? ` · ${data.client.country}` : ""}
          </p>
        </div>
        <RelationshipRiskBadge risk={data.relationshipRisk} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* A. 5-Year Satisfaction Trend */}
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Satisfaction Trend</CardTitle>
            <CardDescription>Average overall rating by year.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.yearlyTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No survey data on record for this client.</p>
            ) : (
              <ColumnBarChart
                entries={data.yearlyTrend.map((y) => ({
                  label: y.isPartialCurrentYear ? `${y.year} (YTD)` : String(y.year),
                  value: y.avgSatisfaction ?? 0,
                  colorClassName: "bg-gold",
                }))}
                formatValue={(v) => (v > 0 ? v.toFixed(1) : "—")}
              />
            )}
          </CardContent>
        </Card>

        {/* B. Volume Pattern */}
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Volume Pattern</CardTitle>
            <CardDescription>Experiences delivered per year.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.yearlyTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No experiences on record for this client.</p>
            ) : (
              <>
                <ColumnBarChart
                  entries={data.yearlyTrend.map((y) => ({
                    label: y.isPartialCurrentYear ? `${y.year} (YTD)` : String(y.year),
                    value: y.experiences,
                  }))}
                />
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {data.yearlyTrend.map((y) => (
                    <span key={y.year}>
                      {y.year}
                      {y.isPartialCurrentYear ? " (YTD)" : ""}: {y.participants.toLocaleString()} participants
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* C. Experience Type Distribution */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Experience Type Distribution</CardTitle>
          <CardDescription>What this client buys, and how the mix has shifted over time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <HorizontalBarChart rows={data.typeDistribution.map((t) => ({ label: t.label, value: t.count, pct: t.pct }))} valueSuffix=" exp." />
          {data.typeDistributionEarly.length > 0 && data.typeDistributionLate.length > 0 && (
            <div className="grid grid-cols-2 gap-4 border-t border-border-subtle pt-4 text-xs">
              <div>
                <p className="mb-2 font-medium text-ivory">Earlier years</p>
                <ul className="space-y-1 text-muted-foreground">
                  {data.typeDistributionEarly.map((t) => (
                    <li key={t.type}>
                      {t.label}: {t.pct}%
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 font-medium text-ivory">Recent years</p>
                <ul className="space-y-1 text-muted-foreground">
                  {data.typeDistributionLate.map((t) => (
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

      {/* D. Facilitator Affinity */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Facilitator Affinity</CardTitle>
          <CardDescription>Facilitators this client has worked with most.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.facilitatorAffinity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No facilitators on record for this client.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {data.facilitatorAffinity.map((f) => (
                  <li
                    key={f.name}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-night/40 p-3"
                  >
                    <span className="font-medium text-ivory">{f.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {f.experienceCount} experiences ({f.shareOfClientExperiences}%) · {formatSatisfaction(f.avgSatisfaction)} avg
                    </span>
                  </li>
                ))}
              </ul>
              {strongAffinity && (
                <p className="rounded-lg border border-amber-500/25 bg-night/40 p-3 text-sm text-ivory">
                  Strong affinity pattern: {data.facilitatorAffinity[0].name} alone delivers{" "}
                  {data.facilitatorAffinity[0].shareOfClientExperiences}% of this client&apos;s programs.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* E. Engagement Health */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Engagement Health</CardTitle>
          <CardDescription>All engagements on record for this client.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.engagements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No engagements on record.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Engagement</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Experiences</TableHead>
                  <TableHead className="text-right">Satisfaction</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.engagements.map((eng) => (
                  <TableRow key={eng.id}>
                    <TableCell className="font-medium text-ivory">{eng.title}</TableCell>
                    <TableCell className="text-muted-foreground">{eng.year}</TableCell>
                    <TableCell className="text-right text-ivory">{formatCurrency(eng.contractValue)}</TableCell>
                    <TableCell className="text-right text-ivory">{eng.experiences}</TableCell>
                    <TableCell className="text-right text-ivory">{formatSatisfaction(eng.avgSatisfaction)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {eng.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* F. Client-Specific Insights */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <InsightGrid insights={insights} />
        </CardContent>
      </Card>

      {/* G. Relationship Risk Signal */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Relationship Risk
            <RelationshipRiskBadge risk={data.relationshipRisk} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm text-ivory">{RISK_EXPLANATION[data.relationshipRisk]}</p>
          <p className="text-xs text-muted-foreground">
            Last active: {formatDateMonthYear(data.lastActiveDate)}
            {data.recentTrendDelta !== null &&
              ` · Recent satisfaction trend: ${data.recentTrendDelta > 0 ? "+" : ""}${data.recentTrendDelta}`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
