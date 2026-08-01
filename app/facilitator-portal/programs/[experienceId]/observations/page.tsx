import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FacilitatorPortalHeader } from "@/features/facilitator-portal/components/facilitator-portal-header";
import { getFacilitatorExperienceDetail, getFacilitatorPortalSessionContext } from "@/features/facilitator-portal/data";
import { getExperienceParticipants } from "@/features/experiences/data";
import {
  getAllExperienceObservations,
  getAllParticipantObservations,
  getFacilitatorReport,
} from "@/features/observations/data";

type Props = {
  params: Promise<{ experienceId: string }>;
};

/**
 * Read-only — the operator dashboard's Observations tab (features/observations)
 * writes through Server Actions keyed to an operator session
 * (infrastructure/session/session-context.ts), which a facilitator-portal
 * session can't satisfy (no `profiles` row). Rather than thread a
 * facilitator identity through five operator-facing mutation actions, this
 * page surfaces what's already been recorded — every facilitator's
 * participant/overall observations and the generated report — for the
 * facilitator to review from their own portal.
 */
export default async function FacilitatorObservationsPage({ params }: Props) {
  const { experienceId } = await params;
  const portalUser = await getFacilitatorPortalSessionContext();

  const experience = await getFacilitatorExperienceDetail(experienceId, portalUser.email);
  if (!experience) {
    notFound();
  }

  const [participants, participantObservations, experienceObservations, report] = await Promise.all([
    getExperienceParticipants(experienceId),
    getAllParticipantObservations(experienceId),
    getAllExperienceObservations(experienceId),
    getFacilitatorReport(experienceId),
  ]);

  const participantNameById = new Map(participants.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));

  return (
    <main className="min-h-screen bg-night text-ivory">
      <FacilitatorPortalHeader fullName={portalUser.fullName} photoUrl={portalUser.photoUrl} />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <Link
          href="/facilitator-portal/programs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
        >
          <ArrowLeft className="size-4" />
          Back to My Programs
        </Link>

        <div>
          <h1 className="font-heading text-2xl font-semibold text-ivory">Observations</h1>
          <p className="mt-1 text-sm text-muted-foreground">{experience.title}</p>
        </div>

        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Participant Observations</CardTitle>
          </CardHeader>
          <CardContent>
            {participantObservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No participant observations recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {participantObservations.map((observation) => (
                  <li key={observation.id} className="rounded-lg border border-border-subtle bg-night/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ivory">
                        {participantNameById.get(observation.participantId) ?? "Participant"}
                      </p>
                      <span className="text-xs text-muted-foreground">by {observation.facilitatorName}</span>
                    </div>
                    {observation.notes && <p className="mt-1 text-sm text-muted-foreground">{observation.notes}</p>}
                    {observation.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {observation.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Overall Observations</CardTitle>
          </CardHeader>
          <CardContent>
            {experienceObservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overall observations recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {experienceObservations.map((observation) => (
                  <li key={observation.id} className="rounded-lg border border-border-subtle bg-night/40 p-3">
                    <p className="text-xs font-medium text-gold">{observation.facilitatorName}</p>
                    {observation.keyThemes && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        <span className="text-ivory">Key themes:</span> {observation.keyThemes}
                      </p>
                    )}
                    {observation.groupDynamics && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        <span className="text-ivory">Group dynamics:</span> {observation.groupDynamics}
                      </p>
                    )}
                    {observation.recommendations && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        <span className="text-ivory">Recommendations:</span> {observation.recommendations}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="bg-surface-elevated">
          <CardHeader>
            <CardTitle>Facilitator Report</CardTitle>
          </CardHeader>
          <CardContent>
            {!report ? (
              <p className="text-sm text-muted-foreground">No report has been generated for this program yet.</p>
            ) : (
              <div className="space-y-2">
                <Badge variant="outline" className="border-gold/40 text-gold">
                  {report.status}
                </Badge>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {report.editedContent ?? report.draftContent}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
