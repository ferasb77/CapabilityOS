"use client";

import { useState, useTransition } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExperienceParticipant } from "@/features/experiences/data";
import type { ObservationTag, ParticipantObservation } from "../data";

import { saveParticipantObservation } from "../actions";
import { ParticipantObservationSheet } from "./participant-observation-sheet";

type Props = {
  experienceId: string;
  participants: ExperienceParticipant[];
  observationTags: ObservationTag[];
  observations: ParticipantObservation[];
  defaultFacilitatorName: string;
};

function QuickTagChip({
  tag,
  selected,
  onToggle,
}: {
  tag: ObservationTag;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-full px-2.5 py-1 text-xs font-medium transition-transform active:scale-95"
      style={
        selected
          ? { backgroundColor: tag.color, color: "#fff" }
          : { backgroundColor: "transparent", color: tag.color, border: `1px solid ${tag.color}` }
      }
    >
      {tag.label}
    </button>
  );
}

export function ParticipantObservationsSummary({
  experienceId,
  participants,
  observationTags,
  observations,
  defaultFacilitatorName,
}: Props) {
  // Optimistic local copy of "my" tags per participant — the source of
  // truth for quick-add stays the same saveParticipantObservation action
  // the full panel uses; this just avoids waiting on a full page refresh to
  // see a toggle reflected.
  const [myTagsByParticipantId, setMyTagsByParticipantId] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const observation of observations) {
      if (observation.facilitatorName === defaultFacilitatorName) {
        map[observation.participantId] = observation.tags;
      }
    }
    return map;
  });
  const [, startTransition] = useTransition();

  const observationsByParticipantId = new Map<string, ParticipantObservation[]>();
  for (const observation of observations) {
    const bucket = observationsByParticipantId.get(observation.participantId) ?? [];
    bucket.push(observation);
    observationsByParticipantId.set(observation.participantId, bucket);
  }

  function allTagsFor(participantId: string): ObservationTag[] {
    const own = myTagsByParticipantId[participantId] ?? [];
    const others = (observationsByParticipantId.get(participantId) ?? []).flatMap((o) => o.tags);
    const union = new Set([...own, ...others]);
    return observationTags.filter((tag) => union.has(tag.id));
  }

  function hasObservation(participantId: string): boolean {
    const own = myTagsByParticipantId[participantId];
    if (own && own.length > 0) return true;
    return (observationsByParticipantId.get(participantId) ?? []).length > 0;
  }

  function toggleQuickTag(participant: ExperienceParticipant, tagId: string) {
    const current = myTagsByParticipantId[participant.id] ?? [];
    const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId];

    setMyTagsByParticipantId((prev) => ({ ...prev, [participant.id]: next }));

    const mine = observationsByParticipantId
      .get(participant.id)
      ?.find((o) => o.facilitatorName === defaultFacilitatorName);

    startTransition(async () => {
      await saveParticipantObservation(
        experienceId,
        participant.id,
        mine?.notes ?? "",
        next,
        defaultFacilitatorName
      );
    });
  }

  const sorted = [...participants].sort((a, b) => {
    const aHas = hasObservation(a.id);
    const bHas = hasObservation(b.id);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
  });

  const observedCount = participants.filter((p) => hasObservation(p.id)).length;

  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Participant Observations Summary</CardTitle>
        <CardDescription>
          {observedCount} of {participants.length} participants have observations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {participants.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No participants registered yet.</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((participant) => {
              const mine = myTagsByParticipantId[participant.id] ?? [];
              const observationsForRow = observationsByParticipantId.get(participant.id) ?? [];
              const mineObservation =
                observationsForRow.find((o) => o.facilitatorName === defaultFacilitatorName) ?? null;
              const otherObservations = observationsForRow;

              return (
                <li
                  key={participant.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-night/40 p-3"
                >
                  <div className="min-w-40">
                    <ParticipantObservationSheet
                      experienceId={experienceId}
                      participant={participant}
                      allTags={observationTags}
                      myObservation={mineObservation}
                      otherObservations={otherObservations}
                      defaultFacilitatorName={defaultFacilitatorName}
                    />
                    {participant.company && <p className="text-xs text-muted-foreground">{participant.company}</p>}
                  </div>

                  {allTagsFor(participant.id).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Tags:</span>
                      {allTagsFor(participant.id).map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Quick add:</span>
                    {observationTags.map((tag) => (
                      <QuickTagChip
                        key={tag.id}
                        tag={tag}
                        selected={mine.includes(tag.id)}
                        onToggle={() => toggleQuickTag(participant, tag.id)}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
