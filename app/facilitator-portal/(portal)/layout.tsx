import type { ReactNode } from "react";
import { getFacilitatorPortalSessionContext } from "@/features/facilitator-portal/data";
import { FacilitatorPortalHeader } from "@/features/facilitator-portal/components/facilitator-portal-header";

export default async function FacilitatorPortalLayout({ children }: { children: ReactNode }) {
  const facilitator = await getFacilitatorPortalSessionContext();

  return (
    <div className="min-h-screen bg-night text-ivory">
      <FacilitatorPortalHeader fullName={facilitator.fullName} photoUrl={facilitator.photoUrl} />
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
