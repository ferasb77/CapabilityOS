import { FacilitatorComparisonTable } from "@/features/intelligence/components/facilitator-comparison-table";
import { FacilitatorDetailPanel } from "@/features/intelligence/components/facilitator-detail-panel";
import { IntelTabs } from "@/features/intelligence/components/intel-tabs";
import { getFacilitatorDetailIntelligence, getFacilitatorIntelligence } from "@/features/intelligence/data";
import { getSessionContext } from "@/infrastructure/session/session-context";

type Props = {
  searchParams: Promise<{ facilitator?: string }>;
};

export default async function FacilitatorIntelligencePage({ searchParams }: Props) {
  const { facilitator: selectedFacilitatorId } = await searchParams;
  const session = await getSessionContext();

  const [rows, detail] = await Promise.all([
    getFacilitatorIntelligence(session.workspaceId),
    selectedFacilitatorId ? getFacilitatorDetailIntelligence(selectedFacilitatorId) : Promise.resolve(null),
  ]);

  const selectedRow = selectedFacilitatorId ? (rows.find((r) => r.id === selectedFacilitatorId) ?? null) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Intelligence</h1>
        <p className="mt-2 text-muted-foreground">Compare facilitators and drill into a delivery history.</p>
      </div>

      <IntelTabs activeTab="facilitators" />

      <FacilitatorComparisonTable rows={rows} selectedFacilitatorId={selectedFacilitatorId ?? null} />

      {selectedRow && detail && <FacilitatorDetailPanel row={selectedRow} data={detail} />}
    </div>
  );
}
