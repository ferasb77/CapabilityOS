import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FacilitatorUnavailabilityBlock } from "../data";

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type Props = {
  facilitatorId: string;
  unavailabilityBlocks: FacilitatorUnavailabilityBlock[];
};

/**
 * Read-only — unlike the facilitator's own /facilitator-portal/availability
 * view, operators can't add or remove blocks here (CLAUDE.md: the
 * facilitator manages their own availability; this section is visibility
 * only, used when deciding whether to assign them).
 */
export function OperatorUnavailabilitySection({ unavailabilityBlocks }: Props) {
  return (
    <Card className="bg-surface-elevated">
      <CardHeader>
        <CardTitle>Availability</CardTitle>
        <CardDescription>Dates this facilitator has marked themselves unavailable.</CardDescription>
      </CardHeader>
      <CardContent>
        {unavailabilityBlocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unavailability blocks on file.</p>
        ) : (
          <ul className="space-y-2">
            {unavailabilityBlocks.map((block) => (
              <li
                key={block.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-subtle bg-night/40 p-3",
                  block.isPast && "opacity-50"
                )}
              >
                <div>
                  <p className="text-sm font-medium text-ivory">
                    {formatDate(block.startDate)}
                    {block.endDate !== block.startDate ? ` – ${formatDate(block.endDate)}` : ""}
                  </p>
                  {block.reason && <p className="text-xs text-muted-foreground">{block.reason}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
