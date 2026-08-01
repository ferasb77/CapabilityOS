"use client";

import { useState } from "react";
import {
  Calendar as CalendarIcon,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  Award,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { AssignedExperience, FacilitatorPortalStats } from "../data";
import { ExperienceSlideOver } from "./experience-slide-over";

type Props = {
  experiences: AssignedExperience[];
  stats: FacilitatorPortalStats;
  facilitatorEmail: string;
};

export function ProgramsView({ experiences, stats }: Props) {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedExperience, setSelectedExperience] = useState<AssignedExperience | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(() => new Date());

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

  // Create grid of days
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const leadingEmptyCells = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  // Map experiences to date strings (YYYY-MM-DD)
  const experiencesByDate = new Map<string, AssignedExperience[]>();
  experiences.forEach((exp) => {
    const dateKey = exp.startDate.slice(0, 10);
    const existing = experiencesByDate.get(dateKey) ?? [];
    existing.push(exp);
    experiencesByDate.set(dateKey, existing);
  });

  const handleSelectExperience = (exp: AssignedExperience) => {
    setSelectedExperience(exp);
    setIsSlideOverOpen(true);
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // Group experiences for list view
  const upcomingExperiences = experiences.filter((e) => e.startDate.slice(0, 10) >= todayStr);
  const pastExperiences = experiences.filter((e) => e.startDate.slice(0, 10) < todayStr);

  return (
    <div className="space-y-8">
      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="bg-surface-elevated border-border-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Assigned
            </CardTitle>
            <Layers className="size-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ivory">{stats.totalAssigned}</div>
            <p className="text-xs text-muted-foreground mt-1">Experiences in system</p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Upcoming (30d)
            </CardTitle>
            <Clock className="size-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gold">{stats.upcoming30Days}</div>
            <p className="text-xs text-muted-foreground mt-1">Scheduled next 30 days</p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Completed ({new Date().getFullYear()})
            </CardTitle>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ivory">{stats.completedThisYear}</div>
            <p className="text-xs text-muted-foreground mt-1">Delivered this year</p>
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated border-border-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Avg Satisfaction
            </CardTitle>
            <Award className="size-4 text-gold" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gold">
              {stats.averageSatisfaction !== null ? stats.averageSatisfaction : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Survey score out of 5</p>
          </CardContent>
        </Card>
      </div>

      {/* Main View Header with View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-2xl font-bold text-ivory">My Assigned Programs</h1>
          <p className="text-sm text-muted-foreground">
            Manage and view details for all programs assigned to you.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center rounded-lg border border-border-subtle bg-surface-elevated p-1">
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="gap-1.5 text-xs"
            >
              <CalendarIcon className="size-3.5" />
              Calendar
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-1.5 text-xs"
            >
              <ListIcon className="size-3.5" />
              List View
            </Button>
          </div>
        </div>
      </div>

      {/* CALENDAR VIEW */}
      {viewMode === "calendar" && (
        <Card className="bg-surface-elevated border-border-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border-subtle">
            <CardTitle className="text-lg font-bold text-ivory">{monthName}</CardTitle>
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
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {leadingEmptyCells.map((cell) => (
                <div key={`empty-${cell}`} className="min-h-[90px] rounded-md bg-night/20 p-1 opacity-30" />
              ))}

              {days.map((day) => {
                const dayStr = String(day).padStart(2, "0");
                const monthStr = String(month + 1).padStart(2, "0");
                const fullDateKey = `${year}-${monthStr}-${dayStr}`;

                const dayExperiences = experiencesByDate.get(fullDateKey) ?? [];
                const isToday = fullDateKey === todayStr;

                return (
                  <div
                    key={day}
                    className={`min-h-[90px] rounded-md border p-1.5 flex flex-col transition ${
                      isToday
                        ? "border-gold/80 bg-gold/5"
                        : "border-border-subtle/40 bg-night/50 hover:bg-night/80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold ${
                          isToday
                            ? "flex size-5 items-center justify-center rounded-full bg-gold text-night font-bold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {day}
                      </span>

                      {dayExperiences.length > 0 && (
                        <span className="text-[10px] text-gold font-semibold">
                          {dayExperiences.length}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex-1 space-y-1 overflow-y-auto">
                      {dayExperiences.map((exp) => {
                        const isPast = exp.startDate.slice(0, 10) < todayStr;

                        return (
                          <button
                            key={exp.id}
                            type="button"
                            onClick={() => handleSelectExperience(exp)}
                            className={`w-full text-left rounded px-1.5 py-1 text-[11px] font-medium leading-tight truncate transition ${
                              isPast
                                ? "bg-muted/20 text-muted-foreground border border-border-subtle/30"
                                : "bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30"
                            }`}
                            title={exp.title}
                          >
                            {exp.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="space-y-6">
          {/* Upcoming Section */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gold flex items-center gap-2">
              <Clock className="size-4" /> Upcoming Programs ({upcomingExperiences.length})
            </h2>

            {upcomingExperiences.length === 0 ? (
              <Card className="bg-surface-elevated border-border-subtle p-6 text-center text-muted-foreground text-sm">
                No upcoming programs scheduled at this time.
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {upcomingExperiences.map((exp) => (
                  <Card
                    key={exp.id}
                    onClick={() => handleSelectExperience(exp)}
                    className="bg-surface-elevated border-border-subtle hover:border-gold/50 cursor-pointer transition p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="border-gold/30 bg-gold/10 text-gold text-xs">
                        {exp.experienceType}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(exp.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-bold text-ivory text-base line-clamp-1">{exp.title}</h3>
                      {exp.clientName && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{exp.clientName}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border-subtle/50 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3 text-gold" />
                        {exp.city || exp.venue || "TBD"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3 text-gold" />
                        {exp.participantCount} registered
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Past Section */}
          <div className="space-y-3 pt-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4" /> Past Programs ({pastExperiences.length})
            </h2>

            {pastExperiences.length === 0 ? (
              <Card className="bg-surface-elevated border-border-subtle p-6 text-center text-muted-foreground text-sm">
                No past programs found.
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pastExperiences.map((exp) => (
                  <Card
                    key={exp.id}
                    onClick={() => handleSelectExperience(exp)}
                    className="bg-surface-elevated/60 border-border-subtle hover:border-border-subtle/80 cursor-pointer transition p-4 space-y-3 opacity-80 hover:opacity-100"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="border-muted-foreground/30 bg-muted/10 text-muted-foreground text-xs">
                        Completed
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(exp.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-semibold text-ivory text-base line-clamp-1">{exp.title}</h3>
                      {exp.clientName && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{exp.clientName}</p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border-subtle/50 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{exp.participantCount} Participants</span>
                      {exp.satisfactionScore !== null && (
                        <span className="text-gold font-semibold">
                          ★ {exp.satisfactionScore} / 5
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-Over Drawer */}
      <ExperienceSlideOver
        experience={selectedExperience}
        open={isSlideOverOpen}
        onOpenChange={setIsSlideOverOpen}
      />
    </div>
  );
}
