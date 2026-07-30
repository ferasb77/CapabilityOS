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

import { markAllPresent } from "../actions";

type Props = {
  experienceId: string;
  experienceSlug: string;
  date: string;
  eligibleCount: number;
};

export function MarkAllPresentButton({ experienceId, experienceSlug, date, eligibleCount }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);

    startTransition(async () => {
      const result = await markAllPresent(experienceId, experienceSlug, date);

      if (!result.success) {
        setError(result.error);
        return;
      }

      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" disabled={eligibleCount === 0} />}>
        Mark All Present
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark all participants present?</DialogTitle>
          <DialogDescription>
            This marks the {eligibleCount} participant{eligibleCount === 1 ? "" : "s"} who haven&apos;t checked in
            for this day as present via manual check-in.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" disabled={isPending} onClick={handleConfirm}>
            {isPending ? "Marking..." : "Mark All Present"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
