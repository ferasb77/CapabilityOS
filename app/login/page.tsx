import { redirect } from "next/navigation";

import { LoginForm } from "@/features/auth/components/login-form";
import { createClient } from "@/infrastructure/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const [{ data: profile }, { data: portalUser }, { data: facilitator }] = await Promise.all([
      supabase.from("profiles").select("id").eq("id", user.id).maybeSingle(),
      supabase.from("client_portal_users").select("id").eq("auth_user_id", user.id).eq("is_active", true).maybeSingle(),
      supabase.from("facilitators").select("id").eq("auth_user_id", user.id).eq("is_active", true).maybeSingle(),
    ]);

    if (profile) {
      redirect("/dashboard");
    } else if (portalUser) {
      redirect("/client-portal");
    } else if (facilitator) {
      redirect("/facilitator-portal");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <LoginForm />
    </main>
  );
}