import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Material } from "@/features/materials/data";
import { AVAILABLE_FROM_LABELS, MATERIAL_AUDIENCE_LABELS, type MaterialAudience } from "@/features/materials/schema";

const AUDIENCE_BADGE_CLASS: Record<MaterialAudience, string> = {
  participant: "border-blue-500/40 text-blue-300",
  facilitator: "border-violet-500/40 text-violet-300",
  both: "border-border-subtle text-muted-foreground",
};

export function AudienceBadge({ audience }: { audience: MaterialAudience }) {
  return (
    <Badge variant="outline" className={cn(AUDIENCE_BADGE_CLASS[audience])}>
      {MATERIAL_AUDIENCE_LABELS[audience]}
    </Badge>
  );
}

export function AvailabilityBadge({ material }: { material: Pick<Material, "availableFrom" | "isReleased"> }) {
  if (material.availableFrom === "manual" && !material.isReleased) {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-300">
        Awaiting Release
      </Badge>
    );
  }

  return <Badge variant="outline">{AVAILABLE_FROM_LABELS[material.availableFrom]}</Badge>;
}

export function FacilitatorOnlyBadge() {
  return <Badge className="bg-violet-600 text-white">Facilitator only</Badge>;
}

export function UploadedByBadge({ material }: { material: Pick<Material, "uploadedByFacilitatorName" | "uploadedByName"> }) {
  if (material.uploadedByFacilitatorName) {
    return (
      <Badge variant="outline" className="border-gold/30 text-gold">
        Uploaded by {material.uploadedByFacilitatorName}
      </Badge>
    );
  }
  return null;
}
