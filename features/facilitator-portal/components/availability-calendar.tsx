"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

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
import type { AssignedExperience, UnavailabilityBlock } from "../data";

type Props = {
  facilitatorId: string;
  unavailabilityBlocks: UnavailabilityBlock[];
  assignedExperiences: AssignedExperience[];
};

export function AvailabilityCalendar({
  facilitatorId,
  unavailabilityBlocks,
  assignedExperiences,
}: Props) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Add Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const leadingEmptyCells = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  // Map dates to unavailability blocks
  const unavailabilityByDate = new Map<string, UnavailabilityBlock[]>();
  unavailabilityBlocks.forEach((block) => {
    const start = new Date(block.startDate);
    const end = new Date(block.endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().slice(0, 10);
      const existing = unavailabilityByDate.get(dateKey) ?? [];
      existing.push(block);
      unavailabilityByDate.set(dateKey, existing);
    }
  });

  // Map dates to assigned experiences
  const experiencesByDate = new Map<string, AssignedExperience[]>();
  assignedExperiences.forEach((exp) => {
    const start = new Date(exp.startDate);
    const end = new Date(exp.endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().slice(0, 10);
      const existing = experiencesByDate.get(dateKey) ?? [];
      existing.push(exp);
      experiencesByDate.set(dateKey, existing);
    }
  });

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    setIsSubmitting(true);
    setWarningMessage(null);
    setErrorMessage(null);

    const result = await addUnavailability(facilitatorId, startDate, endDate, reason);

    setIsSubmitting(false);

    if (result.success) {
      if (result.warning) {
        setWarningMessage(result.warning);
      } else {
        setIsAddOpen(false);
        setStartDate("");
        setEndDate("");
        setReason("");
      }
    } else {
      setErrorMessage(result.error);
    }
  };

  const handleRemove = async (id: string) => {
    if (confirm("Are you sure you want to remove this unavailability block?")) {
      await removeUnavailability(id);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ivory">My Availability & Unavailability</h1>
          <p className="text-sm text-muted-foreground">
            Block out dates when you are unavailable so program coordinators can plan scheduling.
          </p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger
            render={
              <Button className="gap-2 self-start sm:self-auto">
                <Plus className="size-4" />
                Mark Date Range Unavailable
              </Button>
            }
          />
          <DialogContent className="bg-surface-elevated border-border-subtle sm:max-w-md text-ivory">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Add Unavailability Block</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set start and end dates when you will be away or unavailable for delivery.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddSubmit} className="space-y-4 py-2">
              {errorMessage && (
                <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                  {errorMessage}
                </div>
              )}

              {warningMessage && (
                <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <p className="font-semibold">Conflict Warning Recorded</p>
                    <p className="mt-0.5">{warningMessage}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => setIsAddOpen(false)}
                      className="mt-2 text-xs"
                    >
                      Acknowledge & Close
                    </Button>
                  </div>
                </div>
              )}

              {!warningMessage && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="startDate">Start Date *</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
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

                  <div className="space-y-1.5">
                    <Label htmlFor="reason">Reason (Optional)</Label>
                    <Input
                      id="reason"
                      placeholder="e.g. Annual leave, personal commitment, external conference"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsAddOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Checking..." : "Save Block"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Legend & Month Header */}
      <Card className="bg-surface-elevated border-border-subtle">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border-subtle gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-ivory">{monthName}</CardTitle>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-emerald-500/80" /> Available
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-rose-500/80" /> Unavailable Block
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-gold" /> Assigned Program
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="xs" onClick={handleToday}>
              Today
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handlePrevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={handleNextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {leadingEmptyCells.map((cell) => (
              <div key={`empty-${cell}`} className="min-h-[85px] rounded-md bg-night/20 p-1 opacity-20" />
            ))}

            {days.map((day) => {
              const dayStr = String(day).padStart(2, "0");
              const monthStr = String(month + 1).padStart(2, "0");
              const fullDateKey = `${year}-${monthStr}-${dayStr}`;

              const unavBlocks = unavailabilityByDate.get(fullDateKey) ?? [];
              const expList = experiencesByDate.get(fullDateKey) ?? [];

              const isToday = fullDateKey === todayStr;
              const isUnavailable = unavBlocks.length > 0;
              const hasProgram = expList.length > 0;

              return (
                <div
                  key={day}
                  className={`min-h-[85px] rounded-md border p-1.5 flex flex-col justify-between transition ${
                    isUnavailable
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                      : hasProgram
                      ? "border-gold/40 bg-gold/5"
                      : isToday
                      ? "border-gold bg-gold/10"
                      : "border-border-subtle/40 bg-night/40 hover:bg-night/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? "flex size-5 items-center justify-center rounded-full bg-gold text-night font-bold"
                          : isUnavailable
                          ? "text-rose-300"
                          : "text-muted-foreground"
                      }`}
                    >
                      {day}
                    </span>

                    {hasProgram && (
                      <span className="size-2 rounded-full bg-gold" title="Assigned Program" />
                    )}
                  </div>

                  <div className="space-y-1">
                    {isUnavailable && (
                      <div className="rounded bg-rose-500/20 px-1 py-0.5 text-[10px] font-semibold text-rose-300 truncate">
                        {unavBlocks[0].reason || "Unavailable"}
                      </div>
                    )}

                    {hasProgram && (
                      <div className="rounded bg-gold/20 px-1 py-0.5 text-[10px] font-semibold text-gold truncate">
                        {expList[0].title}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Unavailability Blocks List */}
      <Card className="bg-surface-elevated border-border-subtle">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-ivory flex items-center gap-2">
            <Clock className="size-5 text-gold" /> Unavailability Schedule
          </CardTitle>
          <CardDescription>All recorded unavailability periods and reasons.</CardDescription>
        </CardHeader>
        <CardContent>
          {unavailabilityBlocks.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
              <CheckCircle2 className="size-8 text-emerald-400/50" />
              <span>No unavailability blocks recorded. You are currently marked available for assignment.</span>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle/50">
              {unavailabilityBlocks.map((block) => {
                const isPast = block.endDate < todayStr;

                return (
                  <div
                    key={block.id}
                    className={`py-3.5 flex items-center justify-between gap-4 ${
                      isPast ? "opacity-50" : ""
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ivory text-sm">
                          {new Date(block.startDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          —{" "}
                          {new Date(block.endDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {isPast && (
                          <span className="text-[10px] rounded bg-muted/20 px-1.5 py-0.5 text-muted-foreground uppercase">
                            Past
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {block.reason ? block.reason : "No reason provided"}
                      </p>
                    </div>

                    {!isPast && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemove(block.id)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove Block"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
