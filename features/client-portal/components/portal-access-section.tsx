import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PortalUserSummary } from "../data";

import { InvitePortalUserSheet } from "./invite-portal-user-sheet";
import { PortalUserRowActions } from "./portal-user-row-actions";
import { PortalUserStatusBadge } from "./portal-user-status-badge";

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  clientId: string;
  portalUsers: PortalUserSummary[];
};

export function PortalAccessSection({ clientId, portalUsers }: Props) {
  return (
    <Card className="bg-surface-elevated">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Portal Access</CardTitle>
          <CardDescription>
            {portalUsers.length} {portalUsers.length === 1 ? "person" : "people"} with access to this client&apos;s
            training portal.
          </CardDescription>
        </div>
        <InvitePortalUserSheet clientId={clientId} />
      </CardHeader>
      <CardContent>
        {portalUsers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No one has been invited to this client&apos;s portal yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {portalUsers.map((user) => (
              <li
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-night/40 p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ivory">{user.fullName}</p>
                    <PortalUserStatusBadge status={user.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {user.email}
                    {user.jobTitle ? ` · ${user.jobTitle}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Last seen: {formatDate(user.lastSeenAt)}</p>
                </div>

                <PortalUserRowActions portalUserId={user.id} status={user.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
