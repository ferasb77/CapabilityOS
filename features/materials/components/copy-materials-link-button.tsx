"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createOrGetMaterialToken } from "../actions";

type Props = {
  experienceId: string;
  participants: { id: string; fullName: string }[];
};

export function CopyMaterialsLinkButton({ experienceId, participants }: Props) {
  const [participantId, setParticipantId] = useState(participants[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCopy() {
    if (!participantId) {
      return;
    }
    setError(null);
    setCopied(false);

    startTransition(async () => {
      const token = await createOrGetMaterialToken(participantId, experienceId);
      if (!token) {
        setError("Unable to create a materials link.");
        return;
      }

      const url = `${window.location.origin}/materials/${token}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setError("Unable to copy to clipboard.");
      }
    });
  }

  if (participants.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={participantId} onValueChange={(value) => value && setParticipantId(value)} items={participants.map((p) => ({ value: p.id, label: p.fullName }))}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Choose participant" />
        </SelectTrigger>
        <SelectContent>
          {participants.map((participant) => (
            <SelectItem key={participant.id} value={participant.id}>
              {participant.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" onClick={handleCopy} disabled={isPending || !participantId}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {isPending ? "Copying..." : copied ? "Copied" : "Copy Materials Link"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
