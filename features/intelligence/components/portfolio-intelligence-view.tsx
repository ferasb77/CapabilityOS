import { Globe2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PortfolioIntelligence } from "@/features/intelligence/data";
import { generatePortfolioInsights } from "@/features/intelligence/insights";
import { formatCurrency, formatPct, formatSatisfaction } from "@/features/intelligence/format";

import { HorizontalBarChart } from "./bar-chart";
import { InsightGrid } from "./insight-card";

export function PortfolioIntelligenceView({ data }: { data: PortfolioIntelligence }) {
  const insights = generatePortfolioInsights(data);
  const yearRowsDesc = [...data.serviceMixByYear].sort((a, b) => b.year - a.year);
  const revenueRowsDesc = [...data.revenueByYear].sort((a, b) => b.year - a.year);
  const sectorYearRowsDesc = [...data.sectorMixByYear].sort((a, b) => b.year - a.year);

  return (
    <div className="space-y-8">
      {/* Section 1 — Service Mix Evolution */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Service Mix Evolution</CardTitle>
          <CardDescription>Year-by-year breakdown of experience types, as a percentage of that year&apos;s delivery.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead className="text-right">Workshop</TableHead>
                <TableHead className="text-right">Assessment</TableHead>
                <TableHead className="text-right">Coaching</TableHead>
                <TableHead className="text-right">Other</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearRowsDesc.map((row) => (
                <TableRow key={row.year}>
                  <TableCell className="font-medium text-ivory">{row.year}</TableCell>
                  <TableCell className="text-right text-ivory">{row.workshopPct}%</TableCell>
                  <TableCell className="text-right text-ivory">{row.assessmentPct}%</TableCell>
                  <TableCell className="text-right text-ivory">{row.coachingPct}%</TableCell>
                  <TableCell className="text-right text-ivory">{row.otherPct}%</TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Section 2 — Topic/Theme Concentration */}
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Topic Concentration</CardTitle>
            <CardDescription>Top 10 most-delivered experience titles (exact match).</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Avg Satisfaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topTitles.map((t) => (
                  <TableRow key={t.title}>
                    <TableCell className="text-ivory">{t.title}</TableCell>
                    <TableCell className="text-right text-ivory">{t.count}</TableCell>
                    <TableCell className="text-right text-ivory">{formatSatisfaction(t.avgSatisfaction)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Section 3 — Geographic Distribution */}
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Geographic Distribution</CardTitle>
            <CardDescription>Experiences by market.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <HorizontalBarChart rows={data.geography.map((g) => ({ label: g.country, value: g.count, pct: g.pct }))} valueSuffix=" exp." />
            {data.geographyThisYearTop && data.geographyLastYearTop && (
              <p className="flex items-start gap-2 rounded-lg border border-border-subtle bg-night/40 p-3 text-xs text-muted-foreground">
                <Globe2 className="mt-0.5 size-3.5 shrink-0 text-gold" />
                Most-active market this year: <span className="text-ivory">{data.geographyThisYearTop}</span>. Last year:{" "}
                <span className="text-ivory">{data.geographyLastYearTop}</span>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section 4 — Client Sector Mix */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Client Sector Mix</CardTitle>
          <CardDescription>Corporate vs. government split, by volume and satisfaction.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.sectorMix.map((s) => (
              <div key={s.type} className="rounded-lg border border-border-subtle bg-night/40 p-4">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gold">{s.pct}%</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.count} experiences · {formatSatisfaction(s.avgSatisfaction)} avg satisfaction
                </p>
              </div>
            ))}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year</TableHead>
                <TableHead className="text-right">Corporate</TableHead>
                <TableHead className="text-right">Government</TableHead>
                <TableHead className="text-right">Corp. Satisfaction</TableHead>
                <TableHead className="text-right">Gov. Satisfaction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectorYearRowsDesc.map((row) => (
                <TableRow key={row.year}>
                  <TableCell className="font-medium text-ivory">{row.year}</TableCell>
                  <TableCell className="text-right text-ivory">{row.corporatePct}%</TableCell>
                  <TableCell className="text-right text-ivory">{row.governmentPct}%</TableCell>
                  <TableCell className="text-right text-ivory">{formatSatisfaction(row.corporateAvgSatisfaction)}</TableCell>
                  <TableCell className="text-right text-ivory">{formatSatisfaction(row.governmentAvgSatisfaction)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section 5 — Revenue Intelligence */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Revenue by Year</CardTitle>
            <CardDescription>Total contract value, from the engagements table.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueRowsDesc.map((row) => (
                  <TableRow key={row.year}>
                    <TableCell className="font-medium text-ivory">{row.year}</TableCell>
                    <TableCell className="text-right text-ivory">
                      {formatCurrency(row.revenue)}
                      {row.changePct !== null && (
                        <span className="ml-1.5 text-xs text-muted-foreground">({formatPct(row.changePct, { showSign: true })})</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Revenue by Client</CardTitle>
            <CardDescription>
              Top 5 clients by total contract value.
              {data.revenueConcentrationTop2Pct !== null && ` Top 2 represent ${data.revenueConcentrationTop2Pct}% of total revenue.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <HorizontalBarChart
              rows={data.revenueByClient.map((c) => ({ label: c.clientName, value: c.totalContractValue, pct: c.pct }))}
              formatValue={formatCurrency}
            />
            <div className="grid grid-cols-2 gap-4 border-t border-border-subtle pt-4 text-xs">
              {data.avgEngagementValueByType.map((t) => (
                <div key={t.type}>
                  <p className="text-muted-foreground">Avg engagement value — {t.label}</p>
                  <p className="mt-1 text-lg font-semibold text-ivory">{t.avg !== null ? formatCurrency(t.avg) : "—"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Insights</CardTitle>
          <CardDescription>Patterns computed from the portfolio dataset — recommendations for a human to act on.</CardDescription>
        </CardHeader>
        <CardContent>
          <InsightGrid insights={insights} />
        </CardContent>
      </Card>
    </div>
  );
}
