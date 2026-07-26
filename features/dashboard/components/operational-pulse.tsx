import { AlertTriangle, Briefcase, CalendarDays, UserCheck, Users } from "lucide-react";

import { formatCurrency } from "@/features/intelligence/format";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/infrastructure/repositories/dashboard";

import { PulseCard } from "./pulse-card";

export function OperationalPulse({ pulse }: { pulse: DashboardData["operationalPulse"] }) {
  const { activeEngagements, upcomingExperiences, participantsNext30Days, facilitatorCoverage, attentionRequired } = pulse;

  const coverageComplete = facilitatorCoverage.total === 0 || facilitatorCoverage.assigned === facilitatorCoverage.total;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <PulseCard
        icon={Briefcase}
        label="Active Engagements"
        value={activeEngagements.count}
        subtext={`${activeEngagements.clients} client${activeEngagements.clients === 1 ? "" : "s"} · ${formatCurrency(activeEngagements.value)}`}
      />
      <PulseCard
        icon={CalendarDays}
        label="Upcoming — Next 30 Days"
        value={upcomingExperiences.count}
        subtext={
          <>
            {upcomingExperiences.thisWeek} this week · {upcomingExperiences.laterThisMonth} later this month
            <br />
            View next 90 days below ↓
          </>
        }
      />
      <PulseCard
        icon={Users}
        label="Participants — Next 30 Days"
        value={participantsNext30Days.total.toLocaleString()}
        subtext={`${participantsNext30Days.confirmed.toLocaleString()} confirmed · ${participantsNext30Days.pending.toLocaleString()} pending`}
      />
      <PulseCard
        icon={UserCheck}
        label="Facilitator Coverage"
        value={`${facilitatorCoverage.assigned} / ${facilitatorCoverage.total}`}
        valueClassName={coverageComplete ? "text-gold" : "text-destructive"}
        subtext={
          <span className={cn(facilitatorCoverage.outstanding > 0 ? "text-destructive" : "text-emerald-400")}>
            {facilitatorCoverage.outstanding} assignment{facilitatorCoverage.outstanding === 1 ? "" : "s"} outstanding
          </span>
        }
      />
      <PulseCard
        icon={AlertTriangle}
        label="Attention Required"
        value={attentionRequired.total}
        valueClassName={attentionRequired.critical > 0 ? "text-destructive" : "text-gold"}
        subtext={`${attentionRequired.critical} critical · ${attentionRequired.upcomingRisk} upcoming · ${attentionRequired.followUp} follow-up`}
      />
    </div>
  );
}
