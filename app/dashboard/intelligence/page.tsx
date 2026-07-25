import { IntelTabs } from "@/features/intelligence/components/intel-tabs";
import { OrgIntelligenceView } from "@/features/intelligence/components/org-intelligence-view";
import { getOperationalEfficiency, getOrganizationIntelligence, getSatisfactionIntelligence } from "@/features/intelligence/data";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function OrganizationIntelligencePage() {
  const session = await getSessionContext();
  const [data, satisfaction, operations] = await Promise.all([
    getOrganizationIntelligence(session.workspaceId),
    getSatisfactionIntelligence(session.workspaceId),
    getOperationalEfficiency(session.workspaceId),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Intelligence</h1>
        <p className="mt-2 text-muted-foreground">
          Patterns and trends across the entire operation — evidence and insight, for you to decide on.
        </p>
      </div>

      <IntelTabs activeTab="overview" />

      <OrgIntelligenceView data={data} satisfaction={satisfaction} operations={operations} />
    </div>
  );
}
