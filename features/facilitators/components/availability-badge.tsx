import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AvailabilityStatus } from "@/features/facilitators/data";

const LABEL: Record<AvailabilityStatus, string> = {
  available: "Available",
  partially_available: "Partially Available",
  unavailable: "Unavailable",
};

const TONE: Record<AvailabilityStatus, string> = {
  available: "bg-emerald-500/15 text-emerald-400",
  partially_available: "bg-amber-500/15 text-amber-400",
  unavailable: "bg-destructive/15 text-destructive",
};

type Props = {
  status: AvailabilityStatus;
  className?: string;
};

export function AvailabilityBadge({ status, className }: Props) {
  return (
    <Badge variant="outline" className={cn("border-transparent", TONE[status], className)}>
      {LABEL[status]}
    </Badge>
  );
}
