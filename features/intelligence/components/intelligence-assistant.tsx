"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { askIntelligenceAssistant, type ConversationMessage } from "../actions";

type ChatMessage = ConversationMessage & { id: string };

const VISIBLE_EXCHANGES = 5;
const ERROR_FALLBACK = "I'm unable to process your question right now. Please try again in a moment.";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

/** Splits an assistant answer into its main body and the trailing
 * "You might also ask:" follow-up questions, so the two can be rendered as
 * separate UI (prose vs. clickable chips) instead of one undifferentiated
 * block of text. */
function splitFollowUps(answer: string): { body: string; followUps: string[] } {
  const marker = /you might also ask:?/i;
  const match = answer.match(marker);
  if (!match || match.index === undefined) {
    return { body: answer, followUps: [] };
  }

  const body = answer.slice(0, match.index).trim();
  const tail = answer.slice(match.index + match[0].length);
  const followUps = tail
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  return { body, followUps };
}

/** Minimal markdown: **bold** inline, and lines starting with "-"/"*"
 * rendered as a bullet list. Enough for the assistant's response format
 * (headline, supporting numbers, caveats) without pulling in a markdown
 * dependency for a handful of tags. */
function FormattedAnswer({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");

  function renderInline(line: string) {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return parts.map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold text-ivory">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed text-ivory">
      {lines.map((line, i) => {
        const isBullet = /^[-*]\s+/.test(line);
        if (isBullet) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-gold">•</span>
              <span>{renderInline(line.replace(/^[-*]\s+/, ""))}</span>
            </div>
          );
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function QuestionChip({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-border-subtle bg-night/40 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold disabled:pointer-events-none disabled:opacity-50"
    >
      {label}
    </button>
  );
}

type Props = {
  workspaceId: string;
  suggestedQuestions: string[];
  yearsOfData: number;
};

export function IntelligenceAssistant({ workspaceId, suggestedQuestions, yearsOfData }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isPending]);

  function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isPending) return;

    setError(null);
    setLastFailedQuestion(null);
    setInput("");

    const history: ConversationMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
    const userMessage: ChatMessage = { id: newId(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);

    startTransition(async () => {
      const result = await askIntelligenceAssistant(trimmed, history, workspaceId);

      if (result.success) {
        setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: result.answer }]);
      } else {
        setError(result.error ?? ERROR_FALLBACK);
        setLastFailedQuestion(trimmed);
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuestion(input);
  }

  function handleClear() {
    setMessages([]);
    setInput("");
    setError(null);
    setLastFailedQuestion(null);
  }

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const followUps = lastAssistantMessage ? splitFollowUps(lastAssistantMessage.content).followUps : [];
  const visibleMessages = messages.slice(-VISIBLE_EXCHANGES * 2);
  const hasConversation = messages.length > 0;

  return (
    <div className="space-y-4">
      {!hasConversation && (
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((q) => (
            <QuestionChip key={q} label={q} onClick={() => submitQuestion(q)} disabled={isPending} />
          ))}
        </div>
      )}

      {hasConversation && (
        <div ref={scrollRef} className="max-h-[28rem] space-y-4 overflow-y-auto rounded-lg border border-border-subtle bg-night/30 p-4">
          {visibleMessages.map((m) => {
            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg bg-primary/10 px-3 py-2 text-sm text-ivory">{m.content}</div>
                </div>
              );
            }
            const { body } = splitFollowUps(m.content);
            return (
              <div key={m.id} className="max-w-[90%] space-y-2">
                <FormattedAnswer text={body} />
                <p className="text-xs text-gold/80">Based on {yearsOfData} years of operational data</p>
              </div>
            );
          })}

          {isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex gap-1">
                <span className="size-1.5 animate-pulse rounded-full bg-gold [animation-delay:0ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-gold [animation-delay:150ms]" />
                <span className="size-1.5 animate-pulse rounded-full bg-gold [animation-delay:300ms]" />
              </span>
              CapabilityOS is analyzing your data...
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          {lastFailedQuestion && (
            <button type="button" className="shrink-0 font-medium underline underline-offset-2" onClick={() => submitQuestion(lastFailedQuestion)}>
              Retry
            </button>
          )}
        </div>
      )}

      {hasConversation && followUps.length > 0 && !isPending && (
        <div className="flex flex-wrap gap-2">
          {followUps.map((q) => (
            <QuestionChip key={q} label={q} onClick={() => submitQuestion(q)} disabled={isPending} />
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your organization..."
          disabled={isPending}
          className="flex-1"
        />
        <Button type="submit" disabled={isPending || !input.trim()} className={cn("shrink-0")}>
          <Send className="size-4" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>

      {hasConversation && (
        <button type="button" onClick={handleClear} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-ivory">
          Clear conversation
        </button>
      )}

      {!hasConversation && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3 text-gold" />
          Answers are grounded in your operational data — the assistant will say so when it&apos;s inferring rather than citing a fact.
        </p>
      )}
    </div>
  );
}
