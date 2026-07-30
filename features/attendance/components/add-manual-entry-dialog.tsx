"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DailyAttendanceParticipant } from "../data";

import { recordManualAttendance } from "../actions";

type Props = {
  experienceId: string;
  experienceSlug: string;
  date: string;
  /** Only participants not yet checked in for this date. */
  participants: DailyAttendanceParticipant[];
};

export function AddManualEntryDialog({ experienceId, experienceSlug, date, participants }: Props) {
  const [open, setOpen] = useState(false);
  const [participantId, setParticipantId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!participantId) {
      setError("Select a participant.");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await recordManualAttendance(
        experienceId,
        experienceSlug,
        participantId,
        date,
        notes.trim() || undefined
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setParticipantId("");
      setNotes("");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={participants.length === 0} />}>
        Add Manual Entry
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add manual attendance entry</DialogTitle>
          <DialogDescription>Mark a participant present who forgot to scan the QR code.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-entry-participant">Participant</Label>
            <Select
              name="participantId"
              value={participantId}
              onValueChange={(next) => setParticipantId(next ?? "")}
              items={participants.map((participant) => ({
                value: participant.participantId,
                label: `${participant.firstName} ${participant.lastName}`,
              }))}
            >
              <SelectTrigger id="manual-entry-participant" className="w-full">
                <SelectValue placeholder="Select a participant" />
              </SelectTrigger>
              <SelectContent>
                {participants.map((participant) => (
                  <SelectItem key={participant.participantId} value={participant.participantId}>
                    {participant.firstName} {participant.lastName}
                    {participant.company ? ` — ${participant.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-entry-notes">Notes</Label>
            <Textarea
              id="manual-entry-notes"
              rows={3}
              placeholder="Optional"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "Saving..." : "Mark Present"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
