"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { SurveyStatus } from "@/infrastructure/repositories/surveys";

import { sendSurveyToParticipant, type SendSurveyResult } from "../actions";

const initialState: SendSurveyResult = { success: true, sent: 0, skipped: 0, failed: 0, errors: [] };

function TriggerButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? "Sending..." : label}
    </Button>
  );
}

type Props = {
  participantId: string;
  workshopId: string;
  workshopSlug: string;
  workshopTitle: string;
  status: SurveyStatus;
};

export function SendSurveyButton({
  participantId,
  workshopId,
  workshopSlug,
  workshopTitle,
  status,
}: Props) {
  const [state, action] = useActionState(sendSurveyToParticipant, initialState);

  if (status === "completed") {
    return null;
  }

  const label = status === "not_sent" ? "Send Survey" : "Resend";

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="participantId" value={participantId} />
      <input type="hidden" name="workshopId" value={workshopId} />
      <input type="hidden" name="workshopSlug" value={workshopSlug} />
      <input type="hidden" name="workshopTitle" value={workshopTitle} />
      <TriggerButton label={label} />
      {!state.success && <p className="max-w-40 text-right text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
