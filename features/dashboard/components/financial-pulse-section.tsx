import Link from "next/link";
import { AlertCircle, DollarSign, FileClock, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDateShort } from "@/features/intelligence/format";
import type { FinancialPulse, RecentMilestoneActivity } from "@/features/financial/data";
import { MILESTONE_STATUS_LABELS } from "@/features/financial/schema";

import { PulseCard } from "./pulse-card";

const STATUS_BADGE_CLASSNAME: Record<RecentMilestoneActivity["status"], string> = {
  pending: "bg-muted text-muted-foreground",
  triggered: "bg-sky-500/15 text-sky-400",
  invoiced: "bg-amber-500/15 text-amber-400",
  collected: "bg-emerald-500/15 text-emerald-400",
  overdue: "bg-destructive/15 text-destructive",
};

export function FinancialPulseSection({ pulse }: { pulse: FinancialPulse }) {
  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Financial Pulse</CardTitle>
        <CardDescription>
          Contract value, collections, and receivables across active engagements, in {pulse.primaryCurrency}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {pulse.hasOtherCurrencies && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            Some engagements or milestones use a different currency and aren&apos;t included in the totals below — figures
            here only cover {pulse.primaryCurrency} activity.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <PulseCard
            icon={Wallet}
            label="Total Active Contract Value"
            value={formatCurrency(pulse.totalActiveContractValue)}
            subtext="Across active engagements"
          />
          <PulseCard
            icon={DollarSign}
            label="Collected This Year"
            value={formatCurrency(pulse.collectedThisYear)}
            valueClassName="text-emerald-400"
            subtext="Milestones collected in the current year"
          />
          <PulseCard
            icon={FileClock}
            label="Invoiced — Awaiting Payment"
            value={formatCurrency(pulse.invoicedAwaitingPayment)}
            valueClassName="text-amber-400"
            subtext="Sent, not yet collected"
          />
          <PulseCard
            icon={AlertCircle}
            label="Triggered — Invoice Not Sent"
            value={formatCurrency(pulse.triggeredNotInvoiced)}
            valueClassName={pulse.triggeredNotInvoiced > 0 ? "text-amber-400" : undefined}
            subtext="Milestone hit, invoice pending"
          />
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-ivory">Recent financial activity</p>
          {pulse.recentActivity.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No recent milestone activity.</p>
          ) : (
            <ul className="space-y-2">
              {pulse.recentActivity.map((row) => (
                <li key={row.id}>
                  <Link
                    href={row.engagementUrl}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-night/40 p-3 transition-colors hover:border-gold/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ivory">
                        {row.clientName} — {row.engagementTitle}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {row.milestoneTitle} · {formatDateShort(row.date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium text-gold">{formatCurrency(row.amount)}</span>
                      <Badge className={STATUS_BADGE_CLASSNAME[row.status]}>{MILESTONE_STATUS_LABELS[row.status]}</Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
