import { Badge } from "@/components/ui/badge";
import { MILESTONE_TRIGGER_TYPE_LABELS, type MilestoneTriggerType } from "@/features/financial/schema";

export function MilestoneTriggerBadge({ triggerType }: { triggerType: MilestoneTriggerType }) {
  return (
    <Badge variant="outline" className="border-border-subtle text-muted-foreground">
      {MILESTONE_TRIGGER_TYPE_LABELS[triggerType]}
    </Badge>
  );
}
