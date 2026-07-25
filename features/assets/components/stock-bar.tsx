type Props = {
  stockQuantity: number;
  reorderThreshold: number | null;
};

/**
 * No shadcn Progress primitive exists in this codebase, so this is a plain
 * two-div bar. The fill width and threshold-marker position are runtime
 * percentages that Tailwind's static class set can't express, so `style` is
 * used narrowly for those two values only — everything else is classes.
 */
export function StockBar({ stockQuantity, reorderThreshold }: Props) {
  const ceiling = Math.max(stockQuantity, (reorderThreshold ?? 0) * 2, 1);
  const fillPercent = Math.min(100, Math.round((stockQuantity / ceiling) * 100));
  const thresholdPercent = reorderThreshold !== null ? Math.min(100, Math.round((reorderThreshold / ceiling) * 100)) : null;

  const isOut = stockQuantity <= 0;
  const isLow = reorderThreshold !== null && stockQuantity <= reorderThreshold && !isOut;
  const fillColor = isOut ? "bg-destructive" : isLow ? "bg-amber-500" : "bg-gold";

  return (
    <div className="relative h-2 w-full min-w-[80px] rounded-full bg-night/60">
      <div className={`h-full rounded-full ${fillColor}`} style={{ width: `${fillPercent}%` }} />
      {thresholdPercent !== null && (
        <div className="absolute top-0 h-2 w-px bg-ivory/40" style={{ left: `${thresholdPercent}%` }} />
      )}
    </div>
  );
}
