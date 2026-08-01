"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FacilitatorAssignedExperience } from "../data";

import { getExperienceTone, TONE_BLOCK_CLASS } from "./experience-tone";

type Props = {
  experiences: FacilitatorAssignedExperience[];
  onSelect: (experienceId: string) => void;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function ProgramsCalendar({ experiences, onSelect }: Props) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const todayKey = toDateKey(new Date());

  const experiencesByStartDate = useMemo(() => {
    const map = new Map<string, FacilitatorAssignedExperience[]>();
    for (const experience of experiences) {
      const key = experience.startDate.slice(0, 10);
      const bucket = map.get(key) ?? [];
      bucket.push(experience);
      map.set(key, bucket);
    }
    return map;
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
            return <div key={`blank-${index}`} className="min-h-20 rounded-md" />;
          }

          const dayExperiences = experiencesByStartDate.get(cell.key) ?? [];
          const isToday = cell.key === todayKey;

          return (
            <div
              key={cell.key}
              className={cn(
                "min-h-20 rounded-md border border-transparent p-1",
                isToday && "border-gold"
              )}
            >
              <p className={cn("mb-1 text-right text-xs", isToday ? "font-semibold text-gold" : "text-muted-foreground")}>
                {cell.date.getDate()}
              </p>
              <div className="space-y-1">
                {dayExperiences.map((experience) => {
                  const tone = getExperienceTone(experience.startDate, experience.endDate);
                  return (
                    <button
                      key={experience.id}
                      type="button"
                      onClick={() => onSelect(experience.id)}
                      title={experience.title}
                      className={cn(
                        "block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium transition",
                        TONE_BLOCK_CLASS[tone]
                      )}
                    >
                      {experience.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
