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
import type { ParticipantWithSurveyStatus } from "@/infrastructure/repositories/surveys";

import { SendAllSurveysButton } from "./send-all-surveys-button";
import { SendSurveyButton } from "./send-survey-button";
import { SurveyStatusBadge } from "./survey-status-badge";

type Props = {
  workshopId: string;
  workshopSlug: string;
  workshopTitle: string;
  participants: ParticipantWithSurveyStatus[];
};

export function ParticipantsSurveyPanel({
  workshopId,
  workshopSlug,
  workshopTitle,
  participants,
}: Props) {
  const unsentCount = participants.filter((p) => p.surveyStatus === "not_sent").length;

  return (
    <Card className="bg-surface-elevated">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Participants</CardTitle>
          <CardDescription>Survey delivery status for each participant.</CardDescription>
        </div>
        <SendAllSurveysButton
          workshopId={workshopId}
          workshopSlug={workshopSlug}
          workshopTitle={workshopTitle}
          unsentCount={unsentCount}
        />
      </CardHeader>
      <CardContent>
        {participants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No participants yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
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
                  <TableCell>
                    <SurveyStatusBadge status={participant.surveyStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <SendSurveyButton
                      participantId={participant.id}
                      workshopId={workshopId}
                      workshopSlug={workshopSlug}
                      workshopTitle={workshopTitle}
                      status={participant.surveyStatus}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
