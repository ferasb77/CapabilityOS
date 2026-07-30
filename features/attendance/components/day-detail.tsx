"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { DailyAttendanceParticipant } from "../data";

import { AddManualEntryDialog } from "./add-manual-entry-dialog";

type SortKey = "time" | "name" | "company";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "time", label: "Check-in time" },
  { key: "name", label: "Name" },
  { key: "company", label: "Company" },
];

const METHOD_LABEL: Record<NonNullable<DailyAttendanceParticipant["checkInMethod"]>, string> = {
  qr: "QR",
  manual: "Manual",
  self_report: "Self-Reported",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function sortParticipants(participants: DailyAttendanceParticipant[], sortKey: SortKey): DailyAttendanceParticipant[] {
  const list = [...participants];

  if (sortKey === "name") {
    list.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  } else if (sortKey === "company") {
    list.sort((a, b) => (a.company ?? "").localeCompare(b.company ?? ""));
  } else {
    list.sort((a, b) => {
      if (!a.checkedInAt && !b.checkedInAt) return 0;
      if (!a.checkedInAt) return 1;
      if (!b.checkedInAt) return -1;
      return a.checkedInAt.localeCompare(b.checkedInAt);
    });
  }

  return list;
}

type Props = {
  experienceId: string;
  experienceSlug: string;
  date: string;
  participants: DailyAttendanceParticipant[];
};

export function DayDetail({ experienceId, experienceSlug, date, participants }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("time");

  const sorted = useMemo(() => sortParticipants(participants, sortKey), [participants, sortKey]);
  const notCheckedIn = useMemo(() => participants.filter((participant) => !participant.checkedIn), [participants]);

  return (
    <div className="space-y-3 border-t border-border-subtle pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort by:</span>
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.key}
              type="button"
              variant={sortKey === option.key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSortKey(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <AddManualEntryDialog
          experienceId={experienceId}
          experienceSlug={experienceSlug}
          date={date}
          participants={notCheckedIn}
        />
      </div>

      {sorted.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No participants registered.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((participant) => (
            <li
              key={participant.participantId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-night/40 px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium text-ivory">
                  {participant.firstName} {participant.lastName}
                </p>
                {participant.company && <p className="text-xs text-muted-foreground">{participant.company}</p>}
              </div>

              <div className="text-right">
                {participant.checkedIn && participant.checkedInAt ? (
                  <>
                    <p className="text-gold">{formatTime(participant.checkedInAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      {participant.checkInMethod ? METHOD_LABEL[participant.checkInMethod] : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Not checked in</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
