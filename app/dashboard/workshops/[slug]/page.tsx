import { notFound } from "next/navigation";

import { WorkshopStatusBadge } from "@/features/dashboard/components/workshop-status-badge";
import { ParticipantsSurveyPanel } from "@/features/surveys/components/participants-survey-panel";
import { SurveyResultsPanel } from "@/features/surveys/components/survey-results-panel";
import { getWorkshopDetailData } from "@/infrastructure/repositories/surveys";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function WorkshopDetailPage({ params }: Props) {
  const { slug } = await params;
  const data = await getWorkshopDetailData(slug);

  if (!data) {
    notFound();
  }

  const { workshop, participants, responseRate, averages, responses } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold">{workshop.title}</h1>
          <WorkshopStatusBadge status={workshop.status} />
        </div>
        <p className="mt-2 text-muted-foreground">
          {workshop.venue ? `${workshop.venue} · ` : ""}
          {formatDate(workshop.startDate)} – {formatDate(workshop.endDate)}
        </p>
      </div>

      <ParticipantsSurveyPanel
        workshopId={workshop.id}
        workshopSlug={workshop.slug}
        workshopTitle={workshop.title}
        participants={participants}
      />

      <SurveyResultsPanel averages={averages} responseRate={responseRate} responses={responses} />
    </div>
  );
}
