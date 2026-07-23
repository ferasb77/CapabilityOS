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
import type { ParticipantSummary } from "@/infrastructure/repositories/dashboard";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Props = {
  participants: ParticipantSummary[];
};

export function RecentParticipantsPanel({ participants }: Props) {
  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Recent Participants</CardTitle>
        <CardDescription>The 10 most recently registered.</CardDescription>
      </CardHeader>
      <CardContent>
        {participants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No participants yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Workshop</TableHead>
                <TableHead>Checked In</TableHead>
                <TableHead className="text-right">Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell className="font-medium">{participant.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {participant.company ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {participant.jobTitle ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {participant.workshopTitle ?? "—"}
                  </TableCell>
                  <TableCell>
                    {participant.checkedIn ? (
                      <Badge>Checked In</Badge>
                    ) : (
                      <Badge variant="secondary">Not Checked In</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatDateTime(participant.createdAt)}
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
