import { redirect } from "next/navigation";

import { ClientPortalLoginForm } from "@/features/client-portal/components/login-form";
import { getClientPortalUser } from "@/features/client-portal/data";
import { createClient } from "@/infrastructure/supabase/server";

export default async function ClientPortalLoginPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const portalUser = await getClientPortalUser(user.id);
    if (portalUser) {
      redirect("/client-portal");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <ClientPortalLoginForm />
    </main>
  );
}
