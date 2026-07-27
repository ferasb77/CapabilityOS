"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SurveyStatusBadge } from "@/features/surveys/components/survey-status-badge";
import type {
  CheckinFilter,
  ParticipantListItem,
  ParticipantSurveyStatus,
} from "@/features/participants/data";
import { exportParticipants } from "@/features/participants/actions";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function CheckInBadge({ checkedIn }: { checkedIn: boolean }) {
  if (checkedIn) {
    return (
      <Badge variant="outline" className="border-transparent bg-emerald-500/15 text-emerald-400">
        Checked In
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
      Not Checked In
    </Badge>
  );
}

const ALL = "all";

const CHECKIN_ITEMS = [
  { value: ALL, label: "All" },
  { value: "checked_in", label: "Checked In" },
  { value: "not_checked_in", label: "Not Checked In" },
];

const SURVEY_ITEMS = [
  { value: ALL, label: "All" },
  { value: "sent", label: "Survey Sent" },
  { value: "completed", label: "Survey Completed" },
  { value: "not_sent", label: "Not Surveyed" },
];

type Props = {
  participants: ParticipantListItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  experiences: { id: string; title: string; clientId: string | null }[];
  clients: { id: string; name: string }[];
  currentFilters: {
    experienceId?: string;
    clientId?: string;
    checkinStatus?: CheckinFilter;
    surveyStatus?: ParticipantSurveyStatus;
    search?: string;
  };
};

export function ParticipantsView({
  participants,
  totalCount,
  page,
  totalPages,
  experiences,
  clients,
  currentFilters,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(currentFilters.search ?? "");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const availableExperiences = useMemo(() => {
    if (!currentFilters.clientId) {
      return experiences;
    }
    return experiences.filter((experience) => experience.clientId === currentFilters.clientId);
  }, [experiences, currentFilters.clientId]);

  const navigate = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams();

      const next = {
        experienceId: currentFilters.experienceId ?? null,
        clientId: currentFilters.clientId ?? null,
        checkinStatus: currentFilters.checkinStatus ?? null,
        surveyStatus: currentFilters.surveyStatus ?? null,
        search: currentFilters.search ?? null,
        page: page > 1 ? String(page) : null,
        ...updates,
      };

      for (const [key, value] of Object.entries(next)) {
        if (value) {
          params.set(key, value);
        }
      }

      const query = params.toString();
      startTransition(() => {
        router.push(query ? `/dashboard/participants?${query}` : "/dashboard/participants");
      });
    },
    [currentFilters, page, router, startTransition]
  );

  // Search moves the current page's filter into the URL (server-side,
  // just like the dropdown filters) instead of re-filtering whatever page
  // is already loaded — so it now applies across every matching
  // participant, not just the 25 already on screen. Debounced so it
  // doesn't navigate on every keystroke.
  useEffect(() => {
    const trimmed = search.trim();
    const current = currentFilters.search ?? "";
    if (trimmed === current) {
      return;
    }

    const handle = setTimeout(() => {
      navigate({ search: trimmed || null, page: null });
    }, 400);

    return () => clearTimeout(handle);
  }, [search, currentFilters.search, navigate]);

  async function handleExport() {
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await exportParticipants({ ...currentFilters, search: search.trim() || undefined });
      if (!result.success) {
        setExportError(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `participants-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or company..."
              className="h-11 pl-9 md:h-9"
            />
          </div>

          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
              className="w-full sm:w-auto"
            >
              <Download className="size-4" />
              {isExporting ? "Exporting..." : "Export CSV"}
            </Button>
            {exportError && <p className="max-w-60 text-right text-xs text-destructive">{exportError}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select
            key={`experience-${currentFilters.clientId ?? ""}-${currentFilters.experienceId ?? ""}`}
            defaultValue={currentFilters.experienceId ?? ALL}
            onValueChange={(value) =>
              navigate({
                experienceId: value === ALL ? null : (value ?? null),
                page: null,
              })
            }
            items={[
              { value: ALL, label: "All Experiences" },
              ...availableExperiences.map((e) => ({ value: e.id, label: e.title })),
            ]}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Experiences</SelectItem>
              {availableExperiences.map((experience) => (
                <SelectItem key={experience.id} value={experience.id}>
                  {experience.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            key={`client-${currentFilters.clientId ?? ""}`}
            defaultValue={currentFilters.clientId ?? ALL}
            onValueChange={(value) =>
              navigate({
                clientId: value === ALL ? null : (value ?? null),
                experienceId: null,
                page: null,
              })
            }
            items={[{ value: ALL, label: "All Clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            key={`checkin-${currentFilters.checkinStatus ?? ""}`}
            defaultValue={currentFilters.checkinStatus ?? ALL}
            onValueChange={(value) =>
              navigate({ checkinStatus: value === ALL ? null : (value ?? null), page: null })
            }
            items={CHECKIN_ITEMS}
          >
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHECKIN_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            key={`survey-${currentFilters.surveyStatus ?? ""}`}
            defaultValue={currentFilters.surveyStatus ?? ALL}
            onValueChange={(value) =>
              navigate({ surveyStatus: value === ALL ? null : (value ?? null), page: null })
            }
            items={SURVEY_ITEMS}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SURVEY_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {totalCount} participant{totalCount === 1 ? "" : "s"}
        {search.trim() ? ` matching "${search.trim()}"` : " total"}
      </p>

      {participants.length === 0 ? (
        <Card className="bg-surface-elevated">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No participants match your filters.
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-surface-elevated">
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Survey</TableHead>
                    <TableHead className="text-right">Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/participants/${participant.id}`}
                          className="hover:text-gold"
                        >
                          {participant.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {participant.company ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {participant.jobTitle ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {participant.experienceId ? (
                          <Link
                            href={`/dashboard/experiences/${participant.experienceSlug}`}
                            className="hover:text-gold"
                          >
                            {participant.experienceTitle}
                          </Link>
                        ) : (
                          (participant.experienceTitle ?? "—")
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {participant.clientName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <CheckInBadge checkedIn={participant.checkedIn} />
                      </TableCell>
                      <TableCell>
                        <SurveyStatusBadge status={participant.surveyStatus} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDateTime(participant.registeredAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="space-y-3 md:hidden">
              {participants.map((participant) => (
                <li
                  key={participant.id}
                  className="rounded-lg border border-border-subtle bg-night/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/dashboard/participants/${participant.id}`}
                      className="font-medium text-ivory hover:text-gold"
                    >
                      {participant.fullName}
                    </Link>
                    <CheckInBadge checkedIn={participant.checkedIn} />
                  </div>
                  {(participant.company || participant.jobTitle) && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[participant.company, participant.jobTitle].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {(participant.experienceTitle || participant.clientName) && (
                    <p className="text-sm text-muted-foreground">
                      {[participant.experienceTitle, participant.clientName].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <SurveyStatusBadge status={participant.surveyStatus} />
                    <span className="text-sm text-muted-foreground">
                      {formatDateTime(participant.registeredAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => navigate({ page: page - 1 > 1 ? String(page - 1) : null })}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => navigate({ page: String(page + 1) })}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
