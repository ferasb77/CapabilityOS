import { CalendarCheck, ClipboardList, LayoutGrid, UserCheck } from "lucide-react";

import { AttentionPanel } from "@/features/dashboard/components/attention-panel";
import { RecentParticipantsPanel } from "@/features/dashboard/components/recent-participants-panel";
import { RecentWorkshopsPanel } from "@/features/dashboard/components/recent-workshops-panel";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { getDashboardData } from "@/infrastructure/repositories/dashboard";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function DashboardPage() {
  const [session, { stats, recentWorkshops, recentParticipants, attentionItems }] =
    await Promise.all([getSessionContext(), getDashboardData()]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back{session.fullName ? `, ${session.fullName}` : ""}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {session.organizationName} · {session.workspaceName}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Workshops" value={stats.totalWorkshops} icon={LayoutGrid} />
        <StatCard
          label="Total Participants"
          value={stats.totalParticipants}
          icon={ClipboardList}
        />
        <StatCard label="Checked In" value={stats.checkedIn} icon={UserCheck} />
        <StatCard label="Active Workshops" value={stats.activeWorkshops} icon={CalendarCheck} />
      </div>

      <AttentionPanel items={attentionItems} />

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentWorkshopsPanel workshops={recentWorkshops} />
        <RecentParticipantsPanel participants={recentParticipants} />
      </div>
    </div>
  );
}
