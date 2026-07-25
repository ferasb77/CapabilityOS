import { ClientComparisonTable } from "@/features/intelligence/components/client-comparison-table";
import { ClientDetailPanel } from "@/features/intelligence/components/client-detail-panel";
import { IntelTabs } from "@/features/intelligence/components/intel-tabs";
import { getClientDetailIntelligence, getClientIntelligence } from "@/features/intelligence/data";
import { getSessionContext } from "@/infrastructure/session/session-context";

type Props = {
  searchParams: Promise<{ client?: string }>;
};

export default async function ClientIntelligencePage({ searchParams }: Props) {
  const { client: selectedClientId } = await searchParams;
  const session = await getSessionContext();

  const [rows, detail] = await Promise.all([
    getClientIntelligence(session.workspaceId),
    selectedClientId ? getClientDetailIntelligence(selectedClientId) : Promise.resolve(null),
  ]);

  const selectedRow = selectedClientId ? (rows.find((r) => r.id === selectedClientId) ?? null) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Intelligence</h1>
        <p className="mt-2 text-muted-foreground">Compare clients and drill into a relationship&apos;s full history.</p>
      </div>

      <IntelTabs activeTab="clients" />

      <ClientComparisonTable rows={rows} selectedClientId={selectedClientId ?? null} />

      {selectedRow && detail && <ClientDetailPanel row={selectedRow} data={detail} />}
    </div>
  );
}
