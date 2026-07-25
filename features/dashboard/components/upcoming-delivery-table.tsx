import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/infrastructure/repositories/dashboard";

import { ReadinessBadge } from "./readiness-badge";

function formatStartDate(value: string, today: Date): string {
  const start = new Date(value);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffDays = Math.round((startDay.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return start.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

type Props = {
  rows: DashboardData["upcomingDelivery"];
  summary: DashboardData["upcomingDeliverySummary"];
};

export function UpcomingDeliveryTable({ rows, summary }: Props) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Upcoming Delivery</CardTitle>
        <p className="text-sm text-muted-foreground">
          {summary.ready} experience{summary.ready === 1 ? "" : "s"} ready · {summary.attention} need attention ·{" "}
          {summary.atRisk} at risk
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled in the next 90 days.</p>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead className="text-right">Participants</TableHead>
                    <TableHead>Facilitator</TableHead>
                    <TableHead>Readiness</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className="relative cursor-pointer hover:bg-night/40">
                      <TableCell className="font-medium text-ivory">
                        <Link href={`/dashboard/experiences/${row.slug}`} className="absolute inset-0" aria-label={row.title} />
                        {formatStartDate(row.startDate, todayStart)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.clientName ?? "—"}</TableCell>
                      <TableCell className="text-ivory">{row.title}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.participantCount} / {row.capacity}
                      </TableCell>
                      <TableCell className={cn(row.facilitatorName ? "text-muted-foreground" : "font-medium text-destructive")}>
                        {row.facilitatorName ?? "— Unassigned"}
                      </TableCell>
                      <TableCell>
                        <ReadinessBadge readiness={row.readiness} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="space-y-3 md:hidden">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/dashboard/experiences/${row.slug}`}
                    className="block rounded-lg border border-border-subtle bg-night/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium text-ivory">{row.title}</p>
                      <ReadinessBadge readiness={row.readiness} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatStartDate(row.startDate, todayStart)} · {row.clientName ?? "No client"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.participantCount} / {row.capacity} participants
                    </p>
                    <p className={cn("text-sm", row.facilitatorName ? "text-muted-foreground" : "font-medium text-destructive")}>
                      {row.facilitatorName ?? "— Unassigned"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
