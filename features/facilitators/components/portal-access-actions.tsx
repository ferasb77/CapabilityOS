"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  inviteFacilitatorToPortal,
  resendFacilitatorInvitation,
  togglePortalAccess,
} from "@/features/facilitator-portal/actions";

import type { PortalAccessStatus } from "./portal-access-status-badge";

type Props = {
  facilitatorId: string;
  status: PortalAccessStatus;
};

export function PortalAccessActions({ facilitatorId, status }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [isActive, setIsActive] = useState(status !== "inactive");
  const [isPending, startTransition] = useTransition();

  if (status === "not_invited") {
    return (
      <div>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await inviteFacilitatorToPortal(facilitatorId);
              if (!result.success) {
                setError(result.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          {isPending ? "Sending..." : "Invite to Portal"}
        </Button>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3">
        {status === "invited" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resendState !== "idle"}
            onClick={() => {
              setError(null);
              setResendState("sending");
              startTransition(async () => {
                const result = await resendFacilitatorInvitation(facilitatorId);
                if (!result.success) {
                  setError(result.error);
                  setResendState("idle");
                  return;
                }
                setResendState("sent");
              });
            }}
          >
            {resendState === "sending" ? "Sending..." : resendState === "sent" ? "Sent" : "Resend Invitation"}
          </Button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{isActive ? "Active" : "Deactivated"}</span>
          <Switch
            checked={isActive}
            onCheckedChange={() => {
              setError(null);
              const next = !isActive;
              setIsActive(next);
              startTransition(async () => {
                const result = await togglePortalAccess(facilitatorId);
                if (!result.success) {
                  setIsActive(!next);
                  setError(result.error);
                  return;
                }
                setIsActive(result.isActive);
                router.refresh();
              });
            }}
            aria-label="Toggle portal access"
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
