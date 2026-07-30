"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { PortalUserStatus } from "../data";

import { deactivatePortalUser, resendInvitation } from "../actions";

type Props = {
  portalUserId: string;
  status: PortalUserStatus;
};

export function PortalUserRowActions({ portalUserId, status }: Props) {
  const [isActive, setIsActive] = useState(status !== "inactive");
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleResend() {
    setResendState("sending");
    setError(null);

    startTransition(async () => {
      const result = await resendInvitation(portalUserId);
      if (!result.success) {
        setError(result.error);
        setResendState("idle");
        return;
      }
      setResendState("sent");
    });
  }

  function handleToggleActive() {
    const next = !isActive;
    setIsActive(next);
    setError(null);

    startTransition(async () => {
      const result = await deactivatePortalUser(portalUserId);
      if (!result.success) {
        setIsActive(!next);
        setError(result.error);
        return;
      }
      setIsActive(result.isActive);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {status === "invited" && (
          <Button type="button" variant="outline" size="sm" disabled={resendState !== "idle"} onClick={handleResend}>
            {resendState === "sending" ? "Sending..." : resendState === "sent" ? "Sent" : "Resend Invitation"}
          </Button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{isActive ? "Active" : "Deactivated"}</span>
          <Switch checked={isActive} onCheckedChange={handleToggleActive} aria-label="Toggle portal access" />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
