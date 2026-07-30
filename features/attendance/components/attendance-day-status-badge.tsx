import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AttendanceDayStatus } from "../data";

const LABEL: Record<AttendanceDayStatus, string> = {
  complete: "Complete",
  in_progress: "In Progress",
  upcoming: "Upcoming",
  no_data: "No Data",
};

type Props = {
  status: AttendanceDayStatus;
  className?: string;
};

export function AttendanceDayStatusBadge({ status, className }: Props) {
  if (status === "complete") {
    return <Badge className={className}>{LABEL[status]}</Badge>;
  }

  if (status === "in_progress") {
    return (
      <Badge variant="outline" className={cn("border-gold/40 text-gold", className)}>
        {LABEL[status]}
      </Badge>
    );
  }

  if (status === "upcoming") {
    return (
      <Badge variant="secondary" className={className}>
        {LABEL[status]}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("border-transparent bg-muted text-muted-foreground", className)}>
      {LABEL[status]}
    </Badge>
  );
}
