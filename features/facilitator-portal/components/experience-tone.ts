export type ExperienceTone = "upcoming" | "current" | "past";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Upcoming (gold) / current (green) / past (muted gray) — purely date-driven,
 * independent of the record's own status field, per the My Programs brief. */
export function getExperienceTone(startDate: string, endDate: string): ExperienceTone {
  const today = todayIso();

  if (startDate <= today && today <= endDate) {
    return "current";
  }

  if (startDate > today) {
    return "upcoming";
  }

  return "past";
}

export const TONE_DOT_CLASS: Record<ExperienceTone, string> = {
  upcoming: "bg-gold",
  current: "bg-emerald-400",
  past: "bg-muted-foreground/50",
};

export const TONE_BLOCK_CLASS: Record<ExperienceTone, string> = {
  upcoming: "bg-gold/20 text-gold border-gold/40 hover:bg-gold/30",
  current: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30",
  past: "bg-muted text-muted-foreground border-border-subtle hover:bg-muted/70",
};
