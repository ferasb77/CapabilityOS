import Link from "next/link";
import { Briefcase, Building2, ClipboardList, Plus, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AttentionPanel } from "@/features/dashboard/components/attention-panel";
import { IntelligenceSummary } from "@/features/dashboard/components/intelligence-summary";
import { RecentExperiencesPanel } from "@/features/dashboard/components/recent-experiences-panel";
import { RecentParticipantsPanel } from "@/features/dashboard/components/recent-participants-panel";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { getDashboardIntelligenceSummary } from "@/features/intelligence/data";
import { getDashboardData } from "@/infrastructure/repositories/dashboard";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function DashboardPage() {
  const session = await getSessionContext();
  const [{ stats, recentExperiences, recentParticipants, attentionItems }, intelligenceSummary] = await Promise.all([
    getDashboardData(),
    getDashboardIntelligenceSummary(session.workspaceId),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back{session.fullName ? `, ${session.fullName}` : ""}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {session.organizationName} · {session.workspaceName}
          </p>
        </div>

        <Button size="lg" nativeButton={false} render={<Link href="/dashboard/experiences/new" />}>
          <Plus className="size-4" />
          New Experience
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active Engagements" value={stats.activeEngagements} icon={Briefcase} />
        <StatCard
          label="Total Participants"
          value={stats.totalParticipants}
          icon={ClipboardList}
        />
        <StatCard label="Checked In" value={stats.checkedIn} icon={UserCheck} />
        <StatCard label="Total Clients" value={stats.totalClients} icon={Building2} />
      </div>

      <AttentionPanel items={attentionItems} />

      <IntelligenceSummary summary={intelligenceSummary} />

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentExperiencesPanel experiences={recentExperiences} />
        <RecentParticipantsPanel participants={recentParticipants} />
      </div>
    </div>
  );
}
