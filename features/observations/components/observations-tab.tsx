import type { ExperienceParticipant } from "@/features/experiences/data";
import type { ExperienceObservation, FacilitatorReport, ObservationTag, ParticipantObservation } from "../data";

import { ExperienceObservationForm } from "./experience-observation-form";
import { GenerateReportSection } from "./generate-report-section";
import { ManageTagsPanel } from "./manage-tags-panel";
import { ParticipantObservationsSummary } from "./participant-observations-summary";

type Props = {
  experienceId: string;
  observationTags: ObservationTag[];
  participants: ExperienceParticipant[];
  participantObservations: ParticipantObservation[];
  myExperienceObservation: ExperienceObservation | null;
  defaultFacilitatorName: string;
  initialReport: FacilitatorReport | null;
};

export function ObservationsTab({
  experienceId,
  observationTags,
  participants,
  participantObservations,
  myExperienceObservation,
  defaultFacilitatorName,
  initialReport,
}: Props) {
  return (
    <div className="space-y-6">
      <ManageTagsPanel experienceId={experienceId} initialTags={observationTags} />

      <ExperienceObservationForm
        experienceId={experienceId}
        initialObservation={myExperienceObservation}
        defaultFacilitatorName={defaultFacilitatorName}
      />

      <ParticipantObservationsSummary
        experienceId={experienceId}
        participants={participants}
        observationTags={observationTags}
        observations={participantObservations}
        defaultFacilitatorName={defaultFacilitatorName}
      />

      <GenerateReportSection experienceId={experienceId} initialReport={initialReport} />
    </div>
  );
}
