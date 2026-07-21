"use client";

import { useActionState } from "react";
import { checkInParticipant } from "../actions";
import { SuccessScreen } from "./success-screen";

const initialState = {
  success: false,
  message: "",
};

export function CheckInForm({
  workshopSlug,
}: {
  workshopSlug: string;
}) {
  const [state, action, pending] = useActionState(
    checkInParticipant,
    initialState
  );

  if (state.success) {
    return <SuccessScreen />;
  }

  return (
    <form action={action} className="space-y-6">
      <input
        type="hidden"
        name="workshopSlug"
        value={workshopSlug}
      />

      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Workshop Check-In
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Please complete the information below.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="firstName"
          className="text-sm font-medium text-slate-700"
        >
          First Name <span className="text-red-500">*</span>
        </label>

        <input
          id="firstName"
          name="firstName"
          autoComplete="given-name"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 transition outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="lastName"
          className="text-sm font-medium text-slate-700"
        >
          Last Name <span className="text-red-500">*</span>
        </label>

        <input
          id="lastName"
          name="lastName"
          autoComplete="family-name"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 transition outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-sm font-medium text-slate-700"
        >
          Email Address <span className="text-red-500">*</span>
        </label>

        <input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 transition outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="mobile"
          className="text-sm font-medium text-slate-700"
        >
          Mobile Number <span className="text-red-500">*</span>
        </label>

        <input
          id="mobile"
          name="mobile"
          autoComplete="tel"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 transition outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="company"
          className="text-sm font-medium text-slate-700"
        >
          Company <span className="text-red-500">*</span>
        </label>

        <input
          id="company"
          name="company"
          autoComplete="organization"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 transition outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jobTitle"
          className="text-sm font-medium text-slate-700"
        >
          Job Title <span className="text-red-500">*</span>
        </label>

        <input
          id="jobTitle"
          name="jobTitle"
          autoComplete="organization-title"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 transition outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </div>

      {!state.success && state.message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">{state.message}</p>

          {state.fieldErrors && (
            <ul className="mt-2 list-disc pl-5">
              {Object.entries(state.fieldErrors).map(([field, errors]) => (
                <li key={field}>
                  <strong>{field}:</strong> {errors?.join(", ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        disabled={pending}
        className="mt-4 w-full rounded-xl bg-[#C8A24A] py-4 text-base font-semibold text-[#0B1018] transition-all duration-200 hover:bg-[#D9B765] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Checking You In..." : "Complete Check-In"}
      </button>
    </form>
  );
}