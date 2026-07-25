import {
  Activity,
  Award,
  Calendar,
  ClipboardCheck,
  DollarSign,
  Gauge,
  Globe2,
  Landmark,
  Snowflake,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import type {
  ClientComparisonRow,
  ClientDetailIntelligence,
  FacilitatorComparisonRow,
  FacilitatorDetailIntelligence,
  OperationalEfficiency,
  OrganizationIntelligence,
  PortfolioIntelligence,
  SatisfactionIntelligence,
} from "./data";

// ---------------------------------------------------------------------------
// Pure, deterministic insight generation — no AI, no API calls. Every
// function here is a straight computation over its input data, following
// the platform's Data -> Information -> Evidence -> Insight -> Recommendation
// doctrine: these produce Insight, a human still makes the Recommendation
// and the Decision.
// ---------------------------------------------------------------------------

export type InsightType = "positive" | "warning" | "neutral";

export type InsightCard = {
  icon: LucideIcon;
  headline: string;
  detail: string;
  type: InsightType;
  metric?: string;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// Organization insights
// ---------------------------------------------------------------------------

export function generateOrgInsights(data: OrganizationIntelligence): InsightCard[] {
  const insights: InsightCard[] = [];

  // 1. Satisfaction trend across the full period on record.
  const yearsWithSatisfaction = data.yearlyTrend.filter((y) => y.avgSatisfaction !== null);
  if (yearsWithSatisfaction.length >= 2) {
    const first = yearsWithSatisfaction[0];
    const last = yearsWithSatisfaction[yearsWithSatisfaction.length - 1];
    const delta = round1((last.avgSatisfaction as number) - (first.avgSatisfaction as number));
    if (Math.abs(delta) > 0.15) {
      insights.push({
        icon: delta > 0 ? TrendingUp : TrendingDown,
        headline: `Overall satisfaction has ${delta > 0 ? "improved" : "declined"} ${Math.abs(delta)} points over ${first.year}–${last.year}`,
        detail: `Average overall rating moved from ${first.avgSatisfaction} in ${first.year} to ${last.avgSatisfaction} in ${last.year}.`,
        type: delta > 0 ? "positive" : "warning",
        metric: `${delta > 0 ? "+" : ""}${delta}`,
      });
    }
  }

  // 2. Average year-over-year volume growth (participants).
  const growthRates = data.yearlyTrend.map((y) => y.participantsChangePct).filter((v): v is number => v !== null);
  if (growthRates.length > 0) {
    const avgGrowth = round1(growthRates.reduce((sum, v) => sum + v, 0) / growthRates.length);
    if (Math.abs(avgGrowth) > 3) {
      insights.push({
        icon: avgGrowth > 0 ? TrendingUp : TrendingDown,
        headline: `Participant volume grew ${avgGrowth > 0 ? "" : "by "}${avgGrowth}% year-over-year on average`,
        detail: "Average of each year's change in participants trained versus the prior year.",
        type: avgGrowth > 0 ? "positive" : "warning",
        metric: `${avgGrowth > 0 ? "+" : ""}${avgGrowth}%`,
      });
    }
  }

  // 3. Best performing client.
  const rankedClients = [...data.clientSummaries]
    .filter((c) => c.avgSatisfaction !== null && c.totalExperiences > 0)
    .sort((a, b) => (b.avgSatisfaction ?? 0) - (a.avgSatisfaction ?? 0));
  if (rankedClients.length > 0) {
    const best = rankedClients[0];
    insights.push({
      icon: Award,
      headline: `${best.name} consistently delivers the highest satisfaction at ${best.avgSatisfaction} avg`,
      detail: `Across ${best.totalExperiences} experiences on record.`,
      type: "positive",
      metric: `${best.avgSatisfaction}`,
    });
  }

  // 4. Government vs. private sector comparison.
  const govSatisfaction = round1AvgOf(data.clientSummaries.filter((c) => c.type === "government" && c.avgSatisfaction !== null));
  const privateSatisfaction = round1AvgOf(data.clientSummaries.filter((c) => c.type !== "government" && c.avgSatisfaction !== null));
  if (govSatisfaction !== null && privateSatisfaction !== null) {
    const gap = round1(privateSatisfaction - govSatisfaction);
    if (gap > 0.15) {
      insights.push({
        icon: Landmark,
        headline: `Government sector programs average ${govSatisfaction} — ${gap} points below private sector`,
        detail: `Private/corporate clients average ${privateSatisfaction} over the same period.`,
        type: "warning",
        metric: `-${gap}`,
      });
    }
  }

  // 5. Seasonal finding — Q4 vs Q2.
  const q2 = data.quarterlySatisfaction.find((q) => q.quarter === 2);
  const q4 = data.quarterlySatisfaction.find((q) => q.quarter === 4);
  if (q2?.avgSatisfaction !== null && q2?.avgSatisfaction !== undefined && q4?.avgSatisfaction !== null && q4?.avgSatisfaction !== undefined) {
    const pctDiff = q2.avgSatisfaction > 0 ? round1(((q4.avgSatisfaction - q2.avgSatisfaction) / q2.avgSatisfaction) * 100) : 0;
    if (Math.abs(pctDiff) > 2) {
      insights.push({
        icon: Calendar,
        headline: `Q4 programs have ${Math.abs(pctDiff)}% ${pctDiff > 0 ? "higher" : "lower"} satisfaction than Q2 programs`,
        detail: `Q4 averages ${q4.avgSatisfaction} vs Q2's ${q2.avgSatisfaction}.`,
        type: pctDiff > 0 ? "positive" : "neutral",
        metric: `${pctDiff > 0 ? "+" : ""}${pctDiff}%`,
      });
    }
  }

  // 6. Facilitator concentration.
  const rankedFacilitators = [...data.facilitatorSummaries].sort((a, b) => b.experienceCount - a.experienceCount);
  if (rankedFacilitators.length >= 3 && data.totalExperiences > 0) {
    const top3Count = rankedFacilitators.slice(0, 3).reduce((sum, f) => sum + f.experienceCount, 0);
    const pct = round1((top3Count / data.totalExperiences) * 100);
    insights.push({
      icon: Users,
      headline: `Top 3 facilitators deliver ${pct}% of all experiences`,
      detail: `${rankedFacilitators
        .slice(0, 3)
        .map((f) => f.name)
        .join(", ")} carry the bulk of delivery volume.`,
      type: pct > 60 ? "warning" : "neutral",
      metric: `${pct}%`,
    });
  }

  // 7. Revenue concentration.
  const rankedRevenue = [...data.clientSummaries].sort((a, b) => b.totalContractValue - a.totalContractValue);
  const totalRevenue = data.clientSummaries.reduce((sum, c) => sum + c.totalContractValue, 0);
  if (rankedRevenue.length >= 2 && totalRevenue > 0) {
    const top2Total = rankedRevenue[0].totalContractValue + rankedRevenue[1].totalContractValue;
    const pct = round1((top2Total / totalRevenue) * 100);
    insights.push({
      icon: DollarSign,
      headline: `Top 2 clients represent ${pct}% of total contract value`,
      detail: `${rankedRevenue[0].name} and ${rankedRevenue[1].name} are the largest contracts on record.`,
      type: pct > 50 ? "warning" : "neutral",
      metric: `${pct}%`,
    });
  }

  return insights.slice(0, 7);
}

function round1AvgOf(items: { avgSatisfaction: number | null }[]): number | null {
  const values = items.map((i) => i.avgSatisfaction).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return round1(values.reduce((sum, v) => sum + v, 0) / values.length);
}

// ---------------------------------------------------------------------------
// Client insights
// ---------------------------------------------------------------------------

export function generateClientInsights(client: ClientComparisonRow, data: ClientDetailIntelligence): InsightCard[] {
  const insights: InsightCard[] = [];

  // Dip-and-recovery pattern (e.g. Qatar Airways' 2020-2021 COVID dip).
  // A partial "current" year (the dataset's most recent year, still in
  // progress) is excluded from the "recovered to" endpoint — a handful of
  // early responses there is too noisy to read as the recovery point, and
  // since 2020 itself is the first year on record there's no earlier
  // baseline to "drop from" — so this looks for the low point sitting in
  // the earlier half of the trend, followed by sustained improvement,
  // rather than requiring a literal year-over-year drop into it.
  const fullYears = data.yearlyTrend.filter((y) => y.avgSatisfaction !== null && !y.isPartialCurrentYear);
  if (fullYears.length >= 3) {
    const minEntry = fullYears.reduce((min, y) => ((y.avgSatisfaction as number) < (min.avgSatisfaction as number) ? y : min));
    const minIndex = fullYears.indexOf(minEntry);
    const latest = fullYears[fullYears.length - 1];
    const recovered = (latest.avgSatisfaction as number) - (minEntry.avgSatisfaction as number);

    if (minIndex <= Math.floor(fullYears.length / 2) && minIndex < fullYears.length - 1 && recovered > 0.2) {
      insights.push({
        icon: TrendingUp,
        headline: `${client.name} satisfaction was as low as ${minEntry.avgSatisfaction} in ${minEntry.year} and has since recovered to ${latest.avgSatisfaction}`,
        detail: `Lowest point was ${minEntry.avgSatisfaction} in ${minEntry.year}; now at ${latest.avgSatisfaction} as of ${latest.year}.`,
        type: "positive",
        metric: `${latest.avgSatisfaction}`,
      });
    }
  }

  // Coaching vs. workshop opportunity.
  if (
    data.coachingAvgSatisfaction !== null &&
    data.workshopAvgSatisfaction !== null &&
    data.coachingAvgSatisfaction - data.workshopAvgSatisfaction > 0.3
  ) {
    const gap = round1(data.coachingAvgSatisfaction - data.workshopAvgSatisfaction);
    insights.push({
      icon: TrendingUp,
      headline: `${client.name} coaching programs (${data.coachingAvgSatisfaction} avg) outperform their workshops (${data.workshopAvgSatisfaction} avg) by ${gap} points`,
      detail: "An opportunity to propose more coaching engagements to this client.",
      type: "positive",
      metric: `+${gap}`,
    });
  }

  // Seasonal concentration.
  const topQuarter = [...data.quarterlyDistribution].sort((a, b) => b.pct - a.pct)[0];
  if (topQuarter && topQuarter.pct > 30) {
    const quarterLabel = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"][topQuarter.quarter - 1];
    insights.push({
      icon: Calendar,
      headline: `${client.name} delivery is concentrated in Q${topQuarter.quarter} — ${topQuarter.pct}% of experiences in ${quarterLabel}`,
      detail: "Useful for capacity and facilitator-availability planning ahead of that window.",
      type: "neutral",
      metric: `${topQuarter.pct}%`,
    });
  }

  // Below portfolio average.
  if (data.overallAvgSatisfaction !== null && data.portfolioAvgSatisfaction !== null) {
    const gap = data.portfolioAvgSatisfaction - data.overallAvgSatisfaction;
    if (gap > 0.5) {
      const pctBelow = data.portfolioAvgSatisfaction > 0 ? round1((gap / data.portfolioAvgSatisfaction) * 100) : 0;
      insights.push({
        icon: TrendingDown,
        headline: `${client.name} programs are ${pctBelow}% below the portfolio average on satisfaction`,
        detail: `${data.overallAvgSatisfaction} avg for this client vs ${data.portfolioAvgSatisfaction} portfolio-wide.`,
        type: "warning",
        metric: `-${round1(gap)}`,
      });
    }
  }

  // Facilitator concentration risk.
  const topFacilitator = data.facilitatorAffinity[0];
  if (topFacilitator && topFacilitator.shareOfClientExperiences > 40) {
    insights.push({
      icon: UserCheck,
      headline: `${topFacilitator.name} delivers ${topFacilitator.shareOfClientExperiences}% of ${client.name}'s programs`,
      detail: "A single facilitator carrying this much of the relationship is a concentration risk if they become unavailable.",
      type: "warning",
      metric: `${topFacilitator.shareOfClientExperiences}%`,
    });
  }

  // No recent activity — a dormant client with a strong historical track
  // record (avg satisfaction >4.0) is framed as a re-engagement opportunity
  // rather than a plain risk warning; a dormant client without that track
  // record just gets the risk warning.
  if (data.lastActiveDate) {
    const monthsGap = (Date.now() - new Date(data.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    const lastActiveLabel = new Date(data.lastActiveDate).toLocaleDateString("en-US", { month: "long", year: "numeric" });

    if (monthsGap >= 9 && data.overallAvgSatisfaction !== null && data.overallAvgSatisfaction > 4.0) {
      insights.push({
        icon: Sparkles,
        headline: `Re-engagement opportunity: ${client.name} averaged ${data.overallAvgSatisfaction} satisfaction across ${client.totalExperiences} experiences`,
        detail: `No activity recorded for ${Math.round(monthsGap)} months (last active ${lastActiveLabel}). Similar strong-performing clients historically returned within 9–12 months.`,
        type: "positive",
        metric: `${Math.round(monthsGap)}mo`,
      });
    } else if (monthsGap >= 12) {
      insights.push({
        icon: Calendar,
        headline: `No experience delivered for ${client.name} in over 12 months`,
        detail: `Last activity was ${lastActiveLabel}.`,
        type: "warning",
        metric: `${Math.round(monthsGap)}mo`,
      });
    }
  }

  return insights.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Facilitator insights
// ---------------------------------------------------------------------------

export function generateFacilitatorInsights(facilitator: FacilitatorComparisonRow, data: FacilitatorDetailIntelligence): InsightCard[] {
  const insights: InsightCard[] = [];

  // Client concentration risk.
  const topClient = data.clientPortfolio[0];
  if (topClient && topClient.clientTotalExperiences > 0) {
    const shareOfClient = round1((topClient.experienceCount / topClient.clientTotalExperiences) * 100);
    if (shareOfClient > 40) {
      insights.push({
        icon: UserCheck,
        headline: `${facilitator.name} delivers ${shareOfClient}% of ${topClient.clientName}'s programs — high concentration risk`,
        detail: "Consider cross-training a second facilitator on this account.",
        type: "warning",
        metric: `${shareOfClient}%`,
      });
    }
  }

  // Concentration risk by service line — distinct from the per-client
  // concentration check above: this looks at what share of the WHOLE
  // portfolio's delivery of one service line rests on this one facilitator.
  const topServiceLine = [...data.serviceLineConcentration].sort((a, b) => b.sharePct - a.sharePct)[0];
  if (topServiceLine && topServiceLine.sharePct > 35) {
    insights.push({
      icon: Gauge,
      headline: `High concentration — ${facilitator.name} delivers ${topServiceLine.sharePct}% of ${topServiceLine.label.toLowerCase()} programs`,
      detail: "Consider developing backup facilitators for this service line.",
      type: "warning",
      metric: `${topServiceLine.sharePct}%`,
    });
  }

  // Consistently above portfolio average.
  if (data.benchmarking.facilitatorAvg !== null && data.benchmarking.portfolioAvg !== null) {
    const gap = round1(data.benchmarking.facilitatorAvg - data.benchmarking.portfolioAvg);
    if (gap > 0.2) {
      insights.push({
        icon: Award,
        headline: `${facilitator.name}'s satisfaction scores are ${gap} points above portfolio average`,
        detail:
          data.benchmarking.percentile !== null
            ? `Ranks in the ${data.benchmarking.percentile}th percentile among all facilitators.`
            : "Consistently strong performer.",
        type: "positive",
        metric: `+${gap}`,
      });
    } else if (gap < -0.3) {
      insights.push({
        icon: TrendingDown,
        headline: `${facilitator.name}'s satisfaction scores are ${Math.abs(gap)} points below portfolio average`,
        detail: "Worth reviewing recent delivery feedback with this facilitator.",
        type: "warning",
        metric: `${gap}`,
      });
    }
  }

  // Type-performance gap.
  const byType = new Map(data.typePerformance.map((t) => [t.type, t]));
  const workshop = byType.get("workshop");
  const coaching = byType.get("coaching");
  if (workshop?.avgSatisfaction !== null && workshop?.avgSatisfaction !== undefined && coaching?.avgSatisfaction !== null && coaching?.avgSatisfaction !== undefined) {
    const gap = round1(coaching.avgSatisfaction - workshop.avgSatisfaction);
    if (Math.abs(gap) > 0.3) {
      const stronger = gap > 0 ? "coaching" : "workshop";
      insights.push({
        icon: TrendingUp,
        headline: `${facilitator.name}'s ${stronger} satisfaction (${gap > 0 ? coaching.avgSatisfaction : workshop.avgSatisfaction}) significantly exceeds their ${stronger === "coaching" ? "workshop" : "coaching"} scores (${gap > 0 ? workshop.avgSatisfaction : coaching.avgSatisfaction})`,
        detail: `A ${Math.abs(gap)}-point gap between the two formats.`,
        type: "positive",
        metric: `${gap > 0 ? "+" : ""}${gap}`,
      });
    }
  }

  // Volume trend — skips any transition into the current in-progress year,
  // since its year-to-date count is never comparable to a prior full year.
  const growthRates: number[] = [];
  for (let i = 1; i < data.yearlyTrend.length; i++) {
    if (data.yearlyTrend[i].isPartialCurrentYear) continue;
    const prior = data.yearlyTrend[i - 1].experiences;
    const current = data.yearlyTrend[i].experiences;
    if (prior > 0) growthRates.push(((current - prior) / prior) * 100);
  }
  if (growthRates.length > 0) {
    const avgGrowth = round1(growthRates.reduce((sum, v) => sum + v, 0) / growthRates.length);
    if (Math.abs(avgGrowth) > 20) {
      insights.push({
        icon: avgGrowth > 0 ? TrendingUp : Snowflake,
        headline: `${facilitator.name}'s delivery volume has ${avgGrowth > 0 ? "grown" : "declined"} ${Math.abs(avgGrowth)}% year-over-year on average`,
        detail: avgGrowth > 0 ? "An increasingly relied-upon facilitator." : "Worth checking in on availability or fit.",
        type: avgGrowth > 0 ? "positive" : "warning",
        metric: `${avgGrowth > 0 ? "+" : ""}${avgGrowth}%`,
      });
    }
  }

  // Client affinity — a client this facilitator notably over-performs with,
  // relative to their own overall average (requires at least 2 shared
  // experiences to rule out a single lucky session).
  if (data.benchmarking.facilitatorAvg !== null) {
    const strongestPairing = [...data.clientPortfolio]
      .filter((c) => c.experienceCount >= 2 && c.avgSatisfaction !== null)
      .sort((a, b) => (b.avgSatisfaction as number) - (a.avgSatisfaction as number))[0];
    if (strongestPairing) {
      const affinityGap = round1((strongestPairing.avgSatisfaction as number) - data.benchmarking.facilitatorAvg);
      if (affinityGap > 0.3) {
        insights.push({
          icon: Award,
          headline: `${facilitator.name} consistently performs ${affinityGap} points above their average when working with ${strongestPairing.clientName}`,
          detail: `${strongestPairing.avgSatisfaction} avg across ${strongestPairing.experienceCount} experiences with this client, vs ${data.benchmarking.facilitatorAvg} overall.`,
          type: "positive",
          metric: `+${affinityGap}`,
        });
      }
    }
  }

  // Consistency — pairs the std-dev-based label with sample size, since a
  // high average from very few experiences is weaker evidence than the same
  // average from many.
  if (data.consistency.stdDev !== null && data.consistency.label) {
    if (data.consistency.sampleSize < 10) {
      insights.push({
        icon: Activity,
        headline: `Only ${data.consistency.sampleSize} experiences with survey data on record for ${facilitator.name}`,
        detail: "Their satisfaction average is directional, not yet strong evidence — more deliveries will sharpen the picture.",
        type: "neutral",
        metric: `n=${data.consistency.sampleSize}`,
      });
    } else if (data.consistency.label === "Highly Consistent" || data.consistency.label === "Consistent") {
      insights.push({
        icon: Gauge,
        headline: `${facilitator.name} delivers reliably consistent results (${data.consistency.label.toLowerCase()}, std dev ${data.consistency.stdDev})`,
        detail: `Based on ${data.consistency.sampleSize} experiences — a low-variance track record is stronger evidence than a high average from few deliveries.`,
        type: "positive",
        metric: `σ${data.consistency.stdDev}`,
      });
    } else {
      insights.push({
        icon: TrendingDown,
        headline: `${facilitator.name}'s satisfaction scores vary noticeably session to session (${data.consistency.label.toLowerCase()}, std dev ${data.consistency.stdDev})`,
        detail: `Based on ${data.consistency.sampleSize} experiences — worth understanding what drives the stronger and weaker sessions.`,
        type: "warning",
        metric: `σ${data.consistency.stdDev}`,
      });
    }
  }

  return insights.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Portfolio insights
// ---------------------------------------------------------------------------

export function generatePortfolioInsights(data: PortfolioIntelligence): InsightCard[] {
  const insights: InsightCard[] = [];

  // Portfolio shift detection — any service line that moved >10 percentage
  // points between the earlier and later half of the years on record.
  const biggestShift = [...data.serviceLineShifts].sort((a, b) => Math.abs(b.deltaPp) - Math.abs(a.deltaPp))[0];
  if (biggestShift && Math.abs(biggestShift.deltaPp) > 10) {
    const direction = biggestShift.deltaPp > 0 ? "growing" : "declining";
    insights.push({
      icon: biggestShift.deltaPp > 0 ? TrendingUp : TrendingDown,
      headline: `${biggestShift.label} represented ${biggestShift.earlyPct}% of delivery in earlier years but ${biggestShift.latePct}% in recent years — ${direction} service line`,
      detail: `A shift of ${Math.abs(biggestShift.deltaPp)} percentage points across the period on record.`,
      type: biggestShift.deltaPp > 0 ? "positive" : "neutral",
      metric: `${biggestShift.deltaPp > 0 ? "+" : ""}${biggestShift.deltaPp}pp`,
    });
  }

  // Topic concentration — titles containing "Leadership" as the example
  // theme cluster called out in the brief.
  const leadershipTitles = data.topTitles.filter((t) => t.title.toLowerCase().includes("leadership"));
  if (leadershipTitles.length > 0 && data.totalExperiences > 0 && data.portfolioAvgSatisfaction !== null) {
    const count = leadershipTitles.reduce((sum, t) => sum + t.count, 0);
    const pct = round1((count / data.totalExperiences) * 100);
    const withSatisfaction = leadershipTitles.filter((t) => t.avgSatisfaction !== null);
    const avg =
      withSatisfaction.length > 0
        ? round1(withSatisfaction.reduce((sum, t) => sum + (t.avgSatisfaction as number) * t.count, 0) / withSatisfaction.reduce((sum, t) => sum + t.count, 0))
        : null;
    if (pct > 5 && avg !== null) {
      const gap = round1(avg - data.portfolioAvgSatisfaction);
      insights.push({
        icon: Award,
        headline: `Leadership programs represent ${pct}% of all delivery${gap > 0 ? ` and outperform the portfolio average by ${gap} points` : ""}`,
        detail: `${avg} avg satisfaction across ${count} experiences, vs ${data.portfolioAvgSatisfaction} portfolio-wide.`,
        type: gap > 0 ? "positive" : "neutral",
        metric: `${pct}%`,
      });
    }
  }

  // Geographic shift.
  if (data.geographyThisYearTop && data.geographyLastYearTop && data.geographyThisYearTop !== data.geographyLastYearTop) {
    insights.push({
      icon: Globe2,
      headline: `Most-active market shifted from ${data.geographyLastYearTop} to ${data.geographyThisYearTop}`,
      detail: "Worth checking whether this reflects a deliberate regional push or a one-off client mix.",
      type: "neutral",
      metric: data.geographyThisYearTop,
    });
  }

  // Government vs. corporate satisfaction gap.
  const corporate = data.sectorMix.find((s) => s.type === "corporate");
  const government = data.sectorMix.find((s) => s.type === "government");
  if (corporate?.avgSatisfaction !== null && corporate?.avgSatisfaction !== undefined && government?.avgSatisfaction !== null && government?.avgSatisfaction !== undefined) {
    const gap = round1(corporate.avgSatisfaction - government.avgSatisfaction);
    if (gap > 0.3) {
      insights.push({
        icon: Landmark,
        headline: `Government sector satisfaction (${government.avgSatisfaction}) is significantly below corporate (${corporate.avgSatisfaction})`,
        detail: `A ${gap}-point gap across ${government.count} government experiences on record.`,
        type: "warning",
        metric: `-${gap}`,
      });
    }
  }

  // Revenue concentration.
  if (data.revenueByClient.length >= 2 && data.revenueConcentrationTop2Pct !== null) {
    insights.push({
      icon: DollarSign,
      headline: `Top 2 clients represent ${data.revenueConcentrationTop2Pct}% of total contract value`,
      detail: `${data.revenueByClient[0].clientName} and ${data.revenueByClient[1].clientName} are the largest contracts on record.`,
      type: data.revenueConcentrationTop2Pct > 50 ? "warning" : "neutral",
      metric: `${data.revenueConcentrationTop2Pct}%`,
    });
  }

  return insights.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Satisfaction Intelligence insights
// ---------------------------------------------------------------------------

export function generateSatisfactionInsights(data: SatisfactionIntelligence): InsightCard[] {
  const insights: InsightCard[] = [];

  const highlyConsistent = data.varianceDistribution.find((v) => v.label === "Highly Consistent");
  if (highlyConsistent && data.varianceSampleSize > 0) {
    insights.push({
      icon: Gauge,
      headline: `${highlyConsistent.pct}% of experiences deliver consistent results (std dev <0.5)`,
      detail: `Based on ${data.varianceSampleSize} experiences with enough individual responses to measure agreement.`,
      type: highlyConsistent.pct >= 60 ? "positive" : "neutral",
      metric: `${highlyConsistent.pct}%`,
    });
  }

  if (data.lowestDimension) {
    const isLogistics = data.lowestDimension.dimension === "logistics";
    insights.push({
      icon: ClipboardCheck,
      headline: `${data.lowestDimension.label} consistently scores ${data.lowestDimension.gapFromHighest} points below the highest-rated dimension`,
      detail: isLogistics
        ? "Operational preparation may need attention — venue, materials, and scheduling logistics."
        : `${data.lowestDimension.label} is the portfolio's weakest dimension at ${data.lowestDimension.avg} avg.`,
      type: "warning",
      metric: `-${data.lowestDimension.gapFromHighest}`,
    });
  }

  if (data.outliers.length > 0) {
    insights.push({
      icon: TrendingDown,
      headline: `${data.outliers.length} experience${data.outliers.length === 1 ? "" : "s"} scored more than 1 point below the portfolio average`,
      detail: `Worth reviewing individually — starting with ${data.outliers[0].title} (${data.outliers[0].avgSatisfaction} avg, ${data.outliers[0].deltaFromPortfolioAvg} below average).`,
      type: "warning",
      metric: `${data.outliers.length}`,
    });
  }

  return insights.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Operational Efficiency insights
// ---------------------------------------------------------------------------

const EFFICIENCY_SUGGESTIONS: Record<string, string> = {
  survey_response_rate: "Consider sending reminder emails earlier.",
  check_in_rate: "Consider confirming attendance closer to the event date.",
  certificate_issuance_rate: "Consider automating certificate issuance on completion.",
  materials_readiness: "Consider setting a materials-ready deadline ahead of each delivery.",
  logistics_completion_rate: "Consider assigning logistics owners with earlier due dates.",
};

export function generateOperationalInsights(data: OperationalEfficiency): InsightCard[] {
  const metrics = [data.surveyResponseRate, data.checkInRate, data.certificateIssuanceRate, data.materialsReadiness, data.logisticsCompletionRate];

  return metrics
    .filter((m) => m.pct !== null && m.benchmark === "needs_attention")
    .sort((a, b) => (a.pct as number) - (b.pct as number))
    .map((m) => ({
      icon: Gauge,
      headline: `${m.label} is ${m.pct}% — ${round1(80 - (m.pct as number))} points below the 80% benchmark`,
      detail: EFFICIENCY_SUGGESTIONS[m.key] ?? "Worth investigating the cause.",
      type: "warning" as const,
      metric: `${m.pct}%`,
    }))
    .slice(0, 5);
}
