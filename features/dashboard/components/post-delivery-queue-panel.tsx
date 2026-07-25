import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData } from "@/infrastructure/repositories/dashboard";

export function PostDeliveryQueuePanel({ items }: { items: DashboardData["postDeliveryQueue"] }) {
  return (
    <Card className="flex h-full flex-col bg-surface-elevated">
      <CardHeader>
        <CardTitle>Post-Delivery Queue</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-emerald-400" />
            All caught up — no post-delivery items outstanding.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.navigationUrl}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-night/40 px-3 py-2 transition-colors hover:border-gold/40"
                >
                  <span className="text-sm text-ivory">{item.label}</span>
                  <span className="text-sm font-semibold text-gold">{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
