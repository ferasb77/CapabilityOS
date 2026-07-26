import { IntelTabs } from "@/features/intelligence/components/intel-tabs";
import { PortfolioIntelligenceView } from "@/features/intelligence/components/portfolio-intelligence-view";
import { getFinancialIntelligence, getPortfolioIntelligence } from "@/features/intelligence/data";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function PortfolioIntelligencePage() {
  const session = await getSessionContext();
  const [data, financial] = await Promise.all([
    getPortfolioIntelligence(session.workspaceId),
    getFinancialIntelligence(session.workspaceId),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Intelligence</h1>
        <p className="mt-2 text-muted-foreground">What HNI delivers, where, to whom, and at what value.</p>
      </div>

      <IntelTabs activeTab="portfolio" />

      <PortfolioIntelligenceView data={data} financial={financial} />
    </div>
  );
}
