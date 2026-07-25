import Link from "next/link";
import { HelpCircle, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardIntelligenceSummary, PeriodInfo } from "@/features/intelligence/data";
import { formatPct, formatSatisfaction } from "@/features/intelligence/format";

import { AskCapabilityInput } from "./ask-capability-input";

type SignalType = "opportunity" | "warning" | "question";

const SIGNAL_STYLE: Record<SignalType, { icon: LucideIcon; className: string }> = {
  opportunity: { icon: TrendingUp, className: "text-teal-400" },
  warning: { icon: TrendingDown, className: "text-amber-500" },
  question: { icon: HelpCircle, className: "text-sky-400" },
};

type Signal = { type: SignalType; headline: string; detail: string; href: string };

/** "for Jan 1 – Jul 25, 2026" when the year is still in progress, "in 2024"
 * once it's a complete year — mirrors the period-aware phrasing used
 * throughout the intelligence layer (CLAUDE.md's period comparison rule). */
function thisPeriodPhrase(period: PeriodInfo): string {
  return period.isPartial ? `for ${period.currentPeriodLabel}` : `in ${period.currentYear}`;
}

function comparisonPeriodPhrase(period: PeriodInfo): string {
  if (period.comparisonYear === null) return "the prior period";
  return period.isPartial ? `the same period in ${period.comparisonYear}` : `${period.comparisonYear}`;
}

function buildSignals(summary: DashboardIntelligenceSummary): Signal[] {
  const { period } = summary;

  const satisfactionDirection =
    summary.satisfactionDelta === null || summary.satisfactionDelta === 0 ? "flat" : summary.satisfactionDelta > 0 ? "up" : "down";
  const volumeDirection =
    summary.experiencesChangePct === null || summary.experiencesChangePct === 0 ? "flat" : summary.experiencesChangePct > 0 ? "up" : "down";

  const signals: Signal[] = [
    {
      type: satisfactionDirection === "down" ? "warning" : satisfactionDirection === "up" ? "opportunity" : "question",
      headline: "Satisfaction signal",
      detail:
        summary.satisfactionThisYear === null
          ? "Not enough survey data yet to compute a satisfaction signal."
          : satisfactionDirection === "flat"
            ? `Portfolio satisfaction is ${formatSatisfaction(summary.satisfactionThisYear)} ${thisPeriodPhrase(period)}, unchanged from ${comparisonPeriodPhrase(period)}.`
            : `Portfolio satisfaction is ${formatSatisfaction(summary.satisfactionThisYear)} ${thisPeriodPhrase(period)}, ${satisfactionDirection} ${Math.abs(summary.satisfactionDelta as number)} points from ${comparisonPeriodPhrase(period)}.`,
      href: "/dashboard/intelligence",
    },
    {
      type: volumeDirection === "down" ? "warning" : volumeDirection === "up" ? "opportunity" : "question",
      headline: "Volume signal",
      detail:
        volumeDirection === "flat" || summary.experiencesChangePct === null
          ? `${summary.experiencesThisYear.toLocaleString()} experiences delivered ${thisPeriodPhrase(period)}, about the same as ${comparisonPeriodPhrase(period)}.`
          : `${summary.experiencesThisYear.toLocaleString()} experiences delivered ${thisPeriodPhrase(period)}, ${formatPct(Math.abs(summary.experiencesChangePct))} ${volumeDirection === "up" ? "more" : "fewer"} than ${comparisonPeriodPhrase(period)}.`,
      href: "/dashboard/intelligence",
    },
    {
      type: summary.topOpportunity ? "opportunity" : "question",
      headline: "Top opportunity",
      detail: summary.topOpportunity?.headline ?? "No standout opportunity surfaced yet — check back as more data comes in.",
      href: "/dashboard/intelligence/clients",
    },
  ];

  return signals;
}

export function CapabilityIntelligenceSection({ summary }: { summary: DashboardIntelligenceSummary }) {
  const signals = buildSignals(summary);

  return (
    <Card className="border-gold/40 bg-night/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-gold" />
          CapabilityOS Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {signals.map((signal) => {
            const style = SIGNAL_STYLE[signal.type];
            const Icon = style.icon;
            return (
              <div key={signal.headline} className="flex h-full flex-col justify-between gap-3 rounded-lg border border-border-subtle bg-surface-elevated p-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Icon className={`size-4 ${style.className}`} />
                    {signal.headline}
                  </div>
                  <p className="text-sm text-ivory">{signal.detail}</p>
                </div>
                <Link href={signal.href} className="inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline">
                  Explore evidence →
                </Link>
              </div>
            );
          })}
        </div>

        <AskCapabilityInput />
      </CardContent>
      <CardFooter>
        <Link href="/dashboard/intelligence" className="text-sm font-medium text-gold hover:underline">
          Explore full intelligence →
        </Link>
      </CardFooter>
    </Card>
  );
}
