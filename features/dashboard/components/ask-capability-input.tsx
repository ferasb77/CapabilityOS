"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AskCapabilityInput() {
  const router = useRouter();
  const [question, setQuestion] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    router.push(`/dashboard/intelligence/ask?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="What should I be paying attention to this week?"
        className="flex-1"
      />
      <Button type="submit" disabled={!question.trim()} className="shrink-0">
        <Send className="size-4" />
        <span className="hidden sm:inline">Ask</span>
      </Button>
    </form>
  );
}
