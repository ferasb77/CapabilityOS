"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { Milestone } from "@/features/financial/data";

import { sendMilestoneNotification, triggerMilestone, updateMilestoneStatus } from "../actions";
import { DeleteMilestoneDialog } from "./delete-milestone-dialog";
import { MilestoneFormSheet } from "./milestone-form-sheet";

type Props = {
  milestone: Milestone;
  engagementId: string;
  experiences: { id: string; title: string }[];
};

export function MilestoneRowActions({ milestone, engagementId, experiences }: Props) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  function run(action: string, task: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    setPendingAction(action);

    startTransition(async () => {
      const result = await task();
      setPendingAction(null);

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error && <p className="w-full text-right text-xs text-destructive">{error}</p>}

      {milestone.status === "pending" && milestone.triggerType === "manual" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => run("trigger", () => triggerMilestone(milestone.id))}
        >
          {isPending && pendingAction === "trigger" ? "Triggering..." : "Trigger Manually"}
        </Button>
      )}

      {milestone.status === "triggered" && (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => run("notify", () => sendMilestoneNotification(milestone.id))}
          >
            {isPending && pendingAction === "notify" ? "Sending..." : "Send Invoice Notification"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => run("invoice", () => updateMilestoneStatus(milestone.id, "invoiced"))}
          >
            {isPending && pendingAction === "invoice" ? "Saving..." : "Mark as Invoiced"}
          </Button>
        </>
      )}

      {milestone.status === "invoiced" && (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => run("collect", () => updateMilestoneStatus(milestone.id, "collected"))}
        >
          {isPending && pendingAction === "collect" ? "Saving..." : "Mark as Collected"}
        </Button>
      )}

      <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditOpen(true)}>
        Edit
      </Button>

      <DeleteMilestoneDialog milestoneId={milestone.id} milestoneTitle={milestone.title} />

      <MilestoneFormSheet
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        engagementId={engagementId}
        experiences={experiences}
        milestone={milestone}
      />
    </div>
  );
}
