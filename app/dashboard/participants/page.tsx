import { ParticipantsView } from "@/features/participants/components/participants-view";
import { getAllParticipants } from "@/features/participants/data";
import type { CheckinFilter, ParticipantSurveyStatus } from "@/features/participants/data";
import { getClientOptions } from "@/features/clients/data";
import { getExperienceOptions } from "@/features/experiences/data";

const CHECKIN_VALUES: CheckinFilter[] = ["checked_in", "not_checked_in"];
const SURVEY_VALUES: ParticipantSurveyStatus[] = ["not_sent", "sent", "completed"];

type Props = {
  searchParams: Promise<{
    experienceId?: string;
    clientId?: string;
    checkinStatus?: string;
    surveyStatus?: string;
    search?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export default async function ParticipantsPage({ searchParams }: Props) {
  const params = await searchParams;

  const checkinStatus = CHECKIN_VALUES.includes(params.checkinStatus as CheckinFilter)
    ? (params.checkinStatus as CheckinFilter)
    : undefined;
  const surveyStatus = SURVEY_VALUES.includes(params.surveyStatus as ParticipantSurveyStatus)
    ? (params.surveyStatus as ParticipantSurveyStatus)
    : undefined;
  const page = params.page ? Number.parseInt(params.page, 10) || 1 : 1;
  const pageSize = params.pageSize ? Number.parseInt(params.pageSize, 10) || undefined : undefined;

  const filters = {
    experienceId: params.experienceId || undefined,
    clientId: params.clientId || undefined,
    checkinStatus,
    surveyStatus,
    search: params.search?.trim() || undefined,
    page,
    pageSize,
  };

  const [result, experiences, clients] = await Promise.all([
    getAllParticipants(filters),
    getExperienceOptions(),
    getClientOptions(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Participants</h1>
        <p className="mt-2 text-muted-foreground">
          {result.totalCount} participant{result.totalCount === 1 ? "" : "s"} across every experience.
        </p>
      </div>

      <ParticipantsView
        participants={result.participants}
        totalCount={result.totalCount}
        page={result.page}
        totalPages={result.totalPages}
        experiences={experiences.map((e) => ({ id: e.id, title: e.title, clientId: e.clientId }))}
        clients={clients}
        currentFilters={{
          experienceId: filters.experienceId,
          clientId: filters.clientId,
          checkinStatus: filters.checkinStatus,
          surveyStatus: filters.surveyStatus,
          search: filters.search,
        }}
      />
    </div>
  );
}
