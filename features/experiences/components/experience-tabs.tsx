import Link from "next/link";

import { cn } from "@/lib/utils";

export const EXPERIENCE_TABS = [
  { key: "participants", label: "Participants" },
  { key: "survey", label: "Survey Results" },
  { key: "logistics", label: "Logistics" },
  { key: "surveys", label: "Surveys" },
  { key: "impact", label: "Learning Impact" },
  { key: "certificates", label: "Certificates" },
  { key: "materials", label: "Materials" },
  { key: "assets", label: "Assets" },
] as const;

export type ExperienceTabKey = (typeof EXPERIENCE_TABS)[number]["key"];

type Props = {
  slug: string;
  activeTab: ExperienceTabKey;
};

export function ExperienceTabs({ slug, activeTab }: Props) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border-subtle">
      {EXPERIENCE_TABS.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <Link
            key={tab.key}
            href={`/dashboard/experiences/${slug}?tab=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              isActive
                ? "border-gold text-gold"
                : "border-transparent text-muted-foreground hover:text-ivory"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
