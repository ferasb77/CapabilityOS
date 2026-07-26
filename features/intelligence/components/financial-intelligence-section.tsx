import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FinancialIntelligence } from "@/features/intelligence/data";
import { generateFinancialInsights } from "@/features/intelligence/insights";
import { formatCurrency } from "@/features/intelligence/format";

import { HorizontalBarChart } from "./bar-chart";
import { InsightGrid } from "./insight-card";

const STATUS_BAR_COLOR: Record<string, string> = {
  collected: "bg-emerald-500",
  invoiced: "bg-amber-500",
  triggered: "bg-sky-500",
  pending: "bg-muted-foreground/40",
};

export function FinancialIntelligenceSection({ data }: { data: FinancialIntelligence }) {
  const insights = generateFinancialInsights(data);

  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Revenue and Financial Health</CardTitle>
        <CardDescription>Payment milestone status, collection speed, and receivables concentration.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-medium text-ivory">Revenue by milestone status</p>
          <HorizontalBarChart
            rows={data.revenueByStatus.map((row) => ({
              label: row.label,
              value: row.amount,
              pct: row.pct,
              colorClassName: STATUS_BAR_COLOR[row.status],
            }))}
            formatValue={formatCurrency}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-border-subtle pt-6 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Collection Efficiency</p>
            <p className="mt-1 text-2xl font-semibold text-gold">
              {data.collectionEfficiencyPct !== null ? `${data.collectionEfficiencyPct}%` : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Collected within 30 days of trigger</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg. Days to Invoice</p>
            <p className="mt-1 text-2xl font-semibold text-ivory">
              {data.avgDaysToInvoice !== null ? data.avgDaysToInvoice : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Trigger → invoice sent</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg. Days to Collect</p>
            <p className="mt-1 text-2xl font-semibold text-ivory">
              {data.avgDaysToCollect !== null ? data.avgDaysToCollect : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Invoice sent → collected</p>
          </div>
        </div>

        <div className="grid gap-6 border-t border-border-subtle pt-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-medium text-ivory">Revenue concentration — top 3 clients by collected revenue</p>
            {data.revenueConcentrationTop3.length === 0 ? (
              <p className="text-sm text-muted-foreground">No collected revenue on record yet.</p>
            ) : (
              <HorizontalBarChart
                rows={data.revenueConcentrationTop3.map((c) => ({ label: c.clientName, value: c.collected, pct: c.pct }))}
                formatValue={formatCurrency}
              />
            )}
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-ivory">Outstanding receivables by client</p>
            {data.outstandingReceivablesByClient.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing outstanding — no invoiced-but-uncollected milestones.</p>
            ) : (
              <ul className="space-y-2">
                {data.outstandingReceivablesByClient.map((c) => (
                  <li
                    key={c.clientId}
                    className="flex items-center justify-between rounded-lg border border-border-subtle bg-night/40 px-3 py-2 text-sm"
                  >
                    <span className="text-ivory">{c.clientName}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(c.outstanding)} <span className="text-xs">({c.pct}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-border-subtle pt-6">
          <InsightGrid insights={insights} />
        </div>
      </CardContent>
    </Card>
  );
}
