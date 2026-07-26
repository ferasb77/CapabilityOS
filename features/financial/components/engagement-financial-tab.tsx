import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EngagementFinancialSummary, Milestone } from "@/features/financial/data";

import { AddMilestoneButton } from "./add-milestone-button";
import { MilestoneRowActions } from "./milestone-row-actions";
import { MilestoneStatusBadge } from "./milestone-status-badge";
import { MilestoneTriggerBadge } from "./milestone-trigger-badge";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  engagementId: string;
  clientId: string;
  summary: EngagementFinancialSummary;
  milestones: Milestone[];
  experiences: { id: string; title: string; slug: string }[];
  financeContactEmail: string | null;
};

export function EngagementFinancialTab({ engagementId, summary, milestones, experiences, financeContactEmail }: Props) {
  const experienceOptions = experiences.map((e) => ({ id: e.id, title: e.title }));

  return (
    <div className="space-y-6">
      <Card className="bg-surface-elevated">
        <CardContent className="grid grid-cols-2 gap-4 py-6 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <p className="text-sm text-muted-foreground">Total Contract Value</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-gold">
              {formatCurrency(summary.totalContractValue, summary.currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Collected</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-emerald-400">
              {formatCurrency(summary.collected, summary.currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Invoiced</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-amber-400">
              {formatCurrency(summary.invoiced, summary.currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Triggered</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-sky-400">
              {formatCurrency(summary.triggered, summary.currency)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-muted-foreground">
              {formatCurrency(summary.pending, summary.currency)}
            </p>
          </div>
          <div className="col-span-2 border-t border-border-subtle pt-4 sm:col-span-3 lg:col-span-5">
            <p className="text-sm text-muted-foreground">
              Outstanding (triggered + invoiced):{" "}
              <span className="font-medium text-ivory">{formatCurrency(summary.outstanding, summary.currency)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-elevated">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Payment Milestones</CardTitle>
            <CardDescription>
              {milestones.length} milestone{milestones.length === 1 ? "" : "s"}
            </CardDescription>
          </div>
          <AddMilestoneButton engagementId={engagementId} experiences={experienceOptions} />
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No payment milestones yet.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Milestone</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Key Dates</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {milestones.map((milestone) => {
                      const pct =
                        summary.totalContractValue > 0
                          ? Math.round((milestone.amount / summary.totalContractValue) * 1000) / 10
                          : 0;

                      return (
                        <TableRow key={milestone.id}>
                          <TableCell>
                            <p className="font-medium text-ivory">{milestone.title}</p>
                            {milestone.description && (
                              <p className="mt-0.5 text-sm text-muted-foreground">{milestone.description}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <MilestoneTriggerBadge triggerType={milestone.triggerType} />
                              {milestone.triggerExperienceSlug && (
                                <Link
                                  href={`/dashboard/experiences/${milestone.triggerExperienceSlug}`}
                                  className="block text-xs text-gold hover:underline"
                                >
                                  {milestone.triggerExperienceTitle}
                                </Link>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <p className="text-ivory">{formatCurrency(milestone.amount, milestone.currency)}</p>
                            <p className="text-xs text-muted-foreground">{pct}%</p>
                          </TableCell>
                          <TableCell>
                            <MilestoneStatusBadge status={milestone.status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <p>Triggered: {formatDate(milestone.triggeredAt)}</p>
                            <p>Invoiced: {formatDate(milestone.invoicedAt)}</p>
                            <p>Collected: {formatDate(milestone.collectedAt)}</p>
                            {milestone.dueDate && <p>Due: {formatDate(milestone.dueDate)}</p>}
                          </TableCell>
                          <TableCell>
                            <MilestoneRowActions milestone={milestone} engagementId={engagementId} experiences={experienceOptions} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <ul className="space-y-3 lg:hidden">
                {milestones.map((milestone) => {
                  const pct =
                    summary.totalContractValue > 0
                      ? Math.round((milestone.amount / summary.totalContractValue) * 1000) / 10
                      : 0;

                  return (
                    <li key={milestone.id} className="rounded-lg border border-border-subtle bg-night/40 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-ivory">{milestone.title}</p>
                        <MilestoneStatusBadge status={milestone.status} />
                      </div>
                      <p className="mt-1 text-sm text-ivory">
                        {formatCurrency(milestone.amount, milestone.currency)}{" "}
                        <span className="text-xs text-muted-foreground">({pct}%)</span>
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <MilestoneTriggerBadge triggerType={milestone.triggerType} />
                        {milestone.triggerExperienceSlug && (
                          <Link
                            href={`/dashboard/experiences/${milestone.triggerExperienceSlug}`}
                            className="text-xs text-gold hover:underline"
                          >
                            {milestone.triggerExperienceTitle}
                          </Link>
                        )}
                      </div>
                      <div className="mt-3">
                        <MilestoneRowActions milestone={milestone} engagementId={engagementId} experiences={experienceOptions} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-surface-elevated">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
          <p className="text-muted-foreground">
            Invoice notifications will be sent to:{" "}
            <span className="text-ivory">{financeContactEmail ?? "No finance contact configured"}</span>
          </p>
          <Link href="/dashboard/settings/finance" className="font-medium text-gold hover:underline">
            Manage finance settings →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
