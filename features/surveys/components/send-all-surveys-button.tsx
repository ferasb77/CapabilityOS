"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import { sendSurveyToAllParticipants, type SendSurveyResult } from "../actions";

const initialState: SendSurveyResult = { success: true, sent: 0, skipped: 0, failed: 0, errors: [] };

function TriggerButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Sending..." : "Send All"}
    </Button>
  );
}

type Props = {
  workshopId: string;
  workshopSlug: string;
  workshopTitle: string;
  unsentCount: number;
};

export function SendAllSurveysButton({ workshopId, workshopSlug, workshopTitle, unsentCount }: Props) {
  const [state, action] = useActionState(sendSurveyToAllParticipants, initialState);

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="workshopId" value={workshopId} />
        <input type="hidden" name="workshopSlug" value={workshopSlug} />
        <input type="hidden" name="workshopTitle" value={workshopTitle} />
        <TriggerButton disabled={unsentCount === 0} />
      </form>

      {state.success && state.sent > 0 && (
        <p className="text-xs text-muted-foreground">
          Sent to {state.sent} participant{state.sent === 1 ? "" : "s"}.
        </p>
      )}
      {state.success && state.failed > 0 && (
        <p className="text-xs text-destructive">{state.failed} failed to send.</p>
      )}
      {!state.success && <p className="max-w-56 text-right text-xs text-destructive">{state.error}</p>}
    </div>
  );
}
