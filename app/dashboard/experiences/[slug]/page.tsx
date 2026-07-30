import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ExperienceStatusBadge } from "@/features/dashboard/components/experience-status-badge";
import { SurveyResultsPanel } from "@/features/surveys/components/survey-results-panel";
import { CustomSurveyResultsPanel } from "@/features/surveys/components/custom-survey-results-panel";
import { SurveyTab } from "@/features/surveys/components/survey-tab";
import { GenerateReportButton } from "@/features/reports/components/generate-report-button";
import { AttendanceTab } from "@/features/attendance/components/attendance-tab";
import { getDailyAttendanceDetail, getDailyAttendanceSummary } from "@/features/attendance/data";
import { LearningImpactTab } from "@/features/surveys/components/learning-impact-tab";
import { MaterialsTab } from "@/features/materials/components/materials-tab";
import { getExperienceMaterials } from "@/features/materials/data";
import { ExperienceAssetsTab } from "@/features/assets/components/experience-assets-tab";
import { getAvailableAssets, getExperienceAssets } from "@/features/assets/data";
import {
  getExperienceSurveyConfig,
  getExperienceSurveyTemplate,
  getPrePostComparisonData,
  getSurveyManagementData,
  getSurveyResultsByTemplate,
  getSurveyTemplates,
} from "@/features/surveys/data";
import { CertificatesTab } from "@/features/certificates/components/certificates-tab";
import {
  getCertificateTemplates,
  getExperienceCertificates,
  getExperienceCompletionCriteria,
} from "@/features/certificates/data";
import { getSessionContext } from "@/infrastructure/session/session-context";
import { ObservationsTab } from "@/features/observations/components/observations-tab";
import {
  getAllParticipantObservations,
  getExperienceObservation,
  getFacilitatorReport,
  getObservationTags,
} from "@/features/observations/data";
import { LogisticsTab } from "@/features/experiences/components/logistics-tab";
import { ParticipantsTab } from "@/features/experiences/components/participants-tab";
import { RegistrationLinkPanel } from "@/features/experiences/components/registration-link-panel";
import { ExperienceCreatedBanner } from "@/features/experiences/components/experience-created-banner";
import { EXPERIENCE_TABS, ExperienceTabs, type ExperienceTabKey } from "@/features/experiences/components/experience-tabs";
import {
  getExperienceBySlug,
  getExperienceLogisticsTasks,
  getExperienceParticipants,
  getExperienceSurveyResults,
} from "@/features/experiences/data";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const MIN_RESPONSES_FOR_CLIENT_REPORT = 3;

function resolveTab(tab: string | undefined): ExperienceTabKey {
  const match = EXPERIENCE_TABS.find((t) => t.key === tab);
  return match?.key ?? "participants";
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; created?: string }>;
};

export default async function ExperienceDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { tab, created } = await searchParams;
  const activeTab = resolveTab(tab);

  const experience = await getExperienceBySlug(slug);

  if (!experience) {
    notFound();
  }

  // Participants are needed on every tab (header count, survey tab's
  // response-rate math) — the other two are fetched only for the tab
  // actually being viewed, so each tab is an independent view: switching
  // to Participants still works even if, say, the logistics table isn't
  // there yet.
  const participants = await getExperienceParticipants(experience.id);

  // Observation tags/rows are needed on both the Participants tab (clickable
  // names, per-participant tag chips) and the Observations tab itself, so
  // they're fetched alongside participants rather than gated per-tab.
  const session = await getSessionContext();
  const defaultFacilitatorName = session.fullName ?? "";
  const [observationTags, participantObservations] = await Promise.all([
    getObservationTags(experience.id),
    getAllParticipantObservations(experience.id),
  ]);

  const observationsTabData =
    activeTab === "observations"
      ? await (async () => {
          const [myExperienceObservation, facilitatorReport] = await Promise.all([
            getExperienceObservation(experience.id),
            getFacilitatorReport(experience.id),
          ]);
          return { myExperienceObservation, facilitatorReport };
        })()
      : null;

  const surveyResults =
    activeTab === "survey" ? await getExperienceSurveyResults(experience.id) : null;
  const customSurveyResults =
    activeTab === "survey"
      ? await (async () => {
          const resolution = await getExperienceSurveyTemplate(experience.id);
          if (!resolution.template) {
            return null;
          }
          return getSurveyResultsByTemplate(experience.id, resolution.template.id);
        })()
      : null;
  const logisticsGroups =
    activeTab === "logistics" ? await getExperienceLogisticsTasks(experience.id) : null;

  const attendanceTabData =
    activeTab === "attendance" && experience.dailyCheckinEnabled
      ? await (async () => {
          const summary = await getDailyAttendanceSummary(experience.id);
          if (!summary) {
            return null;
          }

          const details = await Promise.all(
            summary.days.map((day) => getDailyAttendanceDetail(experience.id, day.date))
          );

          return {
            totalDays: summary.totalDays,
            today: summary.today,
            days: summary.days.map((day, index) => ({ ...day, participants: details[index] ?? [] })),
          };
        })()
      : null;

  const surveysTabData =
    activeTab === "surveys"
      ? await (async () => {
          const session = await getSessionContext();
          const [managementData, templates, templateResolution, surveyConfig] = await Promise.all([
            getSurveyManagementData(experience.id),
            getSurveyTemplates(session.workspaceId),
            getExperienceSurveyTemplate(experience.id, "satisfaction"),
            getExperienceSurveyConfig(experience.id),
          ]);
          return { managementData, templates, templateResolution, surveyConfig };
        })()
      : null;

  const impactData = activeTab === "impact" ? await getPrePostComparisonData(experience.id) : null;

  const materialsTabData =
    activeTab === "materials"
      ? await (async () => {
          const session = await getSessionContext();
          const [participantMaterials, facilitatorMaterials] = await Promise.all([
            getExperienceMaterials(experience.id, "participant"),
            getExperienceMaterials(experience.id, "facilitator"),
          ]);
          return { workspaceId: session.workspaceId, participantMaterials, facilitatorMaterials };
        })()
      : null;

  const assetsTabData =
    activeTab === "assets"
      ? await (async () => {
          const session = await getSessionContext();
          const [assignedAssets, availableAssets] = await Promise.all([
            getExperienceAssets(experience.id),
            getAvailableAssets(session.workspaceId, experience.id, experience.startDate, experience.endDate),
          ]);
          return { workspaceId: session.workspaceId, assignedAssets, availableAssets };
        })()
      : null;

  const certificatesData =
    activeTab === "certificates"
      ? await (async () => {
          const session = await getSessionContext();
          const [criteria, templates, rows] = await Promise.all([
            getExperienceCompletionCriteria(experience.id),
            getCertificateTemplates(session.workspaceId),
            getExperienceCertificates(experience.id),
          ]);
          return { criteria, templates, rows };
        })()
      : null;

  const isLocked = experience.status === "completed" || experience.status === "cancelled";
  const unsentSurveyCount = participants.filter((p) => p.surveyStatus === "not_sent").length;

  // Registration only makes sense while an experience is still open for
  // sign-ups — draft (not yet public, but shareable ahead of launch) or
  // active. Completed/cancelled experiences hide the link entirely.
  const registrationOpen = experience.status === "draft" || experience.status === "active";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const registrationUrl = `${appUrl}/r/${experience.slug}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href="/dashboard/experiences"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Back to Experiences
      </Link>

      {(experience.clientName || experience.engagementTitle) && (
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/dashboard/clients" className="hover:text-gold">
            Clients
          </Link>
          {experience.clientName && experience.clientId && (
            <>
              <ChevronRight className="size-3.5 shrink-0" />
              <Link href={`/dashboard/clients/${experience.clientId}`} className="hover:text-gold">
                {experience.clientName}
              </Link>
            </>
          )}
          {experience.engagementTitle && experience.clientId && experience.engagementId && (
            <>
              <ChevronRight className="size-3.5 shrink-0" />
              <Link
                href={`/dashboard/clients/${experience.clientId}/engagements/${experience.engagementId}`}
                className="hover:text-gold"
              >
                {experience.engagementTitle}
              </Link>
            </>
          )}
          <ChevronRight className="size-3.5 shrink-0" />
          <span className="text-ivory">{experience.title}</span>
        </nav>
      )}

      {created === "true" && <ExperienceCreatedBanner registrationUrl={registrationUrl} />}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{experience.title}</h1>
            <ExperienceStatusBadge status={experience.status} />
          </div>
          <p className="mt-2 text-muted-foreground">
            {formatDate(experience.startDate)} – {formatDate(experience.endDate)}
            {experience.venue ? ` · ${experience.venue}` : ""}
            {` · ${participants.length} / ${experience.capacity} registered`}
          </p>
        </div>

        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href={`/dashboard/experiences/${experience.slug}/edit`} />}
        >
          Edit
        </Button>
      </div>

      {/* The created banner above already surfaces the registration link
          with its own copy button — showing this panel too while that
          banner is still up would repeat the same URL twice in a row. It
          reappears once the banner is dismissed, which drops `created` from
          the URL and re-renders this Server Component. */}
      {registrationOpen && created !== "true" && <RegistrationLinkPanel url={registrationUrl} />}

      <ExperienceTabs
        slug={experience.slug}
        activeTab={activeTab}
        showAttendance={experience.dailyCheckinEnabled}
      />

      {activeTab === "participants" && (
        <ParticipantsTab
          experience={experience}
          participants={participants}
          registrationUrl={registrationOpen ? registrationUrl : null}
          observationTags={observationTags}
          observations={participantObservations}
          defaultFacilitatorName={defaultFacilitatorName}
        />
      )}

      {activeTab === "attendance" && attendanceTabData && (
        <AttendanceTab
          experienceId={experience.id}
          experienceSlug={experience.slug}
          totalDays={attendanceTabData.totalDays}
          today={attendanceTabData.today}
          days={attendanceTabData.days}
        />
      )}

      {activeTab === "survey" && surveyResults && (
        <div className="space-y-6">
          {surveyResults.responses.length + (customSurveyResults?.totalResponses ?? 0) >=
            MIN_RESPONSES_FOR_CLIENT_REPORT && (
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-ivory">Survey Results</h2>
              <GenerateReportButton experienceId={experience.id} />
            </div>
          )}

          {customSurveyResults ? (
            <CustomSurveyResultsPanel results={customSurveyResults} />
          ) : (
            <SurveyResultsPanel
              experienceId={experience.id}
              experienceSlug={experience.slug}
              experienceTitle={experience.title}
              participantsCount={participants.length}
              unsentCount={unsentSurveyCount}
              averages={surveyResults.averages}
              responses={surveyResults.responses}
            />
          )}

          {customSurveyResults && surveyResults.responses.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-semibold text-ivory">Historical Responses (Legacy Format)</h2>
              <SurveyResultsPanel
                experienceId={experience.id}
                experienceSlug={experience.slug}
                experienceTitle={experience.title}
                participantsCount={participants.length}
                unsentCount={unsentSurveyCount}
                averages={surveyResults.averages}
                responses={surveyResults.responses}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === "logistics" && logisticsGroups && (
        <LogisticsTab experienceSlug={experience.slug} isLocked={isLocked} groups={logisticsGroups} />
      )}

      {activeTab === "surveys" && surveysTabData && surveysTabData.managementData && (
        <SurveyTab
          data={surveysTabData.managementData}
          templates={surveysTabData.templates}
          templateResolution={surveysTabData.templateResolution}
          surveyConfig={surveysTabData.surveyConfig}
        />
      )}

      {activeTab === "impact" && impactData && (
        <LearningImpactTab data={impactData} experienceSlug={experience.slug} />
      )}

      {activeTab === "certificates" && certificatesData && (
        <CertificatesTab
          experienceId={experience.id}
          criteria={certificatesData.criteria}
          templates={certificatesData.templates}
          rows={certificatesData.rows}
        />
      )}

      {activeTab === "materials" && materialsTabData && (
        <MaterialsTab
          experienceId={experience.id}
          experienceSlug={experience.slug}
          workspaceId={materialsTabData.workspaceId}
          participantMaterials={materialsTabData.participantMaterials}
          facilitatorMaterials={materialsTabData.facilitatorMaterials}
          participants={participants.map((participant) => ({
            id: participant.id,
            fullName: `${participant.firstName} ${participant.lastName}`.trim(),
          }))}
        />
      )}

      {activeTab === "assets" && assetsTabData && (
        <ExperienceAssetsTab
          experienceId={experience.id}
          experienceSlug={experience.slug}
          workspaceId={assetsTabData.workspaceId}
          assignedAssets={assetsTabData.assignedAssets}
          availableAssets={assetsTabData.availableAssets}
        />
      )}

      {activeTab === "observations" && observationsTabData && (
        <ObservationsTab
          experienceId={experience.id}
          observationTags={observationTags}
          participants={participants}
          participantObservations={participantObservations}
          myExperienceObservation={observationsTabData.myExperienceObservation}
          defaultFacilitatorName={defaultFacilitatorName}
          initialReport={observationsTabData.facilitatorReport}
        />
      )}
    </div>
  );
}
