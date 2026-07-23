import type { LucideIcon } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  label: string;
  value: number;
  icon: LucideIcon;
};

export function StatCard({ label, value, icon: Icon }: Props) {
  return (
    <Card className="bg-surface-elevated">
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-1 font-heading text-3xl font-semibold text-gold">
            {value.toLocaleString()}
          </CardTitle>
        </div>
        <Icon className="size-6 shrink-0 text-gold/50" />
      </CardHeader>
    </Card>
  );
}
