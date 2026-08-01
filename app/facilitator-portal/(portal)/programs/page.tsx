import {
  getFacilitatorPortalSessionContext,
  getFacilitatorAssignedExperiences,
  getFacilitatorPortalStats,
} from "@/features/facilitator-portal/data";
import { ProgramsView } from "@/features/facilitator-portal/components/programs-view";

export default async function FacilitatorProgramsPage() {
  const facilitator = await getFacilitatorPortalSessionContext();
  const [experiences, stats] = await Promise.all([
    getFacilitatorAssignedExperiences(facilitator.email),
    getFacilitatorPortalStats(facilitator.email),
  ]);

  return <ProgramsView facilitatorId={facilitator.id} experiences={experiences} stats={stats} />;
}
