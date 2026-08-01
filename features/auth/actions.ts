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

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !authData.user) {
    return {
      error: toActionError(error, "auth"),
    };
  }

  const userId = authData.user.id;

  const [{ data: profile }, { data: portalUser }, { data: facilitator }] = await Promise.all([
    supabase.from("profiles").select("id").eq("id", userId).maybeSingle(),
    supabase.from("client_portal_users").select("id").eq("auth_user_id", userId).eq("is_active", true).maybeSingle(),
    supabase.from("facilitators").select("id").eq("auth_user_id", userId).eq("is_active", true).maybeSingle(),
  ]);

  if (profile) {
    redirect("/dashboard");
  } else if (portalUser) {
    redirect("/client-portal");
  } else if (facilitator) {
    redirect("/facilitator-portal");
  } else {
    await supabase.auth.signOut();
    return {
      error: "Account not found",
    };
  }
}

export async function signOut() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/login");
}