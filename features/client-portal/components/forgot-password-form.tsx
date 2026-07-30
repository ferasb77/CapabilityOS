"use client";

import Link from "next/link";
import { useActionState } from "react";

import { requestPasswordReset, type RequestPasswordResetState } from "../actions";

const initialState: RequestPasswordResetState = { success: false, message: "" };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        <p className="mt-2 text-slate-500">Enter your email and we&apos;ll send you a reset link.</p>
      </div>

      {state.success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : (
        <form action={formAction} className="space-y-6">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900"
            />
          </div>

          {state.message && !state.success && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.message}</div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/client-portal/login" className="font-medium text-slate-700 hover:text-slate-900">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
