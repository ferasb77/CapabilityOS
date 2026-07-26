"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

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

import { deleteMilestone } from "../actions";

export function DeleteMilestoneDialog({ milestoneId, milestoneTitle }: { milestoneId: string; milestoneTitle: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);

    startTransition(async () => {
      const result = await deleteMilestone(milestoneId);

      if (result.success) {
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="icon-sm" />}>
        <Trash2 className="size-4 text-muted-foreground" />
        <span className="sr-only">Delete milestone</span>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this milestone?</DialogTitle>
          <DialogDescription>
            &quot;{milestoneTitle}&quot; will be removed from this engagement&apos;s financial record. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
          <Button type="button" variant="destructive" disabled={isPending} onClick={handleConfirm}>
            {isPending ? "Deleting..." : "Delete Milestone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
