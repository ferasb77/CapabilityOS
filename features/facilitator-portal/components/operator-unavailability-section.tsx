"use client";

import { useState } from "react";
import { Calendar, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { addUnavailability, removeUnavailability } from "../actions";
import type { UnavailabilityBlock } from "../data";

type Props = {
  facilitatorId: string;
  unavailabilityBlocks: UnavailabilityBlock[];
};

export function OperatorUnavailabilitySection({ facilitatorId, unavailabilityBlocks }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    setIsSubmitting(true);
    await addUnavailability(facilitatorId, startDate, endDate, reason);
    setIsSubmitting(false);

    setIsOpen(false);
    setStartDate("");
    setEndDate("");
    setReason("");
  };

  const handleRemove = async (id: string) => {
    if (confirm("Remove this unavailability block?")) {
      await removeUnavailability(id);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <Card className="bg-surface-elevated border-border-subtle">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-bold text-ivory flex items-center gap-2">
            <Calendar className="size-4 text-gold" /> Unavailability & Blockouts
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Dates where this facilitator cannot be scheduled for experiences.
          </CardDescription>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger
            render={
              <Button size="xs" variant="outline" className="gap-1.5 text-xs border-border-subtle">
                <Plus className="size-3.5" />
                Add Block
              </Button>
            }
          />
          <DialogContent className="bg-surface-elevated border-border-subtle sm:max-w-md text-ivory">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Add Unavailability Block</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Block out dates for this facilitator.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAdd} className="space-y-3 py-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Input
                  id="reason"
                  placeholder="e.g. Leave, Personal, External project"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Add Unavailability"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {unavailabilityBlocks.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            No unavailability blocks recorded. Facilitator is available.
          </p>
        ) : (
          <div className="divide-y divide-border-subtle/50 text-xs">
            {unavailabilityBlocks.map((block) => {
              const isPast = block.endDate < todayStr;

              return (
                <div
                  key={block.id}
                  className={`py-2.5 flex items-center justify-between gap-2 ${
                    isPast ? "opacity-50" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium text-ivory">
                      {new Date(block.startDate).toLocaleDateString()} —{" "}
                      {new Date(block.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-muted-foreground">{block.reason || "No reason given"}</p>
                  </div>

                  {!isPast && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemove(block.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
