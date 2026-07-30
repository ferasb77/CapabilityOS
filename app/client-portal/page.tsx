import { ClientPortalHeader } from "@/features/client-portal/components/client-portal-header";
import { ClientPortalOverview } from "@/features/client-portal/components/client-portal-overview";
import { getClientOverview, getClientPortalSessionContext } from "@/features/client-portal/data";
import { updateLastSeen } from "@/features/client-portal/actions";

export default async function ClientPortalPage() {
  const portalUser = await getClientPortalSessionContext();

  const [overview] = await Promise.all([
    getClientOverview(portalUser.clientId),
    updateLastSeen(portalUser.id),
  ]);

  return (
    <main className="min-h-screen bg-night text-ivory">
      <ClientPortalHeader clientName={portalUser.clientName} fullName={portalUser.fullName} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <ClientPortalOverview overview={overview} />
      </div>
    </main>
  );
}
