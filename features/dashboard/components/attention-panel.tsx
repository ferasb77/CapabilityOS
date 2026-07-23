import { AlertTriangle, CircleCheck, Mail, type LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AttentionItem } from "@/infrastructure/repositories/dashboard";

const REASON_ICON: Record<AttentionItem["reason"], LucideIcon> = {
  capacity_remaining: AlertTriangle,
  no_participants: AlertTriangle,
  survey_not_sent: Mail,
};

type Props = {
  items: AttentionItem[];
};

export function AttentionPanel({ items }: Props) {
  return (
    <Card className="border-gold/30 bg-surface-elevated">
      <CardHeader>
        <CardTitle>Attention Required</CardTitle>
        <CardDescription>Workshops that need a decision from you.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-gold" />
            Nothing needs your attention right now.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item, index) => {
              const Icon = REASON_ICON[item.reason];

              return (
                <li
                  key={`${item.workshopId}-${item.reason}-${index}`}
                  className="flex items-start gap-3 rounded-lg border border-gold/20 bg-night/40 p-3"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-gold" />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
