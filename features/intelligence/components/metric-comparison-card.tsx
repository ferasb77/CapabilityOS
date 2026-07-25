import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  changeLabel: string;
  changeDirection: "up" | "down" | "flat";
  goodDirection?: "up" | "down";
};

export function MetricComparisonCard({ label, value, changeLabel, changeDirection, goodDirection = "up" }: Props) {
  const isGood = changeDirection === "flat" ? null : changeDirection === goodDirection;
  const Icon = changeDirection === "up" ? TrendingUp : changeDirection === "down" ? TrendingDown : Minus;

  return (
    <Card className="bg-surface-elevated">
      <CardContent className="p-4">
        <CardDescription>{label}</CardDescription>
        <p className="mt-1 font-heading text-3xl font-semibold text-gold">{value}</p>
        <p
          className={cn(
            "mt-2 flex items-center gap-1 text-xs font-medium",
            isGood === null ? "text-muted-foreground" : isGood ? "text-gold" : "text-amber-500"
          )}
        >
          <Icon className="size-3.5" />
          {changeLabel}
        </p>
      </CardContent>
    </Card>
  );
}
