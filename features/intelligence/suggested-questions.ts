import type { AssistantContext } from "./assistant-context";

// ---------------------------------------------------------------------------
// Pure, deterministic — no AI call. Reads only the already-assembled
// AssistantContext and decides which starter questions are worth surfacing,
// same "evidence, not invention" spirit as insights.ts. Always caps at 4:
// 3 signal-driven questions (highest severity first) plus the one always-on
// question, so the chip row never grows unbounded as more signals fire.
// ---------------------------------------------------------------------------

const ALWAYS_INCLUDED_QUESTION = "What am I not noticing about our operations?";

export function generateSuggestedQuestions(context: AssistantContext): string[] {
  const candidates: string[] = [];

  if (context.clients.some((c) => c.healthStatus === "at_risk")) {
    candidates.push("Which clients should I be concerned about?");
  }

  if (context.facilitators.some((f) => f.concentrationRisks.length > 0)) {
    candidates.push("Are there facilitator risks I should know about?");
  }

  if (context.seasonality.q4VsQ2Ratio !== null && context.seasonality.q4VsQ2Ratio > 2) {
    candidates.push("How should we prepare for Q4 demand?");
  }

  if (context.clients.some((c) => c.monthsSinceLastActivity !== null && c.monthsSinceLastActivity > 12 && (c.avgSatisfaction ?? 0) > 4.0)) {
    candidates.push("Which clients are overdue for re-engagement?");
  }

  if (context.satisfactionIntelligence.lowestDimension) {
    candidates.push(`Why is ${context.satisfactionIntelligence.lowestDimension} scoring below our other dimensions?`);
  }

  const questions = [...candidates.slice(0, 3), ALWAYS_INCLUDED_QUESTION];
  return [...new Set(questions)].slice(0, 4);
}
