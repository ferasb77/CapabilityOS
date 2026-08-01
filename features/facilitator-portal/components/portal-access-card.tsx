"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { FacilitatorPortalAccess, FacilitatorPortalAccessStatus } from "../data";

import { inviteFacilitatorToPortal, resendFacilitatorInvitation, togglePortalAccess } from "../actions";

const STATUS_LABEL: Record<FacilitatorPortalAccessStatus, string> = {
  not_invited: "Not Invited",
  invited: "Invited",
  active: "Active",
  inactive: "Inactive",
};

function StatusBadge({ status }: { status: FacilitatorPortalAccessStatus }) {
  if (status === "active") {
    return <Badge className="border-transparent bg-emerald-500/15 text-emerald-400">{STATUS_LABEL[status]}</Badge>;
  }
  if (status === "invited") {
    return (
      <Badge variant="outline" className="border-gold/40 text-gold">
        {STATUS_LABEL[status]}
      </Badge>
    );
  }
  if (status === "inactive") {
    return (
      <Badge variant="outline" className="border-destructive/40 text-destructive">
        {STATUS_LABEL[status]}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-transparent bg-muted text-muted-foreground">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  facilitatorId: string;
  access: FacilitatorPortalAccess;
};

export function PortalAccessCard({ facilitatorId, access }: Props) {
  const [status, setStatus] = useState(access.status);
  const [inviteState, setInviteState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleInvite() {
    setInviteState("sending");
    setError(null);

    startTransition(async () => {
      const result = await inviteFacilitatorToPortal(facilitatorId);
      if (!result.success) {
        setError(result.error);
        setInviteState("idle");
        return;
      }
      setInviteState("sent");
      setStatus("invited");
    });
  }

  function handleResend() {
    setInviteState("sending");
    setError(null);

    startTransition(async () => {
      const result = await resendFacilitatorInvitation(facilitatorId);
      if (!result.success) {
        setError(result.error);
        setInviteState("idle");
        return;
      }
      setInviteState("sent");
    });
  }

  function handleToggleActive() {
    setError(null);

    startTransition(async () => {
      const result = await togglePortalAccess(facilitatorId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStatus(result.isActive ? (access.invitationAcceptedAt ? "active" : "invited") : "inactive");
    });
  }

  return (
    <Card className="bg-surface-elevated">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div>
          <CardTitle>Portal Access</CardTitle>
          <CardDescription>Lets this facilitator sign in to view their programs, profile, and availability.</CardDescription>
        </div>
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span>Invited: {formatDate(access.invitedAt)}</span>
          <span>Accepted: {formatDate(access.invitationAcceptedAt)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {status === "not_invited" && (
            <Button type="button" size="sm" disabled={inviteState !== "idle"} onClick={handleInvite}>
              {inviteState === "sending" ? "Sending..." : inviteState === "sent" ? "Sent" : "Invite to Portal"}
            </Button>
          )}

          {status === "invited" && (
            <>
              <Button type="button" variant="outline" size="sm" disabled={inviteState !== "idle"} onClick={handleResend}>
                {inviteState === "sending" ? "Sending..." : inviteState === "sent" ? "Sent" : "Resend Invitation"}
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Active</span>
                <Switch checked onCheckedChange={handleToggleActive} aria-label="Deactivate portal access" />
              </div>
            </>
          )}

          {(status === "active" || status === "inactive") && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{status === "active" ? "Active" : "Deactivated"}</span>
              <Switch checked={status === "active"} onCheckedChange={handleToggleActive} aria-label="Toggle portal access" />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
