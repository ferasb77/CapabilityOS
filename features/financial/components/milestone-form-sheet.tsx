"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  MILESTONE_CURRENCIES,
  MILESTONE_TRIGGER_TYPES,
  MILESTONE_TRIGGER_TYPE_LABELS,
  type MilestoneTriggerType,
} from "@/features/financial/schema";
import type { Milestone } from "@/features/financial/data";

import { createMilestone, updateMilestone } from "../actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
  experiences: { id: string; title: string }[];
  milestone?: Milestone;
};

export function MilestoneFormSheet({ open, onOpenChange, engagementId, experiences, milestone }: Props) {
  const router = useRouter();
  const isEditMode = Boolean(milestone);

  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [amount, setAmount] = useState(milestone ? String(milestone.amount) : "");
  const [currency, setCurrency] = useState(milestone?.currency ?? "USD");
  const [triggerType, setTriggerType] = useState<MilestoneTriggerType>(milestone?.triggerType ?? "manual");
  const [triggerExperienceId, setTriggerExperienceId] = useState(milestone?.triggerExperienceId ?? "");
  const [triggerDate, setTriggerDate] = useState(milestone?.triggerDate ?? "");
  const [dueDate, setDueDate] = useState(milestone?.dueDate ?? "");
  const [financeEmail, setFinanceEmail] = useState(milestone?.financeEmail ?? "");
  const [notes, setNotes] = useState(milestone?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function reset() {
    setTitle(milestone?.title ?? "");
    setDescription(milestone?.description ?? "");
    setAmount(milestone ? String(milestone.amount) : "");
    setCurrency(milestone?.currency ?? "USD");
    setTriggerType(milestone?.triggerType ?? "manual");
    setTriggerExperienceId(milestone?.triggerExperienceId ?? "");
    setTriggerDate(milestone?.triggerDate ?? "");
    setDueDate(milestone?.dueDate ?? "");
    setFinanceEmail(milestone?.financeEmail ?? "");
    setNotes(milestone?.notes ?? "");
    setError(null);
  }

  async function handleSave() {
    setError(null);
    setIsSaving(true);

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("amount", amount);
    formData.set("currency", currency);
    formData.set("triggerType", triggerType);
    formData.set("triggerExperienceId", triggerType === "experience_completion" ? triggerExperienceId : "");
    formData.set("triggerDate", triggerType === "date_based" ? triggerDate : "");
    formData.set("dueDate", dueDate);
    formData.set("financeEmail", financeEmail);
    formData.set("notes", notes);

    const result =
      isEditMode && milestone ? await updateMilestone(milestone.id, formData) : await createMilestone(engagementId, formData);

    setIsSaving(false);

    if (result.success) {
      onOpenChange(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  const canSave =
    title.trim().length > 0 &&
    Number(amount) > 0 &&
    (triggerType !== "experience_completion" || triggerExperienceId.length > 0) &&
    (triggerType !== "date_based" || triggerDate.length > 0) &&
    !isSaving;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditMode ? "Edit Milestone" : "Add Milestone"}</SheetTitle>
          <SheetDescription>A payment milestone that triggers finance notification when its condition is met.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label htmlFor="milestone-title">
              Title <span className="text-gold">*</span>
            </Label>
            <Input id="milestone-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="milestone-description">Description (optional)</Label>
            <Textarea
              id="milestone-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="milestone-amount">
                Amount <span className="text-gold">*</span>
              </Label>
              <Input
                id="milestone-amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-currency">Currency</Label>
              <Select
                value={currency}
                onValueChange={(value) => value && setCurrency(value)}
                items={MILESTONE_CURRENCIES.map((value) => ({ value, label: value }))}
              >
                <SelectTrigger id="milestone-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_CURRENCIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="milestone-trigger-type">Trigger</Label>
            <Select
              value={triggerType}
              onValueChange={(value) => value && setTriggerType(value as MilestoneTriggerType)}
              items={MILESTONE_TRIGGER_TYPES.map((value) => ({ value, label: MILESTONE_TRIGGER_TYPE_LABELS[value] }))}
            >
              <SelectTrigger id="milestone-trigger-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MILESTONE_TRIGGER_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {MILESTONE_TRIGGER_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {triggerType === "experience_completion" && (
            <div className="space-y-2">
              <Label htmlFor="milestone-trigger-experience">
                Triggering experience <span className="text-gold">*</span>
              </Label>
              {experiences.length === 0 ? (
                <p className="text-sm text-muted-foreground">No experiences linked to this engagement yet.</p>
              ) : (
                <Select
                  value={triggerExperienceId}
                  onValueChange={(value) => value && setTriggerExperienceId(value)}
                  items={experiences.map((e) => ({ value: e.id, label: e.title }))}
                >
                  <SelectTrigger id="milestone-trigger-experience" className="w-full">
                    <SelectValue placeholder="Choose an experience" />
                  </SelectTrigger>
                  <SelectContent>
                    {experiences.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {triggerType === "date_based" && (
            <div className="space-y-2">
              <Label htmlFor="milestone-trigger-date">
                Trigger date <span className="text-gold">*</span>
              </Label>
              <Input
                id="milestone-trigger-date"
                type="date"
                value={triggerDate}
                onChange={(event) => setTriggerDate(event.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="milestone-due-date">Due date (optional)</Label>
            <Input id="milestone-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="milestone-finance-email">Finance email override (optional)</Label>
            <Input
              id="milestone-finance-email"
              type="email"
              placeholder="Defaults to the workspace's primary finance contact"
              value={financeEmail}
              onChange={(event) => setFinanceEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="milestone-notes">Notes (optional)</Label>
            <Textarea id="milestone-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <SheetFooter>
          <Button type="button" disabled={!canSave} onClick={handleSave}>
            {isSaving ? "Saving..." : isEditMode ? "Save Changes" : "Add Milestone"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
