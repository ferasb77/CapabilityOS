import { Card, CardContent } from "@/components/ui/card";
import type { AttendanceTabDay } from "../data";

import { DayRow } from "./day-row";

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function SummaryTile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={
        highlight
          ? "rounded-lg border border-gold/40 bg-gold/10 p-4"
          : "rounded-lg border border-border-subtle bg-night/40 p-4"
      }
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={highlight ? "mt-1 font-heading text-2xl font-semibold text-gold" : "mt-1 font-heading text-2xl font-semibold text-ivory"}>
        {value}
      </p>
    </div>
  );
}

type Props = {
  experienceId: string;
  experienceSlug: string;
  totalDays: number;
  today: string;
  days: AttendanceTabDay[];
};

export function AttendanceTab({ experienceId, experienceSlug, totalDays, today, days }: Props) {
  const isRunning = days.some((day) => day.date === today);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <SummaryTile label="Total Days" value={String(totalDays)} />
        <SummaryTile label="Today" value={formatShortDate(today)} highlight={isRunning} />
        <SummaryTile label="Status" value={isRunning ? "Running" : "Not Running"} highlight={isRunning} />
      </div>

      {days.length === 0 ? (
        <Card className="bg-surface-elevated">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No attendance days to show.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {days.map((day) => (
            <DayRow key={day.date} experienceId={experienceId} experienceSlug={experienceSlug} day={day} />
          ))}
        </div>
      )}
    </div>
  );
}
