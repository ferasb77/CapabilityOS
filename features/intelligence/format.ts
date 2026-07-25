export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

export function formatSatisfaction(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export function formatPct(value: number | null, options: { showSign?: boolean } = {}): string {
  if (value === null) return "—";
  const sign = options.showSign && value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

export function formatDateShort(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateMonthYear(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
