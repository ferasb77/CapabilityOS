import { getExperienceParticipants, getExperienceSurveyResults } from "@/features/experiences/data";

import {
  getAllExperienceObservations,
  getAllParticipantObservations,
  getExperienceContextForReport,
  getObservationTags,
} from "./data";

// ---------------------------------------------------------------------------
// AI report context — assembled server-side, never sent anywhere but the
// Anthropic call in actions.ts. Participant identity is deliberately
// stripped here (not just "don't mention it in the prompt instructions") —
// each participant with at least one observation becomes "Participant A",
// "Participant B", etc., in order of first appearance, so there is no
// participant name anywhere in what the model receives.
// ---------------------------------------------------------------------------

export type AnonymizedParticipantContext = {
  label: string;
  tags: string[];
  notes: string[];
};

export type FacilitatorReportContext = {
  experienceTitle: string;
  clientName: string | null;
  venue: string | null;
  startDate: string;
  endDate: string;
  facilitatorName: string | null;
  totalParticipants: number;
  checkedInCount: number;
  satisfactionAverages: {
    content: number | null;
    facilitator: number | null;
    logistics: number | null;
    overall: number | null;
  };
  overallObservations: {
    groupDynamics: string | null;
    keyThemes: string | null;
    recommendations: string | null;
    generalNotes: string | null;
  }[];
  participants: AnonymizedParticipantContext[];
};

export async function buildFacilitatorReportContext(experienceId: string): Promise<FacilitatorReportContext | null> {
  const [experience, participants, surveyResults, tags, participantObservations, overallObservations] =
    await Promise.all([
      getExperienceContextForReport(experienceId),
      getExperienceParticipants(experienceId),
      getExperienceSurveyResults(experienceId),
      getObservationTags(experienceId),
      getAllParticipantObservations(experienceId),
      getAllExperienceObservations(experienceId),
    ]);

  if (!experience) {
    return null;
  }

  const tagLabelById = new Map(tags.map((tag) => [tag.id, tag.label]));

  const observationsByParticipantId = new Map<string, { tagIds: Set<string>; notes: string[] }>();
  for (const observation of participantObservations) {
    const bucket = observationsByParticipantId.get(observation.participantId) ?? {
      tagIds: new Set<string>(),
      notes: [],
    };
    for (const tagId of observation.tags) {
      bucket.tagIds.add(tagId);
    }
    if (observation.notes && observation.notes.trim()) {
      bucket.notes.push(observation.notes.trim());
    }
    observationsByParticipantId.set(observation.participantId, bucket);
  }

  // Order of first appearance in the participants list — deterministic and
  // never dependent on anything participant-identifying.
  const anonymized: AnonymizedParticipantContext[] = [];
  let letterIndex = 0;
  for (const participant of participants) {
    const bucket = observationsByParticipantId.get(participant.id);
    if (!bucket || (bucket.tagIds.size === 0 && bucket.notes.length === 0)) {
      continue;
    }

    anonymized.push({
      label: `Participant ${String.fromCharCode(65 + letterIndex)}`,
      tags: [...bucket.tagIds].map((id) => tagLabelById.get(id) ?? id),
      notes: bucket.notes,
    });
    letterIndex += 1;
  }

  return {
    experienceTitle: experience.title,
    clientName: experience.clientName,
    venue: experience.venue,
    startDate: experience.startDate,
    endDate: experience.endDate,
    facilitatorName: experience.facilitatorName,
    totalParticipants: participants.length,
    checkedInCount: participants.filter((participant) => participant.checkedIn).length,
    satisfactionAverages: surveyResults.averages,
    overallObservations: overallObservations.map((observation) => ({
      groupDynamics: observation.groupDynamics,
      keyThemes: observation.keyThemes,
      recommendations: observation.recommendations,
      generalNotes: observation.generalNotes,
    })),
    participants: anonymized,
  };
}
