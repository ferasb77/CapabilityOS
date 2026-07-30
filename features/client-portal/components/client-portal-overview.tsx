import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ExperienceStatusBadge } from "@/features/dashboard/components/experience-status-badge";
import type { ClientOverview, ClientProgramSummary } from "../data";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (startDate.toDateString() === endDate.toDateString()) {
    return formatDate(start);
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function scoreColorClass(score: number): string {
  if (score >= 4.0) return "text-emerald-400";
  if (score >= 3.0) return "text-amber-400";
  return "text-destructive";
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-night/40 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-3xl font-semibold text-gold">{value}</p>
    </div>
  );
}

function ProgramCard({ program }: { program: ClientProgramSummary }) {
  return (
    <Link href={`/client-portal/${program.id}`} className="block">
      <Card className="bg-surface-elevated transition-colors hover:border-gold/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-ivory">{program.title}</p>
              <ExperienceStatusBadge status={program.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                {formatDateRange(program.startDate, program.endDate)}
              </span>
              {program.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {program.venue}
                </span>
              )}
              <span>{program.participantCount} participants</span>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-muted-foreground">Satisfaction</p>
            <p
              className={`font-heading text-xl font-semibold ${
                program.satisfactionScore !== null ? scoreColorClass(program.satisfactionScore) : "text-muted-foreground"
              }`}
            >
              {program.satisfactionScore !== null ? `${program.satisfactionScore.toFixed(1)}/5` : "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

type EngagementGroup = { engagementTitle: string; programs: ClientProgramSummary[] };

function groupByEngagement(programs: ClientProgramSummary[]): EngagementGroup[] {
  const groups: EngagementGroup[] = [];
  const indexByTitle = new Map<string, number>();

  for (const program of programs) {
    const title = program.engagementTitle ?? "Other Programs";
    let index = indexByTitle.get(title);

    if (index === undefined) {
      index = groups.length;
      groups.push({ engagementTitle: title, programs: [] });
      indexByTitle.set(title, index);
    }

    groups[index].programs.push(program);
  }

  return groups;
}

type Props = {
  overview: ClientOverview;
};

export function ClientPortalOverview({ overview }: Props) {
  const groups = groupByEngagement(overview.programs);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Programs Delivered" value={String(overview.totalPrograms)} />
        <MetricCard label="Participants Trained" value={String(overview.totalParticipants)} />
        <MetricCard
          label="Average Satisfaction"
          value={overview.averageSatisfaction !== null ? `${overview.averageSatisfaction.toFixed(1)}/5` : "—"}
        />
        <MetricCard label="Active Programs" value={String(overview.activePrograms)} />
      </div>

      {overview.programs.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No programs have been delivered yet.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.engagementTitle} className="space-y-3">
              <h2 className="font-heading text-lg font-semibold text-ivory">{group.engagementTitle}</h2>
              <div className="space-y-3">
                {group.programs.map((program) => (
                  <ProgramCard key={program.id} program={program} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
