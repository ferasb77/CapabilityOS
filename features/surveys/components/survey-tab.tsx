import { Star } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  ExperienceSurveyConfig,
  ExperienceSurveyTemplateResolution,
  SurveyManagementData,
  SurveyParticipantRow,
  SurveyTemplateSummary,
} from "@/features/surveys/data";

import { SendAllSurveysButton } from "./send-all-surveys-button";
import { SendSurveyButton } from "./send-survey-button";
import { SendReminderButton } from "./send-reminder-button";
import { SendPreSurveyAllButton } from "./send-pre-survey-all-button";
import { SendPostSurveyAllButton } from "./send-post-survey-all-button";
import { ResendNonRespondersButton } from "./resend-non-responders-button";
import { DownloadSurveyResultsButton } from "./download-survey-results-button";
import { GenerateReportButton } from "@/features/reports/components/generate-report-button";
import { SurveyResponseModal } from "./survey-response-modal";
import { SurveyStatusBadge } from "./survey-status-badge";
import { SurveyTemplateSelector } from "./survey-template-selector";
import { PrePostStatusBadge } from "./pre-post-status-badge";
import { PrePostSurveyConfig } from "./pre-post-survey-config";

const REMINDER_ELIGIBLE_HOURS = 48;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-night/40 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold text-gold">{value}</p>
    </div>
  );
}

function scoreColorClass(score: number): string {
  if (score >= 4.0) return "text-emerald-400";
  if (score >= 3.0) return "text-amber-400";
  return "text-destructive";
}

function OverallScore({ row }: { row: SurveyParticipantRow }) {
  if (!row.response || row.response.overallRating === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className={cn("font-medium", scoreColorClass(row.response.overallRating))}>
      {row.response.overallRating}/5
    </span>
  );
}

function StatusCell({ row }: { row: SurveyParticipantRow }) {
  const dateLabel =
    row.status === "completed" && row.completedAt
      ? formatDate(row.completedAt)
      : row.status === "sent" && row.sentAt
        ? formatDate(row.sentAt)
        : null;

  return (
    <div className="flex flex-col gap-1">
      <SurveyStatusBadge status={row.status} className="w-fit" />
      {dateLabel && <span className="text-xs text-muted-foreground">{dateLabel}</span>}
    </div>
  );
}

function RowActions({
  row,
  experienceId,
  experienceSlug,
  experienceTitle,
}: {
  row: SurveyParticipantRow;
  experienceId: string;
  experienceSlug: string;
  experienceTitle: string;
}) {
  if (row.status === "completed") {
    return <SurveyResponseModal row={row} />;
  }

  const reminderEligible =
    row.status === "sent" && row.hoursSinceSent !== null && row.hoursSinceSent >= REMINDER_ELIGIBLE_HOURS;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <SendSurveyButton
        participantId={row.participantId}
        experienceId={experienceId}
        experienceSlug={experienceSlug}
        experienceTitle={experienceTitle}
        status={row.status}
      />
      {reminderEligible && row.tokenId && <SendReminderButton tokenId={row.tokenId} />}
    </div>
  );
}

type Props = {
  data: SurveyManagementData;
  templates: SurveyTemplateSummary[];
  templateResolution: ExperienceSurveyTemplateResolution;
  surveyConfig: ExperienceSurveyConfig;
};

export function SurveyTab({ data, templates, templateResolution, surveyConfig }: Props) {
  const nonResponderCount = data.rows.filter(
    (row) => row.status === "sent"
  ).length;

  const satisfactionTemplates = templates.filter((template) => template.surveyType === "satisfaction");
  const preTemplates = templates.filter((template) => template.surveyType === "pre_training");
  const postTemplates = templates.filter((template) => template.surveyType === "post_training");

  return (
    <div className="space-y-6">
      <PrePostSurveyConfig
        experienceId={data.experienceId}
        experienceSlug={data.experienceSlug}
        preTemplates={preTemplates}
        postTemplates={postTemplates}
        initialConfig={surveyConfig}
      />

      <SurveyTemplateSelector
        experienceId={data.experienceId}
        experienceSlug={data.experienceSlug}
        templates={satisfactionTemplates}
        activeSource={templateResolution.source}
        activeTemplateName={templateResolution.template?.name ?? null}
        overrideTemplateId={templateResolution.source === "override" ? templateResolution.template?.id ?? null : null}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <SummaryTile label="Total Participants" value={String(data.totalParticipants)} />
        <SummaryTile label="Surveys Sent" value={String(data.surveysSent)} />
        <SummaryTile label="Surveys Completed" value={String(data.surveysCompleted)} />
        <SummaryTile label="Response Rate" value={`${data.responseRate}%`} />
        <div className="col-span-2 rounded-lg border border-border-subtle bg-night/40 p-4 sm:col-span-1">
          <p className="text-sm text-muted-foreground">Average Overall Score</p>
          <p className="mt-1 flex items-center gap-1.5 font-heading text-2xl font-semibold text-gold">
            {data.averageOverallScore !== null ? (
              <>
                <Star className="size-5 fill-gold" />
                {data.averageOverallScore.toFixed(1)}/5
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        {data.preConfigured && (
          <SendPreSurveyAllButton experienceId={data.experienceId} experienceSlug={data.experienceSlug} />
        )}
        {data.postConfigured && (
          <SendPostSurveyAllButton experienceId={data.experienceId} experienceSlug={data.experienceSlug} />
        )}
        <SendAllSurveysButton
          experienceId={data.experienceId}
          experienceSlug={data.experienceSlug}
          experienceTitle={data.experienceTitle}
          unsentCount={data.rows.filter((row) => row.status === "not_sent").length}
        />
        <ResendNonRespondersButton
          experienceId={data.experienceId}
          experienceSlug={data.experienceSlug}
          nonResponderCount={nonResponderCount}
        />
        <DownloadSurveyResultsButton experienceId={data.experienceId} experienceSlug={data.experienceSlug} />
        <GenerateReportButton experienceId={data.experienceId} />
      </div>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Participants</CardTitle>
          <CardDescription>{data.totalParticipants} registered</CardDescription>
        </CardHeader>
        <CardContent>
          {data.rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No participants yet.</p>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Pre-Survey</TableHead>
                      <TableHead>Post-Survey</TableHead>
                      <TableHead>Satisfaction</TableHead>
                      <TableHead>Overall Score</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((row) => (
                      <TableRow key={row.participantId}>
                        <TableCell className="font-medium">{row.fullName}</TableCell>
                        <TableCell className="text-muted-foreground">{row.company ?? "—"}</TableCell>
                        <TableCell>
                          <PrePostStatusBadge status={row.preSurveyStatus} />
                        </TableCell>
                        <TableCell>
                          <PrePostStatusBadge status={row.postSurveyStatus} />
                        </TableCell>
                        <TableCell>
                          <StatusCell row={row} />
                        </TableCell>
                        <TableCell>
                          <OverallScore row={row} />
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActions
                            row={row}
                            experienceId={data.experienceId}
                            experienceSlug={data.experienceSlug}
                            experienceTitle={data.experienceTitle}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <ul className="space-y-3 md:hidden">
                {data.rows.map((row) => (
                  <li
                    key={row.participantId}
                    className="rounded-lg border border-border-subtle bg-night/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-ivory">{row.fullName}</p>
                      <OverallScore row={row} />
                    </div>
                    {row.company && <p className="mt-1 text-sm text-muted-foreground">{row.company}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <PrePostStatusBadge status={row.preSurveyStatus} />
                      <PrePostStatusBadge status={row.postSurveyStatus} />
                      <StatusCell row={row} />
                    </div>
                    <div className="mt-3">
                      <RowActions
                        row={row}
                        experienceId={data.experienceId}
                        experienceSlug={data.experienceSlug}
                        experienceTitle={data.experienceTitle}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
