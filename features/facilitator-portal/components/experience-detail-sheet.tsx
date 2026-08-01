"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ExperienceStatus } from "@/infrastructure/repositories/dashboard";

import { getFacilitatorExperienceDetailForPortal } from "../actions";
import type { FacilitatorExperienceDetail } from "../data";

const STATUS_LABEL: Record<ExperienceStatus, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "materials", label: "Materials" },
  { id: "observations", label: "Observations" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric" };
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (start === end) {
    return startDate.toLocaleDateString("en-US", opts);
  }
  return `${startDate.toLocaleDateString("en-US", opts)} – ${endDate.toLocaleDateString("en-US", opts)}`;
}

type BodyProps = { experienceId: string; facilitatorId: string };

/**
 * Remounted (via `key={experienceId}` in ExperienceDetailSheet below) every
 * time a different program is selected, so `detail`/`loading`/`activeTab`
 * all start fresh from their useState initializers — no effect-based reset
 * needed, and the fetch effect only ever sets state from its async result.
 */
function ExperienceDetailBody({ experienceId, facilitatorId }: BodyProps) {
  const [detail, setDetail] = useState<FacilitatorExperienceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    let cancelled = false;
    getFacilitatorExperienceDetailForPortal(experienceId).then((result) => {
      if (!cancelled) {
        setDetail(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [experienceId]);

  return (
    <>
      <SheetHeader>
        <SheetTitle>{detail?.title ?? (loading ? "Loading…" : "Program")}</SheetTitle>
        {detail && (
          <SheetDescription>
            {detail.clientName ?? "—"}
            {detail.engagementTitle ? ` · ${detail.engagementTitle}` : ""}
          </SheetDescription>
        )}
      </SheetHeader>

      {loading && <p className="px-4 text-sm text-muted-foreground">Loading program details…</p>}

      {!loading && detail && (
        <div className="flex-1 space-y-4 overflow-y-auto px-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{STATUS_LABEL[detail.status]}</Badge>
            <span className="text-sm text-muted-foreground">{formatDateRange(detail.startDate, detail.endDate)}</span>
          </div>

          {detail.venue && <p className="text-sm text-muted-foreground">{detail.venue}</p>}

          <div className="flex border-b border-border-subtle">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3 py-2 text-sm font-medium transition",
                  activeTab === tab.id ? "border-b-2 border-gold text-gold" : "text-muted-foreground hover:text-ivory"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border-subtle bg-night/40 p-3">
                <p className="text-xs text-muted-foreground">Participants</p>
                <p className="text-lg font-semibold text-ivory">{detail.participantCount}</p>
              </div>
              <div className="rounded-lg border border-border-subtle bg-night/40 p-3">
                <p className="text-xs text-muted-foreground">Check-in rate</p>
                <p className="text-lg font-semibold text-ivory">{detail.checkInRate}%</p>
              </div>
              <div className="col-span-2 rounded-lg border border-border-subtle bg-night/40 p-3">
                <p className="text-xs text-muted-foreground">Satisfaction score</p>
                <p className="text-lg font-semibold text-ivory">
                  {detail.satisfactionScore !== null ? `${detail.satisfactionScore} / 5` : "Not available yet"}
                </p>
              </div>
            </div>
          )}

          {activeTab === "materials" && (
            <div className="rounded-lg border border-border-subtle bg-night/40 p-4">
              <p className="mb-3 text-sm text-muted-foreground">Upload and review facilitator materials for this program.</p>
              <Link
                href={`/facilitator/${facilitatorId}/materials/${detail.slug}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:text-gold/80"
              >
                Open materials folder
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          )}

          {activeTab === "observations" && (
            <div className="rounded-lg border border-border-subtle bg-night/40 p-4">
              <p className="mb-3 text-sm text-muted-foreground">
                Review participant observations and the facilitator report for this program.
              </p>
              <Link
                href={`/facilitator-portal/programs/${detail.id}/observations`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:text-gold/80"
              >
                Open observations
                <ExternalLink className="size-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {!loading && !detail && <p className="px-4 text-sm text-muted-foreground">Unable to load this program.</p>}
    </>
  );
}

type Props = {
  experienceId: string | null;
  facilitatorId: string;
  onOpenChange: (open: boolean) => void;
};

export function ExperienceDetailSheet({ experienceId, facilitatorId, onOpenChange }: Props) {
  return (
    <Sheet open={Boolean(experienceId)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {experienceId && <ExperienceDetailBody key={experienceId} experienceId={experienceId} facilitatorId={facilitatorId} />}
      </SheetContent>
    </Sheet>
  );
}
