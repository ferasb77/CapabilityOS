import { Badge } from "@/components/ui/badge";
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
import { SendAllSurveysButton } from "@/features/surveys/components/send-all-surveys-button";
import { SendSurveyButton } from "@/features/surveys/components/send-survey-button";
import { SurveyStatusBadge } from "@/features/surveys/components/survey-status-badge";
import type { WorkshopDetailRecord, WorkshopParticipant } from "@/features/workshops/data";

import { CopyLinkButton } from "./copy-link-button";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CheckInBadge({ checkedIn }: { checkedIn: boolean }) {
  if (checkedIn) {
    return (
      <Badge variant="outline" className="border-transparent bg-emerald-500/15 text-emerald-400">
        Checked In
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
      Not Checked In
    </Badge>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-night/40 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold text-gold">{value}</p>
    </div>
  );
}

type Props = {
  workshop: WorkshopDetailRecord;
  participants: WorkshopParticipant[];
  /** null when the workshop is completed/cancelled — registration has ended, so no link to share. */
  registrationUrl: string | null;
};

export function ParticipantsTab({ workshop, participants, registrationUrl }: Props) {
  const total = participants.length;

  if (total === 0) {
    return (
      <Card className="bg-surface-elevated">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-ivory">No participants yet.</p>
          {registrationUrl ? (
            <div className="flex w-full max-w-lg flex-col items-center gap-3 sm:flex-row">
              <p className="text-sm text-muted-foreground sm:text-left">
                Share this link to start receiving registrations:
              </p>
              <code className="w-full truncate rounded bg-night/60 px-2.5 py-1.5 text-left text-xs text-gold sm:flex-1">
                {registrationUrl}
              </code>
              <CopyLinkButton url={registrationUrl} className="shrink-0" />
            </div>
          ) : (
            <p className="max-w-md text-sm text-muted-foreground">
              Registration has ended for this workshop, and no one registered.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const checkedInCount = participants.filter((p) => p.checkedIn).length;
  const checkInRate = Math.round((checkedInCount / total) * 100);
  const surveyCompletedCount = participants.filter((p) => p.surveyStatus === "completed").length;
  const surveyResponseRate = Math.round((surveyCompletedCount / total) * 100);
  const unsentCount = participants.filter((p) => p.surveyStatus === "not_sent").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile label="Total Registered" value={String(total)} />
        <SummaryTile label="Checked In" value={String(checkedInCount)} />
        <SummaryTile label="Check-in Rate" value={`${checkInRate}%`} />
        <SummaryTile label="Survey Response Rate" value={`${surveyResponseRate}%`} />
      </div>

      <Card className="bg-surface-elevated">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Participants</CardTitle>
            <CardDescription>{total} registered</CardDescription>
          </div>
          <SendAllSurveysButton
            workshopId={workshop.id}
            workshopSlug={workshop.slug}
            workshopTitle={workshop.title}
            unsentCount={unsentCount}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Checked In At</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Survey</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell className="font-medium">
                    {participant.firstName} {participant.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {participant.company ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {participant.jobTitle ?? "—"}
                  </TableCell>
                  <TableCell>
                    <CheckInBadge checkedIn={participant.checkedIn} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {participant.checkedIn ? formatDateTime(participant.checkedInAt) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(participant.registeredAt)}
                  </TableCell>
                  <TableCell>
                    <SurveyStatusBadge status={participant.surveyStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <SendSurveyButton
                      participantId={participant.id}
                      workshopId={workshop.id}
                      workshopSlug={workshop.slug}
                      workshopTitle={workshop.title}
                      status={participant.surveyStatus}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
