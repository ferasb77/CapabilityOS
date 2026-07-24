"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { sendMaterialsLink, type SendMaterialsLinkResult } from "../actions";

type Props = {
  experienceId: string;
  experienceSlug: string;
  participantCount: number;
};

export function SendMaterialsLinkButton({ experienceId, experienceSlug, participantCount }: Props) {
  const [result, setResult] = useState<SendMaterialsLinkResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const outcome = await sendMaterialsLink(experienceId, experienceSlug);
      setResult(outcome);
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" disabled={isPending || participantCount === 0} onClick={handleClick}>
        {isPending ? "Sending..." : "Send Materials Link to All"}
      </Button>
      {result?.success && <p className="text-xs text-muted-foreground">Sent to {result.sent} participant{result.sent === 1 ? "" : "s"}.</p>}
      {result && !result.success && <p className="text-xs text-destructive">{result.error}</p>}
    </div>
  );
}
