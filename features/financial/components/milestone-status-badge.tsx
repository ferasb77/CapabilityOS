import { Badge } from "@/components/ui/badge";
import { MILESTONE_STATUS_LABELS, type MilestoneStatus } from "@/features/financial/schema";

const STATUS_STYLE: Record<MilestoneStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  triggered: "bg-sky-500/15 text-sky-400",
  invoiced: "bg-amber-500/15 text-amber-400",
  collected: "bg-emerald-500/15 text-emerald-400",
  overdue: "bg-destructive/15 text-destructive",
};

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return <Badge className={STATUS_STYLE[status]}>{MILESTONE_STATUS_LABELS[status]}</Badge>;
}
