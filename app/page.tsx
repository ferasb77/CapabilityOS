import { redirect } from "next/navigation";

import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function HomePage() {
  // getSessionContext() redirects to /login itself when there's no session
  // or no matching profile — reaching the line below means we're signed in.
  await getSessionContext();
  redirect("/dashboard");
}
