import {
  getFacilitatorPortalSessionContext,
  getFacilitatorAssignedExperiences,
  getFacilitatorPortalStats,
} from "@/features/facilitator-portal/data";
import { ProgramsView } from "@/features/facilitator-portal/components/programs-view";

export default async function FacilitatorProgramsPage() {
  const facilitator = await getFacilitatorPortalSessionContext();
  const experiences = await getFacilitatorAssignedExperiences(facilitator.email);
  const stats = await getFacilitatorPortalStats(facilitator.email);

  return (
    <ProgramsView
      experiences={experiences}
      stats={stats}
      facilitatorEmail={facilitator.email}
    />
  );
}
