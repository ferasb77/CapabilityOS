"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { SurveyStatusBadge } from "@/features/surveys/components/survey-status-badge";
import type { ExperienceParticipant } from "@/features/experiences/data";
import type { ObservationTag, ParticipantObservation } from "../data";

import { saveParticipantObservation } from "../actions";

const AUTOSAVE_DELAY_MS = 2000;

function CheckedInBadge({ checkedIn }: { checkedIn: boolean }) {
  return checkedIn ? (
    <Badge variant="outline" className="border-transparent bg-emerald-500/15 text-emerald-400">
      Checked In
    </Badge>
  ) : (
    <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
      Not Checked In
    </Badge>
  );
}

function TagBadge({ tag }: { tag: ObservationTag }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
      style={{ backgroundColor: tag.color }}
    >
      {tag.label}
    </span>
  );
}

type Props = {
  experienceId: string;
  participant: ExperienceParticipant;
  allTags: ObservationTag[];
  myObservation: ParticipantObservation | null;
  otherObservations: ParticipantObservation[];
  defaultFacilitatorName: string;
};

export function ParticipantObservationSheet({
  experienceId,
  participant,
  allTags,
  myObservation,
  otherObservations,
  defaultFacilitatorName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [facilitatorName, setFacilitatorName] = useState(myObservation?.facilitatorName ?? defaultFacilitatorName);
  const [notes, setNotes] = useState(myObservation?.notes ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(myObservation?.tags ?? []);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const notesRef = useRef(notes);
  const facilitatorNameRef = useRef(facilitatorName);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  useEffect(() => {
    facilitatorNameRef.current = facilitatorName;
  }, [facilitatorName]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
    };
  }, []);

  async function persist(nextNotes: string, nextTags: string[], nextFacilitatorName: string) {
    if (!nextFacilitatorName.trim()) {
      return;
    }

    setSavingState("saving");
    setError(null);

    const result = await saveParticipantObservation(
      experienceId,
      participant.id,
      nextNotes,
      nextTags,
      nextFacilitatorName
    );

    if (!result.success) {
      setError(result.error);
      setSavingState("idle");
      return;
    }

    setSavingState("saved");
    if (savedIndicatorRef.current) clearTimeout(savedIndicatorRef.current);
    savedIndicatorRef.current = setTimeout(() => setSavingState("idle"), 3000);
  }

  function scheduleSave(overrides: { notes?: string; facilitatorName?: string }) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void persist(overrides.notes ?? notesRef.current, selectedTagIds, overrides.facilitatorName ?? facilitatorNameRef.current);
    }, AUTOSAVE_DELAY_MS);
  }

  function handleNotesChange(value: string) {
    setNotes(value);
    scheduleSave({ notes: value });
  }

  function handleFacilitatorNameChange(value: string) {
    setFacilitatorName(value);
    scheduleSave({ facilitatorName: value });
  }

  function toggleTag(tagId: string) {
    const next = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];

    setSelectedTagIds(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    void persist(notesRef.current, next, facilitatorNameRef.current);
  }

  const selectedTags = allTags.filter((tag) => selectedTagIds.includes(tag.id));
  const visibleOtherObservations = otherObservations.filter((observation) => observation.id !== myObservation?.id);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-left font-medium text-ivory underline-offset-2 hover:text-gold hover:underline"
      >
        {participant.firstName} {participant.lastName}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-xl">
              {participant.firstName} {participant.lastName}
            </SheetTitle>
            <SheetDescription>
              {[participant.company, participant.jobTitle].filter(Boolean).join(" · ") || "No company on file"}
            </SheetDescription>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <CheckedInBadge checkedIn={participant.checkedIn} />
              <SurveyStatusBadge status={participant.surveyStatus} />
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-semibold text-ivory">Observations</h3>
                <p className="text-xs text-muted-foreground">
                  {savingState === "saving" ? "Saving..." : savingState === "saved" ? "Saved" : ""}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observation-facilitator-name">Facilitator name</Label>
                <Input
                  id="observation-facilitator-name"
                  value={facilitatorName}
                  onChange={(event) => handleFacilitatorNameChange(event.target.value)}
                />
              </div>

              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTags.map((tag) => (
                    <TagBadge key={tag.id} tag={tag} />
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="observation-notes">Notes</Label>
                <Textarea
                  id="observation-notes"
                  rows={8}
                  placeholder="Record your observations about this participant..."
                  value={notes}
                  onChange={(event) => handleNotesChange(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">{notes.length} characters</p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="button" variant="outline" size="sm" onClick={() => setShowTagPicker((v) => !v)}>
                {showTagPicker ? "Hide Tags" : "Add Tags"}
              </Button>

              {showTagPicker && (
                <div className="flex flex-wrap gap-2 rounded-lg border border-border-subtle bg-night/40 p-3">
                  {allTags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tags defined for this experience yet.</p>
                  ) : (
                    allTags.map((tag) => {
                      const isSelected = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className="rounded-full px-3 py-1.5 text-sm font-medium transition-transform active:scale-95"
                          style={
                            isSelected
                              ? { backgroundColor: tag.color, color: "#fff" }
                              : { backgroundColor: "transparent", color: tag.color, border: `1.5px solid ${tag.color}` }
                          }
                        >
                          {tag.label}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {visibleOtherObservations.length > 0 && (
              <div className="space-y-3 border-t border-border-subtle pt-4">
                <h3 className="font-heading text-sm font-semibold text-ivory">Other Facilitators&apos; Observations</h3>
                <ul className="space-y-3">
                  {visibleOtherObservations.map((observation) => (
                    <li key={observation.id} className="rounded-lg border border-border-subtle bg-night/40 p-3 text-sm">
                      <p className="font-medium text-ivory">{observation.facilitatorName}</p>
                      {observation.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {allTags
                            .filter((tag) => observation.tags.includes(tag.id))
                            .map((tag) => (
                              <TagBadge key={tag.id} tag={tag} />
                            ))}
                        </div>
                      )}
                      {observation.notes && <p className="mt-2 text-muted-foreground">{observation.notes}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
