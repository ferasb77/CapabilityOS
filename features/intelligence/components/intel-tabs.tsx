import Link from "next/link";

import { cn } from "@/lib/utils";

const INTEL_TABS = [
  { key: "overview", label: "Overview", href: "/dashboard/intelligence" },
  { key: "clients", label: "Clients", href: "/dashboard/intelligence/clients" },
  { key: "facilitators", label: "Facilitators", href: "/dashboard/intelligence/facilitators" },
] as const;

export type IntelTabKey = (typeof INTEL_TABS)[number]["key"];

export function IntelTabs({ activeTab }: { activeTab: IntelTabKey }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border-subtle">
      {INTEL_TABS.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <Link
            key={tab.key}
            href={tab.href}
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
