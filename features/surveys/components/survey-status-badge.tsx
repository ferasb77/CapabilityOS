import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SurveyStatus } from "@/infrastructure/repositories/surveys";

const LABEL: Record<SurveyStatus, string> = {
  not_sent: "Not Sent",
  sent: "Sent",
  opened: "Opened",
  completed: "Completed",
};

type Props = {
  status: SurveyStatus;
  className?: string;
};

export function SurveyStatusBadge({ status, className }: Props) {
  if (status === "completed") {
    return <Badge className={className}>{LABEL[status]}</Badge>;
  }

  if (status === "opened") {
    return (
      <Badge variant="outline" className={cn("border-gold/40 text-gold", className)}>
        {LABEL[status]}
      </Badge>
    );
  }

  if (status === "sent") {
    return (
      <Badge variant="secondary" className={className}>
        {LABEL[status]}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn("border-transparent bg-muted text-muted-foreground", className)}
    >
      {LABEL[status]}
    </Badge>
  );
}
