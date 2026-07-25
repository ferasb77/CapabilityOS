import { getSessionContext } from "@/infrastructure/session/session-context";

import {
  getClientDetailIntelligence,
  getClientIntelligence,
  getFacilitatorDetailIntelligence,
  getFacilitatorIntelligence,
  getOperationalEfficiency,
  getOrganizationIntelligence,
  getPortfolioIntelligence,
  getSatisfactionIntelligence,
  type ClientComparisonRow,
  type ClientDetailIntelligence,
  type FacilitatorComparisonRow,
  type FacilitatorDetailIntelligence,
} from "./data";
import {
  generateClientInsights,
  generateFacilitatorInsights,
  generateOperationalInsights,
  generateOpportunityInsights,
  generateOrgInsights,
  generatePortfolioInsights,
  generateSatisfactionInsights,
  type InsightCard,
  type InsightType,
} from "./insights";

// ---------------------------------------------------------------------------
// Layer 3 (Assistant) context object — assembled server-side from the
// deterministic Layer 1 (analytics, data.ts) and Layer 2 (insights,
// insights.ts) outputs only. Nothing in this module queries the database
// directly; every field here traces back to an already-computed,
// already-verified intelligence value. This is what makes it safe to hand to
// an LLM — every fact it can cite was true before the AI ever saw it.
// ---------------------------------------------------------------------------

export type AssistantOrganizationSummary = {
  name: string;
  totalExperiences: number;
  totalParticipants: number;
  totalRevenue: number;
  yearsOfData: number;
  portfolioAvgSatisfaction: number | null;
  /** Clients on record with zero delivery history — not yet active, and
   * therefore excluded from `clients` and from any risk/concern analysis.
   * See CLAUDE.md's Intelligence Assistant Rule. */
  inactiveClients: number;
};

export type AssistantYearlyTrend = {
  year: number;
  experiences: number;
  participants: number;
  avgSatisfaction: number | null;
  revenue: number;
};

export type AssistantClientHealthStatus = "healthy" | "monitor" | "at_risk";
export type AssistantSatisfactionTrend = "improving" | "stable" | "declining";

export type AssistantClientSummary = {
  name: string;
  type: string;
  totalExperiences: number;
  totalParticipants: number;
  avgSatisfaction: number | null;
  totalRevenue: number;
  lastActivityDate: string | null;
  monthsSinceLastActivity: number | null;
  healthStatus: AssistantClientHealthStatus;
  satisfactionTrend: AssistantSatisfactionTrend;
  serviceTypes: string[];
};

export type AssistantFacilitatorSummary = {
  name: string;
  totalExperiences: number;
  avgSatisfaction: number | null;
  consistencyLabel: string;
  topClients: string[];
  concentrationRisks: string[];
  availabilityStatus: string;
};

export type AssistantInsight = { headline: string; detail: string; type: InsightType };

export type AssistantSeasonality = {
  peakMonths: string[];
  slowestMonths: string[];
  q4VsQ2Ratio: number | null;
};

export type AssistantSatisfactionIntelligence = {
  portfolioAvg: number | null;
  lowestDimension: string | null;
  lowestDimensionAvg: number | null;
  outlierCount: number;
};

export type AssistantOperationalEfficiency = {
  surveyResponseRate: number | null;
  checkInRate: number | null;
};

export type AssistantContext = {
  organization: AssistantOrganizationSummary;
  yearlyTrends: AssistantYearlyTrend[];
  clients: AssistantClientSummary[];
  facilitators: AssistantFacilitatorSummary[];
  insights: AssistantInsight[];
  seasonality: AssistantSeasonality;
  satisfactionIntelligence: AssistantSatisfactionIntelligence;
  operationalEfficiency: AssistantOperationalEfficiency;
  currentDate: string;
  currentYear: number;
  dataYearRange: string;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthsSinceOrNull(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const months = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return Math.round(months);
}

/** Rough token estimate — ~4 characters per token, close enough to police an
 * 8,000-token soft budget without pulling in a real tokenizer for a context
 * object that's just plain JSON. */
function estimateTokens(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}

const MAX_CONTEXT_TOKENS = 8000;

/** Client- and facilitator-level insights (generated per-entity) are the
 * cheapest thing to trim if the assembled context runs over budget — the
 * portfolio-, satisfaction-, and operations-level insights stay untouched
 * since those are the ones most often asked about directly. */
function trimToBudget(context: AssistantContext): AssistantContext {
  let trimmed = context;
  const steps = [24, 16, 10, 6];

  for (const cap of steps) {
    if (estimateTokens(trimmed) <= MAX_CONTEXT_TOKENS) break;
    trimmed = { ...trimmed, insights: trimmed.insights.slice(0, cap) };
  }

  const clientCaps = [30, 20, 12, 8];
  for (const cap of clientCaps) {
    if (estimateTokens(trimmed) <= MAX_CONTEXT_TOKENS) break;
    trimmed = { ...trimmed, clients: trimmed.clients.slice(0, cap), facilitators: trimmed.facilitators.slice(0, cap) };
  }

  return trimmed;
}

function toAssistantInsights(cards: InsightCard[]): AssistantInsight[] {
  return cards.map((c) => ({ headline: c.headline, detail: c.detail, type: c.type }));
}

/** Warnings first — the assistant is asked "what should I be concerned
 * about" far more often than "what's going well," so the most-likely-useful
 * insights should survive if the context ever needs trimming. */
function prioritizeInsights(insights: AssistantInsight[]): AssistantInsight[] {
  const weight: Record<InsightType, number> = { warning: 0, opportunity: 1, question: 1, neutral: 2, positive: 3 };
  return [...insights].sort((a, b) => weight[a.type] - weight[b.type]);
}

function buildClientSummary(row: ClientComparisonRow, detail: ClientDetailIntelligence | null): AssistantClientSummary {
  return {
    name: row.name,
    type: row.type,
    totalExperiences: row.totalExperiences,
    totalParticipants: row.totalParticipants,
    avgSatisfaction: row.avgSatisfaction,
    totalRevenue: row.totalContractValue,
    lastActivityDate: row.lastActiveDate,
    monthsSinceLastActivity: monthsSinceOrNull(row.lastActiveDate),
    healthStatus: detail?.health.risk ?? "monitor",
    satisfactionTrend: row.trend === "up" ? "improving" : row.trend === "down" ? "declining" : "stable",
    serviceTypes: detail?.typeDistribution.filter((t) => t.count > 0).map((t) => t.label) ?? [],
  };
}

function buildFacilitatorSummary(row: FacilitatorComparisonRow, detail: FacilitatorDetailIntelligence | null): AssistantFacilitatorSummary {
  const concentrationRisks: string[] = [];

  const topClient = detail?.clientPortfolio[0];
  if (topClient && topClient.clientTotalExperiences > 0) {
    const share = round1((topClient.experienceCount / topClient.clientTotalExperiences) * 100);
    if (share > 40) {
      concentrationRisks.push(`Delivers ${share}% of ${topClient.clientName}'s programs`);
    }
  }

  for (const line of detail?.serviceLineConcentration ?? []) {
    if (line.sharePct > 35) {
      concentrationRisks.push(`Delivers ${line.sharePct}% of all ${line.label.toLowerCase()} programs portfolio-wide`);
    }
  }

  return {
    name: row.name,
    totalExperiences: row.experiencesDelivered,
    avgSatisfaction: row.avgSatisfaction,
    consistencyLabel: detail?.consistency.label ?? "Unknown",
    topClients: detail?.clientPortfolio.slice(0, 3).map((c) => c.clientName) ?? [],
    concentrationRisks,
    availabilityStatus: detail?.facilitator.availabilityStatus ?? "unknown",
  };
}

export async function buildAssistantContext(workspaceId: string): Promise<AssistantContext> {
  const [session, org, satisfaction, operations, portfolio, clientRows, facilitatorRows] = await Promise.all([
    getSessionContext(),
    getOrganizationIntelligence(workspaceId),
    getSatisfactionIntelligence(workspaceId),
    getOperationalEfficiency(workspaceId),
    getPortfolioIntelligence(workspaceId),
    getClientIntelligence(workspaceId),
    getFacilitatorIntelligence(workspaceId),
  ]);

  const [clientDetails, facilitatorDetails] = await Promise.all([
    Promise.all(clientRows.map((row) => getClientDetailIntelligence(row.id))),
    Promise.all(facilitatorRows.map((row) => getFacilitatorDetailIntelligence(row.id))),
  ]);

  const clientDetailById = new Map(clientDetails.map((d, i) => [clientRows[i].id, d]));
  const facilitatorDetailById = new Map(facilitatorDetails.map((d, i) => [facilitatorRows[i].id, d]));

  // Clients with zero delivery history are not yet active — they cannot be
  // assessed for health and must not appear in risk/concern analyses. See
  // CLAUDE.md's Intelligence Assistant Rule.
  const activeClientRows = clientRows.filter((row) => row.totalExperiences > 0);
  const inactiveClientCount = clientRows.length - activeClientRows.length;

  const clients = activeClientRows.map((row) => buildClientSummary(row, clientDetailById.get(row.id) ?? null));
  const facilitators = facilitatorRows.map((row) => buildFacilitatorSummary(row, facilitatorDetailById.get(row.id) ?? null));

  const entityInsights: InsightCard[] = [];
  for (const row of activeClientRows) {
    const detail = clientDetailById.get(row.id);
    if (detail) entityInsights.push(...generateClientInsights(row, detail));
  }
  for (const row of facilitatorRows) {
    const detail = facilitatorDetailById.get(row.id);
    if (detail) entityInsights.push(...generateFacilitatorInsights(row, detail));
  }

  const clientsWithDetail: { row: ClientComparisonRow; detail: ClientDetailIntelligence }[] = [];
  for (const row of activeClientRows) {
    const detail = clientDetailById.get(row.id);
    if (detail) clientsWithDetail.push({ row, detail });
  }

  const allInsights = toAssistantInsights([
    ...generateOrgInsights(org),
    ...generatePortfolioInsights(portfolio),
    ...generateSatisfactionInsights(satisfaction),
    ...generateOperationalInsights(operations),
    ...generateOpportunityInsights(clientsWithDetail),
    ...entityInsights,
  ]);

  const years = org.yearlyTrend.map((y) => y.year);
  const dataYearRange = years.length > 0 ? `${years[0]}–${years[years.length - 1]}` : "no data";

  const totalParticipants = org.yearlyTrend.reduce((sum, y) => sum + y.participants, 0);

  const seasonalByVolume = [...org.seasonal].sort((a, b) => a.experiences - b.experiences);
  const slowestMonths = seasonalByVolume.filter((m) => m.experiences > 0).slice(0, 2).map((m) => m.monthLabel);

  const q2 = org.quarterlySatisfaction.find((q) => q.quarter === 2);
  const q4 = org.quarterlySatisfaction.find((q) => q.quarter === 4);
  const q4VsQ2Ratio = q2 && q4 && q2.experiences > 0 ? round2(q4.experiences / q2.experiences) : null;

  const context: AssistantContext = {
    organization: {
      name: session.organizationName,
      totalExperiences: org.totalExperiences,
      totalParticipants,
      totalRevenue: portfolio.totalRevenue,
      yearsOfData: years.length,
      portfolioAvgSatisfaction: satisfaction.portfolioAvgSatisfaction,
      inactiveClients: inactiveClientCount,
    },
    yearlyTrends: org.yearlyTrend.map((y) => ({
      year: y.year,
      experiences: y.experiences,
      participants: y.participants,
      avgSatisfaction: y.avgSatisfaction,
      revenue: y.revenue,
    })),
    clients,
    facilitators,
    insights: prioritizeInsights(allInsights),
    seasonality: {
      peakMonths: org.peakMonths,
      slowestMonths,
      q4VsQ2Ratio,
    },
    satisfactionIntelligence: {
      portfolioAvg: satisfaction.portfolioAvgSatisfaction,
      lowestDimension: satisfaction.lowestDimension?.label ?? null,
      lowestDimensionAvg: satisfaction.lowestDimension?.avg ?? null,
      outlierCount: satisfaction.outliers.length,
    },
    operationalEfficiency: {
      surveyResponseRate: operations.surveyResponseRate.pct,
      checkInRate: operations.checkInRate.pct,
    },
    currentDate: new Date().toISOString().slice(0, 10),
    currentYear: org.currentYear,
    dataYearRange,
  };

  return trimToBudget(context);
}
