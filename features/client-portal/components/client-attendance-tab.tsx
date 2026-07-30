import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientAttendance } from "../data";

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-night/40 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold text-gold">{value}</p>
    </div>
  );
}

function CheckedInBadge({ checkedIn }: { checkedIn: boolean }) {
  return checkedIn ? (
    <Badge variant="outline" className="border-transparent bg-emerald-500/15 text-emerald-400">
      Checked In
    </Badge>
  ) : (
    <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
      Not Checked In
    </Badge>
  );
}

type Props = {
  data: ClientAttendance;
};

export function ClientAttendanceTab({ data }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <SummaryTile label="Total Registered" value={String(data.totalRegistered)} />
        <SummaryTile label="Checked In" value={String(data.totalCheckedIn)} />
        <SummaryTile label="Check-in Rate" value={`${data.checkInRate}%`} />
      </div>

      {data.dailyCheckinEnabled && data.days.length > 0 && (
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Daily Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.days.map((day) => (
                <li
                  key={day.date}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-night/40 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-ivory">
                      Day {day.dayNumber} — {formatDate(day.date)}
                    </p>
                  </div>
                  <p className="text-muted-foreground">
                    {day.checkedInCount} of {day.totalRegistered} checked in ({day.attendanceRate}%)
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Participants</CardTitle>
        </CardHeader>
        <CardContent>
          {data.participants.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No participants registered.</p>
          ) : (
            <ul className="space-y-2">
              {data.participants.map((participant, index) => (
                <li
                  key={index}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-night/40 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-ivory">
                      {participant.firstName} {participant.lastName}
                    </p>
                    {(participant.company || participant.jobTitle) && (
                      <p className="text-xs text-muted-foreground">
                        {[participant.company, participant.jobTitle].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {participant.checkedIn && participant.checkedInAt && (
                      <span className="text-xs text-muted-foreground">{formatTime(participant.checkedInAt)}</span>
                    )}
                    <CheckedInBadge checkedIn={participant.checkedIn} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
