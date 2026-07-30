import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientLearningImpact } from "../data";

function deltaColor(delta: number | null): string {
  if (delta === null) return "text-muted-foreground";
  if (delta > 0) return "text-emerald-400";
  if (delta < 0) return "text-destructive";
  return "text-muted-foreground";
}

function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
}

function ResponseRateCard({
  label,
  rate,
}: {
  label: string;
  rate: { totalParticipants: number; sent: number; completed: number };
}) {
  const pct = rate.sent > 0 ? Math.round((rate.completed / rate.sent) * 100) : 0;

  return (
    <div className="rounded-lg border border-border-subtle bg-night/40 p-4">
      <p className="text-sm text-muted-foreground">{label} response rate</p>
      <p className="mt-1 font-heading text-2xl font-semibold text-gold">{pct}%</p>
      <p className="text-xs text-muted-foreground">
        {rate.completed} of {rate.sent} sent
      </p>
    </div>
  );
}

type Props = {
  data: ClientLearningImpact;
};

export function ClientLearningImpactTab({ data }: Props) {
  if (!data.configured) {
    return (
      <Card className="bg-surface-elevated">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Pre/post training surveys were not configured for this program.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <ResponseRateCard label="Pre-training" rate={data.responseRates.pre} />
        <ResponseRateCard label="Post-training" rate={data.responseRates.post} />
      </div>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Before / After Comparison</CardTitle>
          <CardDescription>
            {data.preTemplateName ?? "Pre-training survey"} vs. {data.postTemplateName ?? "post-training survey"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.matchedQuestions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No matched questions to compare.</p>
          ) : (
            <ul className="space-y-3">
              {data.matchedQuestions.map((question) => (
                <li key={question.questionText} className="rounded-lg border border-border-subtle bg-night/40 p-4">
                  <p className="text-sm font-medium text-ivory">{question.questionText}</p>
                  <div className="mt-2 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Before</p>
                      <p className="font-heading text-lg font-semibold text-ivory">
                        {question.preAverage !== null ? question.preAverage.toFixed(1) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">After</p>
                      <p className="font-heading text-lg font-semibold text-ivory">
                        {question.postAverage !== null ? question.postAverage.toFixed(1) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Change</p>
                      <p className={`font-heading text-lg font-semibold ${deltaColor(question.delta)}`}>
                        {formatDelta(question.delta)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {data.nps && (
            <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-border-subtle bg-night/40 p-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">NPS Before</p>
                <p className="font-heading text-lg font-semibold text-ivory">{data.nps.preScore ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">NPS After</p>
                <p className="font-heading text-lg font-semibold text-ivory">{data.nps.postScore ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Change</p>
                <p className={`font-heading text-lg font-semibold ${deltaColor(data.nps.delta)}`}>
                  {formatDelta(data.nps.delta)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {data.anonymizedTextResponses.length > 0 && (
        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Open Responses</CardTitle>
            <CardDescription>Shown anonymously.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.anonymizedTextResponses.map((question) => (
              <div key={question.questionText}>
                <p className="text-sm font-medium text-ivory">{question.questionText}</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Before</p>
                    <ul className="space-y-1.5">
                      {question.preAnswers.length === 0 ? (
                        <li className="text-sm text-muted-foreground">No responses.</li>
                      ) : (
                        question.preAnswers.map((answer, index) => (
                          <li key={index} className="rounded-lg border border-border-subtle bg-night/40 p-2.5 text-sm text-ivory">
                            {answer}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">After</p>
                    <ul className="space-y-1.5">
                      {question.postAnswers.length === 0 ? (
                        <li className="text-sm text-muted-foreground">No responses.</li>
                      ) : (
                        question.postAnswers.map((answer, index) => (
                          <li key={index} className="rounded-lg border border-border-subtle bg-night/40 p-2.5 text-sm text-ivory">
                            {answer}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
