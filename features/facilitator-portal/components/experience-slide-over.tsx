"use client";

import Link from "next/link";
import { Calendar, MapPin, Users, Award, BookOpen, FileText, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { AssignedExperience } from "../data";

type Props = {
  experience: AssignedExperience | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ExperienceSlideOver({ experience, open, onOpenChange }: Props) {
  if (!experience) return null;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-surface-elevated border-border-subtle p-6 overflow-y-auto">
        <SheetHeader className="p-0 pb-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                experience.status === "active"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : experience.status === "completed"
                  ? "border-muted/30 bg-muted/10 text-muted-foreground"
                  : "border-gold/30 bg-gold/10 text-gold"
              }
            >
              {experience.status}
            </Badge>
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
              {experience.experienceType}
            </span>
          </div>

          <SheetTitle className="text-xl font-bold text-ivory mt-2">
            {experience.title}
          </SheetTitle>
          {experience.titleAr && (
            <p className="text-sm text-gold/80 font-cairo dir-rtl mt-0.5">{experience.titleAr}</p>
          )}

          <SheetDescription className="text-xs text-muted-foreground">
            {experience.clientName ? `${experience.clientName}` : "Internal Program"}
            {experience.engagementTitle ? ` • ${experience.engagementTitle}` : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Schedule & Location Card */}
          <div className="rounded-lg border border-border-subtle bg-night/50 p-4 space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Calendar className="size-4 text-gold shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Start</p>
                <p className="font-medium text-ivory">{formatDate(experience.startDate)}</p>
                <p className="text-xs text-muted-foreground mt-1">End</p>
                <p className="font-medium text-ivory">{formatDate(experience.endDate)}</p>
              </div>
            </div>

            {(experience.venue || experience.city || experience.country) && (
              <div className="flex items-start gap-3 pt-2 border-t border-border-subtle/50">
                <MapPin className="size-4 text-gold shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium text-ivory">
                    {[experience.venue, experience.city, experience.country]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border-subtle bg-night/50 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="size-3.5 text-gold" />
                <span>Participants</span>
              </div>
              <p className="text-lg font-bold text-ivory mt-1">
                {experience.participantCount}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / {experience.capacity} max
                </span>
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle bg-night/50 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-400" />
                <span>Check-in Rate</span>
              </div>
              <p className="text-lg font-bold text-ivory mt-1">
                {experience.checkInRate}%{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({experience.checkInCount} checked in)
                </span>
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle bg-night/50 p-3 col-span-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Award className="size-3.5 text-gold" />
                <span>Satisfaction Score</span>
              </div>
              {experience.satisfactionScore !== null ? (
                <p className="text-lg font-bold text-gold mt-1">
                  {experience.satisfactionScore}{" "}
                  <span className="text-xs font-normal text-muted-foreground">/ 5.0 avg</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground italic mt-1">No survey responses submitted yet</p>
              )}
            </div>
          </div>

          {/* Quick Actions & Material Links */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Program Resources
            </p>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs gap-2 border-border-subtle"
              render={
                <Link
                  href={`/dashboard/experiences/${experience.slug}`}
                  target="_blank"
                />
              }
            >
              <FileText className="size-4 text-gold" />
              View Experience Overview & Registration
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs gap-2 border-border-subtle"
              render={
                <Link
                  href={`/r/${experience.slug}`}
                  target="_blank"
                />
              }
            >
              <BookOpen className="size-4 text-emerald-400" />
              Participant Daily Check-In Scanner (QR Page)
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
