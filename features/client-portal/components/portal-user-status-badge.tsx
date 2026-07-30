import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PortalUserStatus } from "../data";

const LABEL: Record<PortalUserStatus, string> = {
  invited: "Invited",
  active: "Active",
  inactive: "Inactive",
};

export function PortalUserStatusBadge({ status }: { status: PortalUserStatus }) {
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
