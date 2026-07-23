import Link from "next/link";
import { Star } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { FacilitatorSummary } from "@/features/facilitators/data";

import { AvailabilityBadge } from "./availability-badge";

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

type Props = {
  facilitator: FacilitatorSummary;
};

export function FacilitatorCard({ facilitator }: Props) {
  return (
    <Link href={`/dashboard/facilitators/${facilitator.id}`} className="block h-full">
      <Card className="h-full bg-surface-elevated transition-colors hover:border-gold/40 hover:ring-1 hover:ring-gold/20">
        <CardContent className="flex h-full flex-col gap-4">
          <div className="flex items-start gap-3">
            <Avatar size="lg">
              {facilitator.photoUrl && (
                <AvatarImage src={facilitator.photoUrl} alt={facilitator.fullName} />
              )}
              <AvatarFallback>{initials(facilitator.firstName, facilitator.lastName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ivory">{facilitator.fullName}</p>
              {facilitator.title && (
                <p className="truncate text-sm text-muted-foreground">{facilitator.title}</p>
              )}
              {facilitator.organization && (
                <p className="truncate text-xs text-muted-foreground">{facilitator.organization}</p>
              )}
            </div>
          </div>

          <AvailabilityBadge status={facilitator.availabilityStatus} />

          {facilitator.expertiseAreas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {facilitator.expertiseAreas.slice(0, 3).map((area) => (
                <Badge key={area} variant="secondary" className="text-xs">
                  {area}
                </Badge>
              ))}
            </div>
          )}

          <div className="space-y-1 text-xs text-muted-foreground">
            {facilitator.languages.length > 0 && <p>Languages: {facilitator.languages.join(", ")}</p>}
            {facilitator.regions.length > 0 && <p>Regions: {facilitator.regions.join(", ")}</p>}
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-border-subtle pt-3 text-sm">
            <span className="text-muted-foreground">
              {facilitator.workshopsDelivered} workshop{facilitator.workshopsDelivered === 1 ? "" : "s"}
            </span>
            {facilitator.averageSatisfaction !== null ? (
              <span className="flex items-center gap-1 font-medium text-gold">
                <Star className="size-3.5 fill-gold" />
                {facilitator.averageSatisfaction.toFixed(1)}/5
              </span>
            ) : (
              <span className="text-muted-foreground">No ratings yet</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
