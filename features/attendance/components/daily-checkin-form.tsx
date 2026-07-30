"use client";

import { useState, useTransition } from "react";

import { recordDailyCheckIn } from "../actions";

const FIELD_CLASS =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-black placeholder:text-slate-400 transition outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

type Props = {
  workshopSlug: string;
  onSwitchToRegister: () => void;
};

export function DailyCheckInForm({ workshopSlug, onSwitchToRegister }: Props) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<
    | { status: "checked_in"; participantName: string; date: string }
    | { status: "already_checked_in"; participantName: string; date: string }
    | { status: "not_registered" }
    | { status: "error"; message: string }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResult(null);

    startTransition(async () => {
      const outcome = await recordDailyCheckIn(workshopSlug, email);
      setResult(outcome);
    });
  }

  if (result?.status === "checked_in") {
    return (
      <div className="space-y-3 text-center">
        <p className="text-3xl">✓</p>
        <h2 className="text-2xl font-bold text-slate-900">
          Attendance recorded for {formatLongDate(result.date)}. Good morning, {result.participantName}!
        </h2>
      </div>
    );
  }

  if (result?.status === "already_checked_in") {
    return (
      <div className="space-y-3 text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          You&apos;ve already checked in today ({formatLongDate(result.date)}). See you tomorrow!
        </h2>
      </div>
    );
  }

  if (result?.status === "not_registered") {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-2xl font-bold text-slate-900">
          We couldn&apos;t find your registration. Please register first.
        </h2>
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-sm font-semibold text-amber-600 underline underline-offset-4 hover:text-amber-700"
        >
          Go to registration form
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back</h2>
        <p className="mt-2 text-sm text-slate-500">Enter your email to check in for today.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="daily-checkin-email" className="text-sm font-medium text-slate-700">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          id="daily-checkin-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          dir="ltr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      {result?.status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">{result.message}</p>
        </div>
      )}

      <button
        disabled={isPending}
        className="mt-4 w-full rounded-xl bg-[#C8A24A] py-4 text-base font-semibold text-[#0B1018] transition-all duration-200 hover:bg-[#D9B765] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Checking In..." : "Check In"}
      </button>
    </form>
  );
}
