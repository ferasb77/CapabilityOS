import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InsightCard as InsightCardData } from "@/features/intelligence/insights";

const TYPE_STYLES: Record<InsightCardData["type"], { icon: string; accent: string }> = {
  positive: { icon: "text-gold", accent: "border-gold/25" },
  warning: { icon: "text-amber-500", accent: "border-amber-500/25" },
  neutral: { icon: "text-muted-foreground", accent: "border-border-subtle" },
};

export function InsightCardView({ insight }: { insight: InsightCardData }) {
  const Icon = insight.icon;
  const styles = TYPE_STYLES[insight.type];

  return (
    <Card className={cn("bg-surface-elevated", styles.accent)}>
      <CardContent className="flex items-start gap-3 p-4">
        <Icon className={cn("mt-0.5 size-5 shrink-0", styles.icon)} />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-ivory">{insight.headline}</p>
          <p className="text-sm text-muted-foreground">{insight.detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function InsightGrid({ insights }: { insights: InsightCardData[] }) {
  if (insights.length === 0) {
    return <p className="text-sm text-muted-foreground">Not enough data yet to generate insights.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {insights.map((insight, index) => (
        <InsightCardView key={`${insight.headline}-${index}`} insight={insight} />
      ))}
    </div>
  );
}
