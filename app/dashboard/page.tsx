import { ActiveEngagementsPanel } from "@/features/dashboard/components/active-engagements-panel";
import { AttentionSection } from "@/features/dashboard/components/attention-section";
import { CapabilityIntelligenceSection } from "@/features/dashboard/components/capability-intelligence-section";
import { DashboardGreetingHeader } from "@/features/dashboard/components/dashboard-greeting";
import { DeliveryHorizonChart } from "@/features/dashboard/components/delivery-horizon-chart";
import { FacilitatorCapacityPanel } from "@/features/dashboard/components/facilitator-capacity-panel";
import { FinancialPulseSection } from "@/features/dashboard/components/financial-pulse-section";
import { OperationalPulse } from "@/features/dashboard/components/operational-pulse";
import { PostDeliveryQueuePanel } from "@/features/dashboard/components/post-delivery-queue-panel";
import { UpcomingDeliveryTable } from "@/features/dashboard/components/upcoming-delivery-table";
import { triggerDueDateBasedMilestones } from "@/features/financial/actions";
import { getFinancialAttentionItems, getFinancialPulse } from "@/features/financial/data";
import { getDashboardIntelligenceSummary } from "@/features/intelligence/data";
import { getDashboardData } from "@/infrastructure/repositories/dashboard";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function DashboardPage() {
  const session = await getSessionContext();

  // Fire-and-forget: sweeps date_based milestones whose trigger_date has
  // arrived and flips them to triggered (with a notification email). Never
  // awaited — this is a page render, not a Server Action, so it must not
  // block the response or call revalidatePath; the next load simply sees
  // the now-triggered status. See features/financial/actions.ts.
  void triggerDueDateBasedMilestones(session.workspaceId);

  const [data, intelligenceSummary, financialPulse, financialAttention] = await Promise.all([
    getDashboardData(),
    getDashboardIntelligenceSummary(session.workspaceId),
    getFinancialPulse(session.workspaceId),
    getFinancialAttentionItems(session.workspaceId),
  ]);

  const attentionBySeverity = {
    critical: [...data.attentionBySeverity.critical, ...financialAttention.critical],
    upcomingRisk: [...data.attentionBySeverity.upcomingRisk, ...financialAttention.upcomingRisk],
    followUp: [...data.attentionBySeverity.followUp, ...financialAttention.followUp],
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <DashboardGreetingHeader greeting={data.greeting} />

      <OperationalPulse pulse={data.operationalPulse} />

      <AttentionSection attentionBySeverity={attentionBySeverity} />

      <UpcomingDeliveryTable rows={data.upcomingDelivery} summary={data.upcomingDeliverySummary} />

      <div className="grid gap-6 xl:grid-cols-2">
        <ActiveEngagementsPanel engagements={data.activeEngagementsDetail} totalCount={data.activeEngagementsTotalCount} />
        <FacilitatorCapacityPanel capacity={data.facilitatorCapacity} />
      </div>

      <FinancialPulseSection pulse={financialPulse} />

      <div className="grid gap-6 xl:grid-cols-2">
        <DeliveryHorizonChart months={data.deliveryHorizon} />
        <PostDeliveryQueuePanel items={data.postDeliveryQueue} />
      </div>

      <CapabilityIntelligenceSection summary={intelligenceSummary} />
    </div>
  );
}
