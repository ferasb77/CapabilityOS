"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AttendanceTabDay } from "../data";

import { AttendanceDayStatusBadge } from "./attendance-day-status-badge";
import { DayDetail } from "./day-detail";
import { GenerateAttendanceSheetButton } from "./generate-attendance-sheet-button";
import { MarkAllPresentButton } from "./mark-all-present-button";

/** "Monday, 21 July 2026" */
function formatLongDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

type Props = {
  experienceId: string;
  experienceSlug: string;
  day: AttendanceTabDay;
};

export function DayRow({ experienceId, experienceSlug, day }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-surface-elevated">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium text-ivory">
              Day {day.dayNumber} — {formatLongDate(day.date)}
            </p>
            <p className="text-sm text-muted-foreground">
              {day.checkedInCount} of {day.totalRegistered} checked in ({day.attendanceRate}%)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AttendanceDayStatusBadge status={day.status} />
            <MarkAllPresentButton
              experienceId={experienceId}
              experienceSlug={experienceSlug}
              date={day.date}
              eligibleCount={day.totalRegistered - day.checkedInCount}
            />
            <GenerateAttendanceSheetButton experienceId={experienceId} date={day.date} />
            <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)}>
              {expanded ? "Hide Details" : "View Details"}
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          </div>
        </div>

        {expanded && (
          <DayDetail
            experienceId={experienceId}
            experienceSlug={experienceSlug}
            date={day.date}
            participants={day.participants}
          />
        )}
      </CardContent>
    </Card>
  );
}
