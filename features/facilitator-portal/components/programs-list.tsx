import { Badge } from "@/components/ui/badge";
import type { ExperienceStatus } from "@/infrastructure/repositories/dashboard";
import type { FacilitatorAssignedExperience } from "../data";

import { getExperienceTone, TONE_DOT_CLASS } from "./experience-tone";

type Props = {
  experiences: FacilitatorAssignedExperience[];
  onSelect: (experienceId: string) => void;
};

const STATUS_LABEL: Record<ExperienceStatus, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isThisMonth(startDate: string): boolean {
  const today = new Date();
  const start = new Date(`${startDate}T00:00:00`);
  return start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth();
}

function groupExperiences(experiences: FacilitatorAssignedExperience[]) {
  const today = todayIso();
  const groups = { upcoming: [] as FacilitatorAssignedExperience[], thisMonth: [] as FacilitatorAssignedExperience[], past: [] as FacilitatorAssignedExperience[] };

  for (const experience of experiences) {
    if (experience.endDate < today) {
      groups.past.push(experience);
    } else if (isThisMonth(experience.startDate)) {
      groups.thisMonth.push(experience);
    } else {
      groups.upcoming.push(experience);
    }
  }

  return groups;
}

function ExperienceRow({ experience, onSelect }: { experience: FacilitatorAssignedExperience; onSelect: (id: string) => void }) {
  const tone = getExperienceTone(experience.startDate, experience.endDate);

  return (
    <button
      type="button"
      onClick={() => onSelect(experience.id)}
      className="grid w-full grid-cols-2 items-center gap-x-3 gap-y-1 rounded-lg border border-border-subtle bg-night/40 p-3 text-left transition hover:border-gold/40 sm:grid-cols-6"
    >
      <span className="flex items-center gap-2 text-sm text-ivory">
        <span className={`size-1.5 shrink-0 rounded-full ${TONE_DOT_CLASS[tone]}`} aria-hidden />
        {formatDate(experience.startDate)}
      </span>
      <span className="col-span-2 truncate text-sm font-medium text-ivory sm:col-span-2">{experience.title}</span>
      <span className="truncate text-sm text-muted-foreground">{experience.clientName ?? "—"}</span>
      <span className="truncate text-sm text-muted-foreground">{experience.venue ?? "—"}</span>
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{experience.participantCount} participants</span>
        <Badge variant="outline">{STATUS_LABEL[experience.status]}</Badge>
      </span>
    </button>
  );
}

function Group({ title, experiences, onSelect }: { title: string; experiences: FacilitatorAssignedExperience[]; onSelect: (id: string) => void }) {
  if (experiences.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="space-y-2">
        {experiences.map((experience) => (
          <ExperienceRow key={experience.id} experience={experience} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export function ProgramsList({ experiences, onSelect }: Props) {
  const groups = groupExperiences(experiences);

  if (experiences.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No assigned programs yet.</p>;
  }

  return (
    <div className="space-y-6">
      <Group title="This Month" experiences={groups.thisMonth} onSelect={onSelect} />
      <Group title="Upcoming" experiences={groups.upcoming} onSelect={onSelect} />
      <Group title="Past" experiences={groups.past} onSelect={onSelect} />
    </div>
  );
}
