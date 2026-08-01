"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { checkFacilitatorUnavailabilityForAssignment } from "@/features/facilitator-portal/actions";
import type { UnavailabilityConflict } from "@/features/facilitator-portal/data";

type Props = {
  facilitatorId: string;
  startDate: string;
  endDate: string;
};

function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

/**
 * "If a facilitator has an unavailability block covering the experience
 * dates, show a warning in the assignment UI" (CLAUDE.md's Sprint 34
 * brief). Non-blocking — the operator can still assign and resolve the
 * conflict with the facilitator directly.
 */
export function FacilitatorConflictWarning({ facilitatorId, startDate, endDate }: Props) {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);

  // Tagged with the (facilitatorId, start, end) it was computed for, rather
  // than reset to null on every prop change, so a stale result never
  // renders under a different selection — it simply stops matching below.
  const [result, setResult] = useState<{ facilitatorId: string; start: string; end: string; conflict: UnavailabilityConflict } | null>(
    null
  );

  useEffect(() => {
    if (!facilitatorId || !start || !end || end < start) {
      return;
    }

    let cancelled = false;
    checkFacilitatorUnavailabilityForAssignment(facilitatorId, start, end).then((conflict) => {
      if (!cancelled) setResult({ facilitatorId, start, end, conflict });
    });

    return () => {
      cancelled = true;
    };
  }, [facilitatorId, start, end]);

  const conflict =
    result && result.facilitatorId === facilitatorId && result.start === start && result.end === end
      ? result.conflict
      : null;

  if (!conflict?.hasConflict) {
    return null;
  }

  return (
    <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300 sm:col-span-2">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <p>
        This facilitator has marked themselves unavailable for {conflict.blocks.length} period
        {conflict.blocks.length === 1 ? "" : "s"} that overlap{conflict.blocks.length === 1 ? "s" : ""} these dates.
        Confirm with them before assigning.
      </p>
    </div>
  );
}
