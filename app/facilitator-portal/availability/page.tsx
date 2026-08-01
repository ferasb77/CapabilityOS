import {
  getFacilitatorPortalSessionContext,
  getFacilitatorUnavailability,
  getFacilitatorAssignedExperiences,
} from "@/features/facilitator-portal/data";
import { AvailabilityCalendar } from "@/features/facilitator-portal/components/availability-calendar";

export default async function FacilitatorAvailabilityPage() {
  const facilitator = await getFacilitatorPortalSessionContext();
  const unavailabilityBlocks = await getFacilitatorUnavailability(facilitator.id);
  const assignedExperiences = await getFacilitatorAssignedExperiences(facilitator.email);

  return (
    <AvailabilityCalendar
      facilitatorId={facilitator.id}
      unavailabilityBlocks={unavailabilityBlocks}
      assignedExperiences={assignedExperiences}
    />
  );
}
