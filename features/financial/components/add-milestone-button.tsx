"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { MilestoneFormSheet } from "./milestone-form-sheet";

export function AddMilestoneButton({
  engagementId,
  experiences,
}: {
  engagementId: string;
  experiences: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add Milestone
      </Button>
      <MilestoneFormSheet open={open} onOpenChange={setOpen} engagementId={engagementId} experiences={experiences} />
    </>
  );
}
