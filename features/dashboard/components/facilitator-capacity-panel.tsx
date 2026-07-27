import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AvailabilityBadge } from "@/features/facilitators/components/availability-badge";
import type { AvailabilityStatus } from "@/features/facilitators/data";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/infrastructure/repositories/dashboard";

const KNOWN_STATUSES: readonly AvailabilityStatus[] = ["available", "partially_available", "unavailable"];

function isKnownStatus(status: string): status is AvailabilityStatus {
  return (KNOWN_STATUSES as readonly string[]).includes(status);
}

export function FacilitatorCapacityPanel({ capacity }: { capacity: DashboardData["facilitatorCapacity"] }) {
  return (
    <Card className="flex h-full flex-col bg-surface-elevated">
      <CardHeader>
        <CardTitle>Facilitator Capacity</CardTitle>
        <p className="text-sm text-muted-foreground">Next 30 days</p>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
          <div>
            <p className="text-xl font-semibold text-gold">{capacity.totalUpcoming}</p>
            <p className="text-xs text-muted-foreground">Experiences</p>
          </div>
          <div>
            <p className="text-xl font-semibold text-gold">{capacity.assigned}</p>
            <p className="text-xs text-muted-foreground">Assigned</p>
          </div>
          <div>
            <p className={cn("text-xl font-semibold", capacity.unassigned > 0 ? "text-destructive" : "text-gold")}>
              {capacity.unassigned}
            </p>
            <p className="text-xs text-muted-foreground">Unassigned</p>
          </div>
        </div>

        {capacity.highWorkloadCount > 0 && (
          <p className="text-xs text-amber-400">
            {capacity.highWorkloadCount} facilitator{capacity.highWorkloadCount === 1 ? "" : "s"} with 4+ experiences —
            high workload
          </p>
        )}

        <ul className="space-y-2">
          {capacity.topFacilitators.map((facilitator) => (
            <li
              key={facilitator.id ?? facilitator.name}
              className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-night/40 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ivory">{facilitator.name}</p>
                <p className="text-xs text-muted-foreground">
                  {facilitator.upcomingCount} upcoming experience{facilitator.upcomingCount === 1 ? "" : "s"}
                  {facilitator.highWorkload ? " · high workload" : ""}
                </p>
              </div>
              {isKnownStatus(facilitator.availabilityStatus) ? (
                <AvailabilityBadge status={facilitator.availabilityStatus} />
              ) : (
                <Badge variant="secondary">Unknown</Badge>
              )}
            </li>
          ))}
          {capacity.topFacilitators.length === 0 && (
            <p className="py-2 text-center text-sm text-muted-foreground">No facilitators assigned in this window.</p>
          )}
        </ul>
      </CardContent>
      <CardFooter>
        <Link href="/dashboard/facilitators" className="text-sm font-medium text-gold hover:underline">
          View facilitator directory →
        </Link>
      </CardFooter>
    </Card>
  );
}
