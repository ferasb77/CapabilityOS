"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, List as ListIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FacilitatorAssignedExperience } from "../data";

import { ExperienceDetailSheet } from "./experience-detail-sheet";
import { ProgramsCalendar } from "./programs-calendar";
import { ProgramsList } from "./programs-list";

type Stats = {
  totalAssigned: number;
  upcomingNext30Days: number;
  completedThisYear: number;
  averageSatisfaction: number | null;
};

type Props = {
  facilitatorId: string;
  experiences: FacilitatorAssignedExperience[];
  stats: Stats;
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-surface-elevated">
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-ivory">{value}</p>
      </CardContent>
    </Card>
  );
}

export function ProgramsView({ facilitatorId, experiences, stats }: Props) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [selectedExperienceId, setSelectedExperienceId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Assigned" value={String(stats.totalAssigned)} />
        <StatCard label="Upcoming (30 days)" value={String(stats.upcomingNext30Days)} />
        <StatCard label="Completed This Year" value={String(stats.completedThisYear)} />
        <StatCard
          label="Avg. Satisfaction"
          value={stats.averageSatisfaction !== null ? `${stats.averageSatisfaction} / 5` : "—"}
        />
      </div>

      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant={view === "calendar" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setView("calendar")}
        >
          <CalendarIcon className="size-4" />
          Calendar
        </Button>
        <Button type="button" variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")}>
          <ListIcon className="size-4" />
          List
        </Button>
      </div>

      {view === "calendar" ? (
        <ProgramsCalendar experiences={experiences} onSelect={setSelectedExperienceId} />
      ) : (
        <ProgramsList experiences={experiences} onSelect={setSelectedExperienceId} />
      )}

      <ExperienceDetailSheet
        experienceId={selectedExperienceId}
        facilitatorId={facilitatorId}
        onOpenChange={(open) => {
          if (!open) setSelectedExperienceId(null);
        }}
      />
    </div>
  );
}
