import Link from "next/link";

import { cn } from "@/lib/utils";

export const PROGRAM_TABS = [
  { key: "attendance", label: "Attendance" },
  { key: "impact", label: "Learning Impact" },
  { key: "satisfaction", label: "Satisfaction" },
  { key: "report", label: "Facilitator Report" },
] as const;

export type ProgramTabKey = (typeof PROGRAM_TABS)[number]["key"];

type Props = {
  experienceId: string;
  activeTab: ProgramTabKey;
};

export function ProgramTabs({ experienceId, activeTab }: Props) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border-subtle">
      {PROGRAM_TABS.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <Link
            key={tab.key}
            href={`/client-portal/${experienceId}?tab=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              isActive ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-ivory"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
