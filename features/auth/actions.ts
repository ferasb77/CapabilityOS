"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/infrastructure/supabase/server";
import { toActionError } from "@/shared/errors/action-error";

export type LoginState = {
  error: string;
};

export async function login(
  previousState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const supabase = await createClient();

  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: toActionError(error, "auth"),
    };
  }

  // Operators and facilitators share this one /login page (Sprint 34) — the
  // post-auth landing spot depends on which table auth.uid() resolves
  // against. A password match with no matching profiles or facilitators row
  // (e.g. a client portal contact who wandered onto the wrong login page)
  // is signed back out rather than left with a session that goes nowhere.
  const userId = data.user?.id;

  const [{ data: profile }, { data: facilitator }] = await Promise.all([
    supabase.from("profiles").select("id").eq("id", userId ?? "").maybeSingle(),
    supabase.from("facilitators").select("id").eq("auth_user_id", userId ?? "").eq("portal_access_active", true).maybeSingle(),
  ]);

  if (profile) {
    redirect("/dashboard");
  }

  if (facilitator) {
    redirect("/facilitator-portal");
  }

  await supabase.auth.signOut();
  return { error: "Account not found." };
}

export async function signOut() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/login");
}