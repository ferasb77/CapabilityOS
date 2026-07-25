import { cn } from "@/lib/utils";

/**
 * Tailwind-only chart primitives — no chart library, per the sprint's
 * "Charts are Tailwind-only" architecture rule. Bar widths/heights are
 * runtime percentages Tailwind's static class set can't express, so
 * `style` is used narrowly for that one value per bar, same pattern as
 * features/assets/components/stock-bar.tsx.
 */

type HorizontalBarRow = {
  label: string;
  value: number;
  pct: number;
  colorClassName?: string;
};

type HorizontalBarChartProps = {
  rows: HorizontalBarRow[];
  valueSuffix?: string;
  formatValue?: (value: number) => string;
};

export function HorizontalBarChart({ rows, valueSuffix = "", formatValue }: HorizontalBarChartProps) {
  const maxPct = Math.max(...rows.map((r) => r.pct), 1);

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ivory">{row.label}</span>
            <span className="text-muted-foreground">
              {formatValue ? formatValue(row.value) : row.value.toLocaleString()}
              {valueSuffix} · {row.pct}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-night/60">
            <div
              className={cn("h-full rounded-full", row.colorClassName ?? "bg-gold")}
              style={{ width: `${Math.max((row.pct / maxPct) * 100, row.pct > 0 ? 2 : 0)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

type ColumnBarEntry = {
  label: string;
  value: number;
  highlight?: boolean;
  colorClassName?: string;
};

type ColumnBarChartProps = {
  entries: ColumnBarEntry[];
  formatValue?: (value: number) => string;
};

export function ColumnBarChart({ entries, formatValue }: ColumnBarChartProps) {
  const maxValue = Math.max(...entries.map((e) => e.value), 1);

  return (
    <div className="flex items-end gap-1.5 sm:gap-2">
      {entries.map((entry) => {
        const heightPct = entry.value > 0 ? Math.max((entry.value / maxValue) * 100, 4) : 2;
        return (
          <div key={entry.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatValue ? formatValue(entry.value) : entry.value}
            </span>
            <div className="flex h-24 w-full items-end rounded bg-night/40 sm:h-32">
              <div
                className={cn(
                  "w-full rounded-t transition-all",
                  entry.colorClassName ?? (entry.highlight ? "bg-gold" : "bg-gold/40")
                )}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">{entry.label}</span>
          </div>
        );
      })}
    </div>
  );
}
