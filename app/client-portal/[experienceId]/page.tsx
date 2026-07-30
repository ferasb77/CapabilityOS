import Link from "next/link";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { notFound } from "next/navigation";

import { ExperienceStatusBadge } from "@/features/dashboard/components/experience-status-badge";
import { ClientPortalHeader } from "@/features/client-portal/components/client-portal-header";
import { ProgramTabs, PROGRAM_TABS, type ProgramTabKey } from "@/features/client-portal/components/program-tabs";
import { ClientAttendanceTab } from "@/features/client-portal/components/client-attendance-tab";
import { ClientLearningImpactTab } from "@/features/client-portal/components/client-learning-impact-tab";
import { ClientSatisfactionTab } from "@/features/client-portal/components/client-satisfaction-tab";
import { ClientFacilitatorReportTab } from "@/features/client-portal/components/client-facilitator-report-tab";
import {
  getClientAttendance,
  getClientExperienceDetail,
  getClientFacilitatorReport,
  getClientLearningImpact,
  getClientPortalSessionContext,
  getClientSatisfaction,
} from "@/features/client-portal/data";

function resolveTab(tab: string | undefined): ProgramTabKey {
  const match = PROGRAM_TABS.find((t) => t.key === tab);
  return match?.key ?? "attendance";
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

type Props = {
  params: Promise<{ experienceId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function ClientPortalProgramPage({ params, searchParams }: Props) {
  const { experienceId } = await params;
  const { tab } = await searchParams;
  const activeTab = resolveTab(tab);

  const portalUser = await getClientPortalSessionContext();
  const experience = await getClientExperienceDetail(experienceId, portalUser.clientId);

  if (!experience) {
    notFound();
  }

  const attendance = activeTab === "attendance" ? await getClientAttendance(experienceId) : null;
  const impact = activeTab === "impact" ? await getClientLearningImpact(experienceId) : null;
  const satisfaction = activeTab === "satisfaction" ? await getClientSatisfaction(experienceId) : null;
  const facilitatorReport = activeTab === "report" ? await getClientFacilitatorReport(experienceId) : null;

  return (
    <main className="min-h-screen bg-night text-ivory">
      <ClientPortalHeader clientName={portalUser.clientName} fullName={portalUser.fullName} />

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Link
          href="/client-portal"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
        >
          <ArrowLeft className="size-4" />
          Back to programs
        </Link>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold text-ivory">{experience.title}</h1>
            <ExperienceStatusBadge status={experience.status} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              {formatDate(experience.startDate)} – {formatDate(experience.endDate)}
            </span>
            {experience.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {experience.venue}
              </span>
            )}
          </div>
        </div>

        <ProgramTabs experienceId={experience.id} activeTab={activeTab} />

        {activeTab === "attendance" && attendance && <ClientAttendanceTab data={attendance} />}
        {activeTab === "impact" && impact && <ClientLearningImpactTab data={impact} />}
        {activeTab === "satisfaction" && (
          <ClientSatisfactionTab data={satisfaction} experienceId={experience.id} />
        )}
        {activeTab === "report" && facilitatorReport && (
          <ClientFacilitatorReportTab data={facilitatorReport} experienceId={experience.id} />
        )}
      </div>
    </main>
  );
}
