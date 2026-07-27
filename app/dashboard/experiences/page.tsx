import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExperiencesView } from "@/features/experiences/components/experiences-view";
import { getAllExperiencesFiltered } from "@/features/experiences/data";
import { EXPERIENCE_TYPES, type ExperienceType } from "@/features/experiences/schema";
import type { ExperienceStatus } from "@/infrastructure/repositories/dashboard";
import { getClientOptions } from "@/features/clients/data";
import { getEngagementOptions } from "@/features/engagements/data";

const EXPERIENCE_STATUSES: ExperienceStatus[] = ["draft", "active", "completed", "cancelled"];

type Props = {
  searchParams: Promise<{
    search?: string;
    clientId?: string;
    engagementId?: string;
    experienceType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
};

export default async function ExperiencesPage({ searchParams }: Props) {
  const params = await searchParams;

  const experienceType = EXPERIENCE_TYPES.includes(params.experienceType as ExperienceType)
    ? (params.experienceType as ExperienceType)
    : undefined;
  const status = EXPERIENCE_STATUSES.includes(params.status as ExperienceStatus)
    ? (params.status as ExperienceStatus)
    : undefined;
  const page = params.page ? Number.parseInt(params.page, 10) || 1 : 1;

  const filters = {
    search: params.search?.trim() || undefined,
    clientId: params.clientId || undefined,
    engagementId: params.engagementId || undefined,
    experienceType,
    status,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    page,
  };

  const [result, clients, engagements] = await Promise.all([
    getAllExperiencesFiltered(filters),
    getClientOptions(),
    getEngagementOptions(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Experiences</h1>
          <p className="mt-2 text-muted-foreground">
            {result.totalCount} experience{result.totalCount === 1 ? "" : "s"} across every client — workshops,
            assessments, coaching, and more.
          </p>
        </div>

        <Button size="lg" nativeButton={false} render={<Link href="/dashboard/experiences/new" />}>
          <Plus className="size-4" />
          New Experience
        </Button>
      </div>

      <ExperiencesView
        experiences={result.experiences}
        totalCount={result.totalCount}
        page={result.page}
        totalPages={result.totalPages}
        clients={clients}
        engagements={engagements.map((e) => ({ id: e.id, title: e.title, clientId: e.clientId }))}
        currentFilters={{
          search: filters.search,
          clientId: filters.clientId,
          engagementId: filters.engagementId,
          experienceType: filters.experienceType,
          status: filters.status,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        }}
      />
    </div>
  );
}
