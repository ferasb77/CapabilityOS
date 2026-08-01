"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { addUnavailability, checkUnavailabilityConflict } from "../actions";
import type { AvailabilityConflict } from "../data";

type FormProps = {
  facilitatorId: string;
  initialStartDate: string;
  onClose: () => void;
  onSaved: () => void;
};

/**
 * Remounted (via `key={startDate}` in AddUnavailabilityDialog below) every
 * time a new date is clicked on the calendar, so every field starts fresh
 * from its useState initializer — no effect-based reset needed.
 */
function UnavailabilityForm({ facilitatorId, initialStartDate, onClose, onSaved }: FormProps) {
  const [start, setStart] = useState(initialStartDate);
  const [end, setEnd] = useState(initialStartDate);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Tagged with the (start, end) it was computed for, rather than reset to
  // null on every keystroke, so a stale result never renders under a
  // different range — it simply stops matching below.
  const [result, setResult] = useState<{ start: string; end: string; conflict: AvailabilityConflict } | null>(null);

  useEffect(() => {
    if (!start || !end || end < start) {
      return;
    }

    let cancelled = false;
    checkUnavailabilityConflict(facilitatorId, start, end).then((conflict) => {
      if (!cancelled) setResult({ start, end, conflict });
    });

    return () => {
      cancelled = true;
    };
  }, [facilitatorId, start, end]);

  const conflict = result && result.start === start && result.end === end ? result.conflict : null;

  function handleSave() {
    setError(null);

    if (!start || !end) {
      setError("Choose a start and end date.");
      return;
    }

    if (end < start) {
      setError("End date must be on or after the start date.");
      return;
    }

    startTransition(async () => {
      const saveResult = await addUnavailability(facilitatorId, start, end, reason.trim() || undefined);
      if (!saveResult.success) {
        setError(saveResult.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Mark unavailable</DialogTitle>
        <DialogDescription>Block a date range so coordinators know you&apos;re not available.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="unavailability-start">Start date</Label>
            <Input id="unavailability-start" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unavailability-end">End date</Label>
            <Input id="unavailability-end" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unavailability-reason">Reason (optional)</Label>
          <Textarea
            id="unavailability-reason"
            rows={2}
            placeholder="Holiday, personal, other commitment…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        {conflict?.hasConflict && (
          <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              You have {conflict.experiences.length} assigned program{conflict.experiences.length === 1 ? "" : "s"} during
              this period. Please contact your coordinator before blocking these dates.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

type Props = {
  facilitatorId: string;
  startDate: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function AddUnavailabilityDialog({ facilitatorId, startDate, onClose, onSaved }: Props) {
  return (
    <Dialog open={Boolean(startDate)} onOpenChange={(open) => !open && onClose()}>
      {startDate && (
        <UnavailabilityForm key={startDate} facilitatorId={facilitatorId} initialStartDate={startDate} onClose={onClose} onSaved={onSaved} />
      )}
    </Dialog>
  );
}
