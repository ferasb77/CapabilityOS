"use client";

import Link from "next/link";
import { useActionState } from "react";

import { BRANDING } from "@/config/branding";

import { clientPortalLogin, type ClientPortalLoginState } from "../actions";

const initialState: ClientPortalLoginState = { error: "" };

export function ClientPortalLoginForm() {
  const [state, formAction, pending] = useActionState(clientPortalLogin, initialState);

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">{BRANDING.companyName}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Training Portal</h1>
        <p className="mt-2 text-slate-500">Sign in to your training portal</p>
      </div>

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
            placeholder="you@example.com"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900"
          />
        </div>

        {state.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.error}</div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Signing In..." : "Sign In"}
        </button>

        <p className="text-center text-sm text-slate-500">
          <Link href="/client-portal/forgot-password" className="font-medium text-slate-700 hover:text-slate-900">
            Forgot your password?
          </Link>
        </p>
      </form>
    </div>
  );
}
