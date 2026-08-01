"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { checkFacilitatorUnavailabilityForAssignment } from "@/features/facilitator-portal/actions";
import type { UnavailabilityConflict } from "@/features/facilitator-portal/data";

type Props = {
  facilitatorId?: string;
  startDate?: string;
  endDate?: string;
};

export function FacilitatorConflictWarning({ facilitatorId, startDate, endDate }: Props) {
  const [conflict, setConflict] = useState<UnavailabilityConflict | null>(null);

  useEffect(() => {
    if (!facilitatorId || !startDate || !endDate) {
      return;
    }

    let isMounted = true;
    checkFacilitatorUnavailabilityForAssignment(facilitatorId, startDate, endDate).then((res) => {
      if (isMounted) {
        setConflict(res);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [facilitatorId, startDate, endDate]);

  if (!facilitatorId || !startDate || !endDate || !conflict || !conflict.hasConflict) {
    return null;
  }

  return (
    <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span>Facilitator Availability Warning</span>
      </div>
      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
        This facilitator has {conflict.count} conflict(s) or unavailability block(s) during the selected dates.
      </p>
    </div>
  );
}
