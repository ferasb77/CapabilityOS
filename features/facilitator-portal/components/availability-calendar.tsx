"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FacilitatorAssignedExperience } from "../data";
import type { FacilitatorUnavailabilityBlock } from "../data";

type Props = {
  unavailability: FacilitatorUnavailabilityBlock[];
  experiences: FacilitatorAssignedExperience[];
  onSelectDate: (dateKey: string) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function AvailabilityCalendar({ unavailability, experiences, onSelectDate }: Props) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const todayKey = toDateKey(new Date());

  const unavailableByDate = useMemo(() => {
    const map = new Map<string, FacilitatorUnavailabilityBlock>();
    for (const block of unavailability) {
      let cursorDate = new Date(`${block.startDate}T00:00:00`);
      const end = new Date(`${block.endDate}T00:00:00`);
      while (cursorDate <= end) {
        map.set(toDateKey(cursorDate), block);
        cursorDate = new Date(cursorDate.getTime() + 24 * 60 * 60 * 1000);
      }
    }
    return map;
  }, [unavailability]);

  const experienceDates = useMemo(() => {
    const set = new Set<string>();
    for (const experience of experiences) {
      let cursorDate = new Date(`${experience.startDate}T00:00:00`);
      const end = new Date(`${experience.endDate}T00:00:00`);
      while (cursorDate <= end) {
        set.add(toDateKey(cursorDate));
        cursorDate = new Date(cursorDate.getTime() + 24 * 60 * 60 * 1000);
      }
    }
    return set;
  }, [experiences]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();

  const cells: { date: Date | null; key: string | null }[] = [];
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push({ date: null, key: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({ date, key: toDateKey(date) });
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-elevated p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold text-ivory">
          {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-ivory"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-ivory"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1.5">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell.date || !cell.key) {
            return <div key={`blank-${index}`} className="aspect-square rounded-md" />;
          }

          const block = unavailableByDate.get(cell.key);
          const hasExperience = experienceDates.has(cell.key);
          const isToday = cell.key === todayKey;

          return (
            <button
              key={cell.key}
              type="button"
              disabled={Boolean(block)}
              title={block?.reason ?? undefined}
              onClick={() => onSelectDate(cell.key!)}
              className={cn(
                "relative aspect-square rounded-md border text-sm transition",
                block
                  ? "cursor-default border-destructive/30 bg-destructive/15 text-destructive-foreground"
                  : "border-border-subtle bg-night/20 text-ivory hover:border-gold/50 hover:bg-night/40",
                isToday && "border-gold"
              )}
            >
              <span className={cn(isToday && "font-semibold text-gold")}>{cell.date.getDate()}</span>
              {hasExperience && (
                <span className="absolute right-1 bottom-1 size-1.5 rounded-full bg-gold" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-border-subtle bg-night/20" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive/40" /> Unavailable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-gold" /> Assigned program
        </span>
      </div>
    </div>
  );
}
