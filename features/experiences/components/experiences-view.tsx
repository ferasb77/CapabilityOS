"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

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
import { ExperienceStatusBadge } from "@/features/dashboard/components/experience-status-badge";
import type { ExperienceStatus } from "@/infrastructure/repositories/dashboard";
import { EXPERIENCE_TYPES, EXPERIENCE_TYPE_LABELS, type ExperienceType } from "@/features/experiences/schema";
import type { ExperienceListItem } from "@/features/experiences/data";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatSatisfaction(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}/5`;
}

const ALL = "all";

const TYPE_ITEMS = [
  { value: ALL, label: "All Types" },
  ...EXPERIENCE_TYPES.map((type) => ({ value: type, label: EXPERIENCE_TYPE_LABELS[type] })),
];

// Matches ExperienceStatusBadge's labels ("Active", not schema.ts's
// create-form label "Published") since this dropdown filters by the same
// status the badge in the results table displays.
const STATUS_ITEMS: { value: string; label: string }[] = [
  { value: ALL, label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export type ExperienceCurrentFilters = {
  search?: string;
  clientId?: string;
  engagementId?: string;
  experienceType?: ExperienceType;
  status?: ExperienceStatus;
  dateFrom?: string;
  dateTo?: string;
};

type Props = {
  experiences: ExperienceListItem[];
  totalCount: number;
  page: number;
  totalPages: number;
  clients: { id: string; name: string }[];
  engagements: { id: string; title: string; clientId: string }[];
  currentFilters: ExperienceCurrentFilters;
};

export function ExperiencesView({
  experiences,
  totalCount,
  page,
  totalPages,
  clients,
  engagements,
  currentFilters,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(currentFilters.search ?? "");
  const [dateFrom, setDateFrom] = useState(currentFilters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(currentFilters.dateTo ?? "");

  const availableEngagements = useMemo(() => {
    if (!currentFilters.clientId) {
      return engagements;
    }
    return engagements.filter((engagement) => engagement.clientId === currentFilters.clientId);
  }, [engagements, currentFilters.clientId]);

  const dateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const hasActiveFilters = Boolean(
    currentFilters.search ||
      currentFilters.clientId ||
      currentFilters.engagementId ||
      currentFilters.experienceType ||
      currentFilters.status ||
      currentFilters.dateFrom ||
      currentFilters.dateTo
  );

  const navigate = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams();

      const next = {
        search: currentFilters.search ?? null,
        clientId: currentFilters.clientId ?? null,
        engagementId: currentFilters.engagementId ?? null,
        experienceType: currentFilters.experienceType ?? null,
        status: currentFilters.status ?? null,
        dateFrom: currentFilters.dateFrom ?? null,
        dateTo: currentFilters.dateTo ?? null,
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
        router.push(query ? `/dashboard/experiences?${query}` : "/dashboard/experiences");
      });
    },
    [currentFilters, page, router, startTransition]
  );

  // Same debounce-to-URL-param pattern as ParticipantsView: the input feels
  // instant to type into, but the actual filtering happens server-side
  // after the user pauses, not on every keystroke.
  useEffect(() => {
    const trimmed = search.trim();
    const current = currentFilters.search ?? "";
    if (trimmed === current) {
      return;
    }

    const handle = setTimeout(() => {
      navigate({ search: trimmed || null, page: null });
    }, 300);

    return () => clearTimeout(handle);
  }, [search, currentFilters.search, navigate]);

  function handleDateFromChange(value: string) {
    setDateFrom(value);
    if (value && dateTo && value > dateTo) {
      return;
    }
    navigate({ dateFrom: value || null, page: null });
  }

  function handleDateToChange(value: string) {
    setDateTo(value);
    if (dateFrom && value && dateFrom > value) {
      return;
    }
    navigate({ dateTo: value || null, page: null });
  }

  function handleClearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    startTransition(() => {
      router.push("/dashboard/experiences");
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-[300px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title..."
              className="h-11 pl-9 md:h-9"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-sm text-muted-foreground underline-offset-4 hover:text-gold hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <Select
            key={`client-${currentFilters.clientId ?? ""}`}
            defaultValue={currentFilters.clientId ?? ALL}
            onValueChange={(value) =>
              navigate({
                clientId: value === ALL ? null : (value ?? null),
                engagementId: null,
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
            key={`engagement-${currentFilters.clientId ?? ""}-${currentFilters.engagementId ?? ""}`}
            defaultValue={currentFilters.engagementId ?? ALL}
            onValueChange={(value) =>
              navigate({
                engagementId: value === ALL ? null : (value ?? null),
                page: null,
              })
            }
            items={[
              { value: ALL, label: "All Engagements" },
              ...availableEngagements.map((e) => ({ value: e.id, label: e.title })),
            ]}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Engagements</SelectItem>
              {availableEngagements.map((engagement) => (
                <SelectItem key={engagement.id} value={engagement.id}>
                  {engagement.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            key={`type-${currentFilters.experienceType ?? ""}`}
            defaultValue={currentFilters.experienceType ?? ALL}
            onValueChange={(value) =>
              navigate({ experienceType: value === ALL ? null : (value ?? null), page: null })
            }
            items={TYPE_ITEMS}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            key={`status-${currentFilters.status ?? ""}`}
            defaultValue={currentFilters.status ?? ALL}
            onValueChange={(value) => navigate({ status: value === ALL ? null : (value ?? null), page: null })}
            items={STATUS_ITEMS}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => handleDateFromChange(event.target.value)}
              aria-label="Start date from"
              className="w-full sm:w-[150px]"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => handleDateToChange(event.target.value)}
              aria-label="Start date to"
              className="w-full sm:w-[150px]"
            />
          </div>
        </div>

        {dateRangeInvalid && (
          <p className="text-xs text-destructive">&quot;From&quot; date must be before &quot;To&quot; date.</p>
        )}
      </div>

      {experiences.length === 0 ? (
        <Card className="bg-surface-elevated">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No experiences match your filters. Try adjusting or clearing the filters.
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-surface-elevated">
          <CardContent>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Engagement</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead className="text-right">Participants</TableHead>
                    <TableHead className="text-right">Satisfaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {experiences.map((experience) => (
                    <TableRow key={experience.id}>
                      <TableCell className="font-medium">
                        <Link href={`/dashboard/experiences/${experience.slug}`} className="hover:text-gold">
                          {experience.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{experience.clientName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{experience.engagementTitle ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{EXPERIENCE_TYPE_LABELS[experience.experienceType]}</Badge>
                      </TableCell>
                      <TableCell>
                        <ExperienceStatusBadge status={experience.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(experience.startDate)}</TableCell>
                      <TableCell className="text-right">{experience.participantCount}</TableCell>
                      <TableCell className="text-right">{formatSatisfaction(experience.avgSatisfaction)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="space-y-3 md:hidden">
              {experiences.map((experience) => (
                <li key={experience.id}>
                  <Link
                    href={`/dashboard/experiences/${experience.slug}`}
                    className="block rounded-lg border border-border-subtle bg-night/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-ivory">{experience.title}</p>
                      <ExperienceStatusBadge status={experience.status} />
                    </div>
                    {experience.clientName && (
                      <p className="mt-1 text-sm text-muted-foreground">{experience.clientName}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">{formatDate(experience.startDate)}</span>
                      <span className="text-sm text-muted-foreground">
                        {experience.participantCount} participant{experience.participantCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {totalCount} total
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
