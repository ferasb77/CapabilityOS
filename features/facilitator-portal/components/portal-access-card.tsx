"use client";

import { useState } from "react";
import { Shield, Send, RefreshCw, Power } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  inviteFacilitatorToPortal,
  resendFacilitatorInvitation,
  deactivateFacilitatorPortal,
} from "../actions";
import type { FacilitatorPortalAccessStatus } from "../data";

type Props = {
  facilitatorId: string;
  accessStatus: FacilitatorPortalAccessStatus | null;
};

export function PortalAccessCard({ facilitatorId, accessStatus }: Props) {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!accessStatus) return null;

  const handleInvite = async () => {
    setIsPending(true);
    setErrorMessage(null);
    const res = await inviteFacilitatorToPortal(facilitatorId);
    setIsPending(false);
    if (!res.success) {
      setErrorMessage(res.error);
    }
  };

  const handleResend = async () => {
    setIsPending(true);
    setErrorMessage(null);
    const res = await resendFacilitatorInvitation(facilitatorId);
    setIsPending(false);
    if (!res.success) {
      setErrorMessage(res.error);
    }
  };

  const handleToggleDeactivate = async () => {
    setIsPending(true);
    setErrorMessage(null);
    const res = await deactivateFacilitatorPortal(facilitatorId);
    setIsPending(false);
    if (!res.success) {
      setErrorMessage(res.error);
    }
  };

  const { status, invitedAt, invitationAcceptedAt } = accessStatus;

  return (
    <Card className="bg-surface-elevated border-border-subtle">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-bold text-ivory flex items-center gap-2">
            <Shield className="size-4 text-gold" /> Facilitator Portal Access
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Allow facilitator to log in, view assigned programs, update profile, and manage availability.
          </CardDescription>
        </div>

        <Badge
          variant="outline"
          className={
            status === "active"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : status === "invited"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
              : status === "inactive"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : "border-border-subtle bg-muted/10 text-muted-foreground"
          }
        >
          {status === "active"
            ? "Active User"
            : status === "invited"
            ? "Invitation Sent"
            : status === "inactive"
            ? "Deactivated"
            : "Not Invited"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {errorMessage && (
          <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-foreground">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-2 text-xs text-muted-foreground">
          {invitedAt && (
            <p>
              <span className="text-ivory font-medium">Invited:</span>{" "}
              {new Date(invitedAt).toLocaleDateString()}
            </p>
          )}
          {invitationAcceptedAt && (
            <p>
              <span className="text-ivory font-medium">Account Activated:</span>{" "}
              {new Date(invitationAcceptedAt).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle/50">
          {status === "not_invited" && (
            <Button
              size="sm"
              onClick={handleInvite}
              disabled={isPending}
              className="gap-2 text-xs"
            >
              <Send className="size-3.5" />
              {isPending ? "Sending..." : "Invite to Portal"}
            </Button>
          )}

          {status === "invited" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={isPending}
              className="gap-2 text-xs border-border-subtle"
            >
              <RefreshCw className="size-3.5" />
              {isPending ? "Resending..." : "Resend Invitation"}
            </Button>
          )}

          {(status === "active" || status === "invited") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleDeactivate}
              disabled={isPending}
              className="gap-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Power className="size-3.5" />
              Deactivate Portal Access
            </Button>
          )}

          {status === "inactive" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleDeactivate}
              disabled={isPending}
              className="gap-2 text-xs border-border-subtle"
            >
              <Power className="size-3.5" />
              Reactivate Portal Access
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
