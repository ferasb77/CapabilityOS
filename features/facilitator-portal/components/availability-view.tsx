"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FacilitatorAssignedExperience, FacilitatorUnavailabilityBlock } from "../data";

import { AddUnavailabilityDialog } from "./add-unavailability-dialog";
import { AvailabilityCalendar } from "./availability-calendar";
import { UnavailabilityList } from "./unavailability-list";

type Props = {
  facilitatorId: string;
  unavailability: FacilitatorUnavailabilityBlock[];
  experiences: FacilitatorAssignedExperience[];
};

export function AvailabilityView({ facilitatorId, unavailability, experiences }: Props) {
  const router = useRouter();
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <AvailabilityCalendar unavailability={unavailability} experiences={experiences} onSelectDate={setPendingDate} />

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Unavailability</CardTitle>
        </CardHeader>
        <CardContent>
          <UnavailabilityList blocks={unavailability} />
        </CardContent>
      </Card>

      <AddUnavailabilityDialog
        facilitatorId={facilitatorId}
        startDate={pendingDate}
        onClose={() => setPendingDate(null)}
        onSaved={() => {
          setPendingDate(null);
          router.refresh();
        }}
      />
    </div>
  );
}
