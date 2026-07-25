import Link from "next/link";
import { ArrowRight, Lightbulb, Smile, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { DashboardIntelligenceSummary, PeriodInfo } from "@/features/intelligence/data";
import { formatPct, formatSatisfaction } from "@/features/intelligence/format";

type CardConfig = {
  icon: typeof Smile;
  label: string;
  headline: string;
  href: string;
};

/** "for Jan 1 – Jul 25, 2026" when the year is still in progress, "in 2024"
 * once it's a complete year — so a signal never implies a full-year figure
 * when it's actually a year-to-date one. */
function thisPeriodPhrase(period: PeriodInfo): string {
  return period.isPartial ? `for ${period.currentPeriodLabel}` : `in ${period.currentYear}`;
}

function comparisonPeriodPhrase(period: PeriodInfo): string {
  if (period.comparisonYear === null) return "the prior period";
  return period.isPartial ? `the same period in ${period.comparisonYear}` : `${period.comparisonYear}`;
}

export function IntelligenceSummary({ summary }: { summary: DashboardIntelligenceSummary }) {
  const { period } = summary;
  const satisfactionDirection =
    summary.satisfactionDelta === null || summary.satisfactionDelta === 0
      ? "flat"
      : summary.satisfactionDelta > 0
        ? "up"
        : "down";
  const volumeDirection =
    summary.experiencesChangePct === null || summary.experiencesChangePct === 0
      ? "flat"
      : summary.experiencesChangePct > 0
        ? "up"
        : "down";

  const cards: CardConfig[] = [
    {
      icon: Smile,
      label: "Satisfaction Signal",
      headline:
        summary.satisfactionThisYear === null
          ? "Not enough survey data yet to compute a satisfaction signal."
          : satisfactionDirection === "flat"
            ? `Portfolio satisfaction is ${formatSatisfaction(summary.satisfactionThisYear)} ${thisPeriodPhrase(period)}, unchanged from ${comparisonPeriodPhrase(period)}`
            : `Portfolio satisfaction is ${formatSatisfaction(summary.satisfactionThisYear)} ${thisPeriodPhrase(period)}, ${satisfactionDirection} ${Math.abs(summary.satisfactionDelta as number)} points from ${comparisonPeriodPhrase(period)}`,
      href: "/dashboard/intelligence",
    },
    {
      icon: TrendingUp,
      label: "Volume Signal",
      headline:
        volumeDirection === "flat" || summary.experiencesChangePct === null
          ? `${summary.experiencesThisYear.toLocaleString()} experiences delivered ${thisPeriodPhrase(period)}, about the same as ${comparisonPeriodPhrase(period)}`
          : `${summary.experiencesThisYear.toLocaleString()} experiences delivered ${thisPeriodPhrase(period)}, ${formatPct(Math.abs(summary.experiencesChangePct))} ${volumeDirection === "up" ? "more" : "fewer"} than ${comparisonPeriodPhrase(period)}`,
      href: "/dashboard/intelligence",
    },
    {
      icon: Lightbulb,
      label: "Top Opportunity",
      headline: summary.topOpportunity?.headline ?? "No standout opportunity surfaced yet — check back as more data comes in.",
      href: "/dashboard/intelligence/clients",
    },
  ];

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-ivory">Intelligence Summary</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label} className="bg-surface-elevated">
            <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <card.icon className="size-4 text-gold" />
                  {card.label}
                </div>
                <p className="text-sm text-ivory">{card.headline}</p>
              </div>
              <Link href={card.href} className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline">
                See full analysis
                <ArrowRight className="size-3" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
