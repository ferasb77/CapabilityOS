import Link from "next/link";

import { cn } from "@/lib/utils";

export const ENGAGEMENT_TABS = [
  { key: "overview", label: "Overview" },
  { key: "financial", label: "Financial" },
] as const;

export type EngagementTabKey = (typeof ENGAGEMENT_TABS)[number]["key"];

type Props = {
  clientId: string;
  engagementId: string;
  activeTab: EngagementTabKey;
};

export function EngagementTabs({ clientId, engagementId, activeTab }: Props) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border-subtle">
      {ENGAGEMENT_TABS.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <Link
            key={tab.key}
            href={`/dashboard/clients/${clientId}/engagements/${engagementId}?tab=${tab.key}`}
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
