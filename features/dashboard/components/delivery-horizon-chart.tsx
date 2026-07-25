import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/infrastructure/repositories/dashboard";

export function DeliveryHorizonChart({ months }: { months: DashboardData["deliveryHorizon"] }) {
  const maxCount = Math.max(...months.map((m) => m.count), 1);
  const peak = months.reduce((best, m) => (m.count > best.count ? m : best), months[0]);

  return (
    <Card className="flex h-full flex-col bg-surface-elevated">
      <CardHeader>
        <CardTitle>Delivery Horizon</CardTitle>
        <p className="text-sm text-muted-foreground">Next 90 days</p>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {months.map((month) => (
          <div key={`${month.year}-${month.month}`} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-sm text-muted-foreground">{month.monthLabel}</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-night/60">
              <div
                className={cn("h-full rounded-full", month.isCurrentMonth ? "bg-gold" : "bg-gold/40")}
                style={{ width: `${month.count === 0 ? 0 : Math.max((month.count / maxCount) * 100, 6)}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-sm font-medium text-ivory">{month.count}</span>
          </div>
        ))}

        {peak && peak.count > 0 && (
          <p className="pt-1 text-xs text-muted-foreground">
            Peak month: {peak.monthLabel} with {peak.count} experience{peak.count === 1 ? "" : "s"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
