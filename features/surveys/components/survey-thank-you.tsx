import { CircleCheck } from "lucide-react";

export function SurveyThankYou() {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <CircleCheck className="mb-6 size-16 text-gold" strokeWidth={1.5} />
      <h1 className="font-heading text-2xl font-semibold text-ivory sm:text-3xl">
        Thank you for your feedback
      </h1>
      <p className="mt-4 max-w-sm text-sm text-muted-foreground">
        Your response has been recorded. We appreciate you taking the time to help us improve.
      </p>
      <p className="mt-10 text-xs tracking-[0.3em] text-gold/70 uppercase">Enable My Growth</p>
    </div>
  );
}
