import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

import { EngagementDetail } from "@/features/engagements/components/engagement-detail";
import { EngagementTabs, type EngagementTabKey } from "@/features/engagements/components/engagement-tabs";
import { getEngagementById, getEngagementExperiences } from "@/features/engagements/data";
import { EngagementFinancialTab } from "@/features/financial/components/engagement-financial-tab";
import { getMilestonesByEngagement, getPrimaryFinanceContactEmail, summarizeMilestones } from "@/features/financial/data";
import { getSessionContext } from "@/infrastructure/session/session-context";

type Props = {
  params: Promise<{ id: string; engagementId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function EngagementDetailPage({ params, searchParams }: Props) {
  const { id, engagementId } = await params;
  const { tab } = await searchParams;
  const activeTab: EngagementTabKey = tab === "financial" ? "financial" : "overview";

  const engagement = await getEngagementById(engagementId);

  if (!engagement || engagement.clientId !== id) {
    notFound();
  }

  const experiences = await getEngagementExperiences(engagementId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={`/dashboard/clients/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Back to {engagement.clientName}
      </Link>

      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/dashboard/clients" className="hover:text-gold">
          Clients
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <Link href={`/dashboard/clients/${id}`} className="hover:text-gold">
          {engagement.clientName}
        </Link>
        <ChevronRight className="size-3.5 shrink-0" />
        <span className="text-ivory">{engagement.title}</span>
      </nav>

      <EngagementTabs clientId={id} engagementId={engagementId} activeTab={activeTab} />

      {activeTab === "financial" ? (
        <FinancialTabContent engagementId={engagementId} clientId={id} contractValue={engagement.contractValue} currency={engagement.currency} experiences={experiences} />
      ) : (
        <EngagementDetail engagement={engagement} experiences={experiences} />
      )}
    </div>
  );
}

async function FinancialTabContent({
  engagementId,
  clientId,
  contractValue,
  currency,
  experiences,
}: {
  engagementId: string;
  clientId: string;
  contractValue: number | null;
  currency: string;
  experiences: { id: string; slug: string; title: string }[];
}) {
  const session = await getSessionContext();
  const [milestones, financeContactEmail] = await Promise.all([
    getMilestonesByEngagement(engagementId),
    getPrimaryFinanceContactEmail(session.workspaceId),
  ]);

  const summary = summarizeMilestones(milestones, contractValue, currency);

  return (
    <EngagementFinancialTab
      engagementId={engagementId}
      clientId={clientId}
      summary={summary}
      milestones={milestones}
      experiences={experiences}
      financeContactEmail={financeContactEmail}
    />
  );
}
