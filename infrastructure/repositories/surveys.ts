import { createClient } from "@/infrastructure/supabase/server";
import type { WorkshopStatus } from "@/infrastructure/repositories/dashboard";

export type SurveyStatus = "not_sent" | "sent" | "opened" | "completed";

export type ParticipantWithSurveyStatus = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string | null;
  jobTitle: string | null;
  surveyStatus: SurveyStatus;
  sentAt: string | null;
  openedAt: string | null;
  completedAt: string | null;
};

export type SurveyDimensionAverages = {
  content: number | null;
  facilitator: number | null;
  logistics: number | null;
  overall: number | null;
};

export type SurveyResponseSummary = {
  id: string;
  participantFirstName: string;
  contentRating: number;
  facilitatorRating: number;
  logisticsRating: number;
  overallRating: number;
  highlights: string | null;
  improvements: string | null;
  additionalComments: string | null;
  submittedAt: string;
};

export type WorkshopDetail = {
  id: string;
  title: string;
  venue: string | null;
  startDate: string;
  endDate: string;
  status: WorkshopStatus;
  capacity: number;
  slug: string;
};

export type WorkshopDetailData = {
  workshop: WorkshopDetail;
  participants: ParticipantWithSurveyStatus[];
  responseRate: { completed: number; total: number };
  averages: SurveyDimensionAverages;
  responses: SurveyResponseSummary[];
};

type WorkshopRow = {
  id: string;
  title: string;
  venue: string | null;
  start_date: string;
  end_date: string;
  capacity: number;
  status: WorkshopStatus;
  slug: string;
};

type ParticipantRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  job_title: string | null;
};

type SurveyTokenRow = {
  id: string;
  participant_id: string;
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
};

type SurveyResponseRow = {
  id: string;
  participant_id: string;
  content_rating: number;
  facilitator_rating: number;
  logistics_rating: number;
  overall_rating: number;
  highlights: string | null;
  improvements: string | null;
  additional_comments: string | null;
  submitted_at: string;
};

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export async function getWorkshopDetailData(slug: string): Promise<WorkshopDetailData | null> {
  const supabase = await createClient();

  const { data: workshopRow, error: workshopError } = await supabase
    .from("workshops")
    .select("id, title, venue, start_date, end_date, capacity, status, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (workshopError) {
    throw new Error(workshopError.message);
  }

  if (!workshopRow) {
    return null;
  }

  const workshopRowTyped = workshopRow as WorkshopRow;

  const workshop: WorkshopDetail = {
    id: workshopRowTyped.id,
    title: workshopRowTyped.title,
    venue: workshopRowTyped.venue,
    startDate: workshopRowTyped.start_date,
    endDate: workshopRowTyped.end_date,
    status: workshopRowTyped.status,
    capacity: workshopRowTyped.capacity,
    slug: workshopRowTyped.slug,
  };

  const [participantsResult, tokensResult, responsesResult] = await Promise.all([
    supabase
      .from("participants")
      .select("id, first_name, last_name, email, company, job_title")
      .eq("workshop_slug", workshop.slug)
      .order("created_at", { ascending: true }),
    supabase
      .from("survey_tokens")
      .select("id, participant_id, sent_at, opened_at, completed_at")
      .eq("workshop_id", workshop.id),
    supabase
      .from("survey_responses")
      .select(
        "id, participant_id, content_rating, facilitator_rating, logistics_rating, overall_rating, highlights, improvements, additional_comments, submitted_at"
      )
      .eq("workshop_id", workshop.id)
      .order("submitted_at", { ascending: false }),
  ]);

  if (participantsResult.error) {
    throw new Error(participantsResult.error.message);
  }

  if (tokensResult.error) {
    throw new Error(tokensResult.error.message);
  }

  if (responsesResult.error) {
    throw new Error(responsesResult.error.message);
  }

  const participantRows: ParticipantRow[] = participantsResult.data ?? [];
  const tokenRows: SurveyTokenRow[] = tokensResult.data ?? [];
  const responseRows: SurveyResponseRow[] = responsesResult.data ?? [];

  const tokenByParticipantId = new Map(tokenRows.map((token) => [token.participant_id, token]));
  const firstNameByParticipantId = new Map(
    participantRows.map((participant) => [participant.id, participant.first_name])
  );

  const participants: ParticipantWithSurveyStatus[] = participantRows.map((participant) => {
    const token = tokenByParticipantId.get(participant.id) ?? null;

    let surveyStatus: SurveyStatus = "not_sent";
    if (token?.completed_at) {
      surveyStatus = "completed";
    } else if (token?.opened_at) {
      surveyStatus = "opened";
    } else if (token?.sent_at) {
      surveyStatus = "sent";
    }

    return {
      id: participant.id,
      firstName: participant.first_name,
      lastName: participant.last_name,
      email: participant.email,
      company: participant.company,
      jobTitle: participant.job_title,
      surveyStatus,
      sentAt: token?.sent_at ?? null,
      openedAt: token?.opened_at ?? null,
      completedAt: token?.completed_at ?? null,
    };
  });

  const responses: SurveyResponseSummary[] = responseRows.map((response) => ({
    id: response.id,
    participantFirstName: firstNameByParticipantId.get(response.participant_id) ?? "Participant",
    contentRating: response.content_rating,
    facilitatorRating: response.facilitator_rating,
    logisticsRating: response.logistics_rating,
    overallRating: response.overall_rating,
    highlights: response.highlights,
    improvements: response.improvements,
    additionalComments: response.additional_comments,
    submittedAt: response.submitted_at,
  }));

  const averages: SurveyDimensionAverages = {
    content: average(responseRows.map((row) => row.content_rating)),
    facilitator: average(responseRows.map((row) => row.facilitator_rating)),
    logistics: average(responseRows.map((row) => row.logistics_rating)),
    overall: average(responseRows.map((row) => row.overall_rating)),
  };

  return {
    workshop,
    participants,
    responseRate: { completed: responseRows.length, total: participantRows.length },
    averages,
    responses,
  };
}
