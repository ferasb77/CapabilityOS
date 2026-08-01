import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FacilitatorProfile } from "../data";

import { PortalAccessActions } from "./portal-access-actions";
import { portalAccessStatus, PortalAccessStatusBadge } from "./portal-access-status-badge";

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Props = { facilitator: FacilitatorProfile };

export function PortalAccessSection({ facilitator }: Props) {
  const status = portalAccessStatus(facilitator);

  return (
    <Card className="bg-surface-elevated">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            Portal Access
            <PortalAccessStatusBadge status={status} />
          </CardTitle>
          <CardDescription>
            {status === "not_invited"
              ? "This facilitator hasn't been invited to their portal yet."
              : `Invited ${formatDate(facilitator.portalInvitedAt)}${
                  facilitator.portalInvitationAcceptedAt ? ` · Accepted ${formatDate(facilitator.portalInvitationAcceptedAt)}` : ""
                }`}
          </CardDescription>
        </div>
        <PortalAccessActions facilitatorId={facilitator.id} status={status} />
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Portal access lets this facilitator sign in to view their assigned programs, manage their own profile, and
          update their availability.
        </p>
      </CardContent>
    </Card>
  );
}
