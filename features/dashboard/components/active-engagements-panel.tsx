import Link from "next/link";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateShort } from "@/features/intelligence/format";
import type { DashboardData } from "@/infrastructure/repositories/dashboard";

export function ActiveEngagementsPanel({
  engagements,
  totalCount,
}: {
  engagements: DashboardData["activeEngagementsDetail"];
  totalCount: number;
}) {
  return (
    <Card className="flex h-full flex-col bg-surface-elevated">
      <CardHeader>
        <CardTitle>Active Engagements</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {engagements.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No active engagements.</p>
        ) : (
          engagements.map((engagement) => (
            <Link
              key={engagement.id}
              href={`/dashboard/clients/${engagement.clientId}/engagements/${engagement.id}`}
              className="block rounded-lg border border-border-subtle bg-night/40 p-3 transition-colors hover:border-gold/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ivory">{engagement.clientName}</p>
                  <p className="text-sm text-muted-foreground">{engagement.title}</p>
                </div>
                <p className="text-sm font-medium text-gold">{formatCurrency(engagement.contractValue)}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  {engagement.experiencesDelivered} of {engagement.experiencesTotal} experiences delivered
                </span>
                <span>
                  {engagement.nextDeliveryDate ? `Next: ${formatDateShort(engagement.nextDeliveryDate)}` : "No upcoming experiences"}
                </span>
              </div>
            </Link>
          ))
        )}
      </CardContent>
      <CardFooter>
        <Link href="/dashboard/clients" className="text-sm font-medium text-gold hover:underline">
          View all {totalCount} engagement{totalCount === 1 ? "" : "s"} →
        </Link>
      </CardFooter>
    </Card>
  );
}
