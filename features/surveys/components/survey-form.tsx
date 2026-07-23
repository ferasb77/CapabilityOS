"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { submitSurveyResponse, type SubmitSurveyResult } from "../actions";
import { StarRating } from "./star-rating";
import { SurveyThankYou } from "./survey-thank-you";

const initialState: SubmitSurveyResult = { success: false, error: "" };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} size="lg" className="w-full">
      {pending ? "Submitting..." : "Submit Feedback"}
    </Button>
  );
}

type Props = {
  token: string;
  participantFirstName: string;
  workshopTitle: string;
};

export function SurveyForm({ token, participantFirstName, workshopTitle }: Props) {
  const [state, action] = useActionState(submitSurveyResponse, initialState);

  if (state.success) {
    return <SurveyThankYou />;
  }

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="token" value={token} />

      <div>
        <h1 className="font-heading text-2xl font-semibold text-ivory sm:text-3xl">
          Hi {participantFirstName}, thank you for attending {workshopTitle}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your feedback takes two minutes and helps us improve every future workshop.
        </p>
      </div>

      <div className="space-y-6">
        <StarRating name="contentRating" label="How would you rate the workshop content?" />
        <StarRating name="facilitatorRating" label="How would you rate the facilitator's delivery?" />
        <StarRating name="logisticsRating" label="How would you rate the logistics and organisation?" />
        <StarRating name="overallRating" label="Overall, how would you rate this workshop?" />
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="highlights">What did you find most valuable?</Label>
          <Textarea id="highlights" name="highlights" required rows={3} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="improvements">What could be improved?</Label>
          <Textarea id="improvements" name="improvements" required rows={3} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="additionalComments">Any other comments? (optional)</Label>
          <Textarea id="additionalComments" name="additionalComments" rows={3} />
        </div>
      </div>

      {!state.success && state.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
          {state.error}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
