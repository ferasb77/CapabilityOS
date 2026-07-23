import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SurveyDimensionAverages, SurveyResponseSummary } from "@/infrastructure/repositories/surveys";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AverageBar({ label, value }: { label: string; value: number | null }) {
  const percent = value ? (value / 5) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-heading text-lg font-semibold text-gold">
          {value !== null ? value.toFixed(1) : "—"}
        </p>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-night/60">
        <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

type Props = {
  averages: SurveyDimensionAverages;
  responseRate: { completed: number; total: number };
  responses: SurveyResponseSummary[];
};

export function SurveyResultsPanel({ averages, responseRate, responses }: Props) {
  return (
    <div className="space-y-6">
      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Survey Results</CardTitle>
          <CardDescription>
            {responseRate.completed} of {responseRate.total} participants completed the survey.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <AverageBar label="Content" value={averages.content} />
          <AverageBar label="Facilitator" value={averages.facilitator} />
          <AverageBar label="Logistics" value={averages.logistics} />
          <AverageBar label="Overall" value={averages.overall} />
        </CardContent>
      </Card>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Individual Responses</CardTitle>
          <CardDescription>
            {responses.length} response{responses.length === 1 ? "" : "s"} received.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {responses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No responses yet.</p>
          ) : (
            <ul className="space-y-6">
              {responses.map((response) => (
                <li key={response.id} className="rounded-lg border border-border-subtle p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-ivory">{response.participantFirstName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(response.submittedAt)}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-4">
                    <p>
                      Content: <span className="text-gold">{response.contentRating}/5</span>
                    </p>
                    <p>
                      Facilitator: <span className="text-gold">{response.facilitatorRating}/5</span>
                    </p>
                    <p>
                      Logistics: <span className="text-gold">{response.logisticsRating}/5</span>
                    </p>
                    <p>
                      Overall: <span className="text-gold">{response.overallRating}/5</span>
                    </p>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    {response.highlights && (
                      <p>
                        <span className="text-muted-foreground">Most valuable: </span>
                        {response.highlights}
                      </p>
                    )}
                    {response.improvements && (
                      <p>
                        <span className="text-muted-foreground">Could improve: </span>
                        {response.improvements}
                      </p>
                    )}
                    {response.additionalComments && (
                      <p>
                        <span className="text-muted-foreground">Other comments: </span>
                        {response.additionalComments}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
