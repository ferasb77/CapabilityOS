import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { ClientDetail } from "@/features/clients/components/client-detail";
import { getClientById, getClientRelationshipHistory } from "@/features/clients/data";
import { getEngagementsByClient } from "@/features/engagements/data";
import { PortalAccessSection } from "@/features/client-portal/components/portal-access-section";
import { getClientPortalUsers } from "@/features/client-portal/data";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const client = await getClientById(id);

  if (!client) {
    notFound();
  }

  const [engagements, history, portalUsers] = await Promise.all([
    getEngagementsByClient(id),
    getClientRelationshipHistory(id),
    getClientPortalUsers(id),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/dashboard/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Back to clients
      </Link>

      <ClientDetail client={client} engagements={engagements} history={history} />

      <PortalAccessSection clientId={id} portalUsers={portalUsers} />
    </div>
  );
}
