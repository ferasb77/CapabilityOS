import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FacilitatorUnavailabilityBlock } from "@/features/facilitator-portal/data";

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Props = { blocks: FacilitatorUnavailabilityBlock[] };

export function FacilitatorAvailabilitySection({ blocks }: Props) {
  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Availability</CardTitle>
        <CardDescription>Unavailability blocks the facilitator has marked in their portal.</CardDescription>
      </CardHeader>
      <CardContent>
        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unavailability on file.</p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((block) => (
              <li
                key={block.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-night/40 p-3",
                  block.isPast && "opacity-50"
                )}
              >
                <p className="text-sm text-ivory">
                  {formatDate(block.startDate)}
                  {block.endDate !== block.startDate ? ` – ${formatDate(block.endDate)}` : ""}
                </p>
                {block.reason && <p className="text-sm text-muted-foreground">{block.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
