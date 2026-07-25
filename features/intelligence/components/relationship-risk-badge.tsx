import { Badge } from "@/components/ui/badge";

const RISK_CONFIG = {
  healthy: { label: "Healthy", className: "bg-gold/15 text-gold" },
  monitor: { label: "Monitor", className: "bg-amber-500/15 text-amber-500" },
  at_risk: { label: "At Risk", className: "bg-destructive/15 text-destructive" },
} as const;

export function RelationshipRiskBadge({ risk }: { risk: keyof typeof RISK_CONFIG }) {
  const config = RISK_CONFIG[risk];
  return <Badge className={config.className}>{config.label}</Badge>;
}

const TREND_CONFIG = {
  up: { symbol: "↑", className: "text-gold" },
  down: { symbol: "↓", className: "text-amber-500" },
  stable: { symbol: "→", className: "text-muted-foreground" },
} as const;

export function TrendArrow({ trend }: { trend: keyof typeof TREND_CONFIG }) {
  const config = TREND_CONFIG[trend];
  return <span className={config.className}>{config.symbol}</span>;
}
