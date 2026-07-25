"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttentionItem, AttentionSeverity, DashboardData } from "@/infrastructure/repositories/dashboard";

const SEVERITY_ICON: Record<AttentionSeverity, string> = {
  critical: "🔴",
  upcoming_risk: "🟠",
  follow_up: "🟡",
};

const SEVERITY_ACCENT: Record<AttentionSeverity, string> = {
  critical: "border-destructive/25",
  upcoming_risk: "border-amber-500/25",
  follow_up: "border-gold/25",
};

const VISIBLE_LIMIT = 6;

type Props = {
  attentionBySeverity: DashboardData["attentionBySeverity"];
};

export function AttentionSection({ attentionBySeverity }: Props) {
  const [expanded, setExpanded] = useState(false);

  const items: AttentionItem[] = [
    ...attentionBySeverity.critical,
    ...attentionBySeverity.upcomingRisk,
    ...attentionBySeverity.followUp,
  ];

  const visibleItems = expanded ? items : items.slice(0, VISIBLE_LIMIT);

  return (
    <Card className="border-gold/30 bg-surface-elevated">
      <CardHeader>
        <CardTitle>Attention Required</CardTitle>
        <CardDescription>
          Critical items could block delivery. Upcoming risk and follow-up items need action but aren&apos;t urgent yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-emerald-400" />
            Nothing needs your attention right now.
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {visibleItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 rounded-lg border bg-night/40 p-3 ${SEVERITY_ACCENT[item.severity]}`}
                >
                  <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden>
                    {SEVERITY_ICON[item.severity]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ivory">{item.headline}</p>
                    <p className="text-sm text-muted-foreground">{item.context}</p>
                    <Link href={item.navigationUrl} className="mt-1 inline-block text-sm font-medium text-gold hover:underline">
                      {item.actionLabel}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            {items.length > VISIBLE_LIMIT && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-3 text-sm font-medium text-gold hover:underline"
              >
                {expanded ? "Show fewer" : `View all ${items.length} →`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
