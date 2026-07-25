import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  subtext: ReactNode;
  icon: LucideIcon;
};

export function PulseCard({ label, value, valueClassName, subtext, icon: Icon }: Props) {
  return (
    <Card className="bg-surface-elevated">
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn("mt-1 font-heading text-2xl font-semibold text-gold", valueClassName)}>{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
        </div>
        <Icon className="size-5 shrink-0 text-gold/50" />
      </CardContent>
    </Card>
  );
}
