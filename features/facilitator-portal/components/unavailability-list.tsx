"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { removeUnavailability } from "../actions";
import type { FacilitatorUnavailabilityBlock } from "../data";

type Props = { blocks: FacilitatorUnavailabilityBlock[] };

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function UnavailabilityList({ blocks }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRemove(id: string) {
    startTransition(async () => {
      await removeUnavailability(id);
      router.refresh();
    });
  }

  if (blocks.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No unavailability blocks yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {blocks.map((block) => (
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
          {!block.isPast && (
            <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={() => handleRemove(block.id)}>
              Remove
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
