import { Badge } from "@/components/ui/badge";
import type { ExperienceReadiness } from "@/infrastructure/repositories/dashboard";

const READINESS_CONFIG: Record<ExperienceReadiness, { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-emerald-500/15 text-emerald-400" },
  attention: { label: "Attention", className: "bg-gold/15 text-gold" },
  at_risk: { label: "At Risk", className: "bg-destructive/15 text-destructive" },
};

export function ReadinessBadge({ readiness }: { readiness: ExperienceReadiness }) {
  const config = READINESS_CONFIG[readiness];
  return <Badge className={config.className}>{config.label}</Badge>;
}
