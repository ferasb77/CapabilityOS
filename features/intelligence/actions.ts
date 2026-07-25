"use server";

import Anthropic from "@anthropic-ai/sdk";

import { getSessionContext } from "@/infrastructure/session/session-context";

import { buildAssistantContext } from "./assistant-context";
import { buildAssistantSystemPrompt } from "./assistant-prompt";

// ---------------------------------------------------------------------------
// Layer 3 (Assistant) Server Action. The Anthropic API is only ever called
// from here — never from the client — and every call rebuilds the context
// object fresh from Layers 1/2 so the model always reasons over current
// data. See CLAUDE.md's "Intelligence Assistant Rule."
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1000;
const MAX_HISTORY_EXCHANGES = 10;

const GENERIC_ERROR = "I'm unable to process your question right now. Please try again in a moment.";

export type ConversationMessage = { role: "user" | "assistant"; content: string };

export type AskIntelligenceAssistantResult = { success: true; answer: string } | { success: false; error: string };

export async function askIntelligenceAssistant(
  question: string,
  conversationHistory: ConversationMessage[],
  workspaceId: string
): Promise<AskIntelligenceAssistantResult> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    return { success: false, error: "Please enter a question." };
  }

  try {
    const session = await getSessionContext();
    if (session.workspaceId !== workspaceId) {
      console.error("askIntelligenceAssistant: workspace mismatch between session and request");
      return { success: false, error: GENERIC_ERROR };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("askIntelligenceAssistant: ANTHROPIC_API_KEY is not configured");
      return { success: false, error: GENERIC_ERROR };
    }

    const context = await buildAssistantContext(workspaceId);
    const systemPrompt = buildAssistantSystemPrompt(context);

    const recentHistory = conversationHistory.slice(-MAX_HISTORY_EXCHANGES * 2);

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [
        ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: trimmedQuestion },
      ],
    });

    const answer = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("\n")
      .trim();

    if (!answer) {
      return { success: false, error: GENERIC_ERROR };
    }

    return { success: true, answer };
  } catch (error) {
    console.error("askIntelligenceAssistant failed", error);
    return { success: false, error: GENERIC_ERROR };
  }
}
