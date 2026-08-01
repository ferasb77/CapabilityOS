import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PortalAccessStatus = "not_invited" | "invited" | "active" | "inactive";

const LABEL: Record<PortalAccessStatus, string> = {
  not_invited: "Not Invited",
  invited: "Invited",
  active: "Active",
  inactive: "Inactive",
};

export function portalAccessStatus(input: {
  portalInvitedAt: string | null;
  portalInvitationAcceptedAt: string | null;
  portalAccessActive: boolean;
}): PortalAccessStatus {
  if (!input.portalInvitedAt) return "not_invited";
  if (!input.portalAccessActive) return "inactive";
  return input.portalInvitationAcceptedAt ? "active" : "invited";
}

export function PortalAccessStatusBadge({ status }: { status: PortalAccessStatus }) {
  if (status === "active") {
    return <Badge className="border-transparent bg-emerald-500/15 text-emerald-400">{LABEL[status]}</Badge>;
  }

  if (status === "invited") {
    return (
      <Badge variant="outline" className="border-gold/40 text-gold">
        {LABEL[status]}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("border-transparent bg-muted text-muted-foreground")}>
      {LABEL[status]}
    </Badge>
  );
}
