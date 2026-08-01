import {
  getFacilitatorPortalSessionContext,
  getFacilitatorUnavailability,
  getFacilitatorAssignedExperiences,
} from "@/features/facilitator-portal/data";
import { AvailabilityView } from "@/features/facilitator-portal/components/availability-view";

export default async function FacilitatorAvailabilityPage() {
  const facilitator = await getFacilitatorPortalSessionContext();
  const [unavailability, experiences] = await Promise.all([
    getFacilitatorUnavailability(facilitator.id),
    getFacilitatorAssignedExperiences(facilitator.email),
  ]);

  return <AvailabilityView facilitatorId={facilitator.id} unavailability={unavailability} experiences={experiences} />;
}
