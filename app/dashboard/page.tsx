import { ActiveEngagementsPanel } from "@/features/dashboard/components/active-engagements-panel";
import { AttentionSection } from "@/features/dashboard/components/attention-section";
import { CapabilityIntelligenceSection } from "@/features/dashboard/components/capability-intelligence-section";
import { DashboardGreetingHeader } from "@/features/dashboard/components/dashboard-greeting";
import { DeliveryHorizonChart } from "@/features/dashboard/components/delivery-horizon-chart";
import { FacilitatorCapacityPanel } from "@/features/dashboard/components/facilitator-capacity-panel";
import { OperationalPulse } from "@/features/dashboard/components/operational-pulse";
import { PostDeliveryQueuePanel } from "@/features/dashboard/components/post-delivery-queue-panel";
import { UpcomingDeliveryTable } from "@/features/dashboard/components/upcoming-delivery-table";
import { getDashboardIntelligenceSummary } from "@/features/intelligence/data";
import { getDashboardData } from "@/infrastructure/repositories/dashboard";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function DashboardPage() {
  const session = await getSessionContext();
  const [data, intelligenceSummary] = await Promise.all([
    getDashboardData(),
    getDashboardIntelligenceSummary(session.workspaceId),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <DashboardGreetingHeader greeting={data.greeting} />

      <OperationalPulse pulse={data.operationalPulse} />

      <AttentionSection attentionBySeverity={data.attentionBySeverity} />

      <UpcomingDeliveryTable rows={data.upcomingDelivery} summary={data.upcomingDeliverySummary} />

      <div className="grid gap-6 xl:grid-cols-2">
        <ActiveEngagementsPanel engagements={data.activeEngagementsDetail} totalCount={data.activeEngagementsTotalCount} />
        <FacilitatorCapacityPanel capacity={data.facilitatorCapacity} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DeliveryHorizonChart months={data.deliveryHorizon} />
        <PostDeliveryQueuePanel items={data.postDeliveryQueue} />
      </div>

      <CapabilityIntelligenceSection summary={intelligenceSummary} />
    </div>
  );
}
