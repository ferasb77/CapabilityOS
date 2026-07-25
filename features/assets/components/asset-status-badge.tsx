import { Badge } from "@/components/ui/badge";
import type { CurrentAssignment } from "@/features/assets/data";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function UniqueAssetStatusBadge({ assignment }: { assignment: CurrentAssignment | null }) {
  if (!assignment) {
    return <Badge className="bg-gold/15 text-gold">Available</Badge>;
  }

  return (
    <Badge variant="destructive">
      Assigned to {assignment.experienceTitle} on {formatDate(assignment.startDate)}–{formatDate(assignment.endDate)}
    </Badge>
  );
}

export function ConsumableStockBadge({
  stockQuantity,
  reorderThreshold,
}: {
  stockQuantity: number;
  reorderThreshold: number | null;
}) {
  if (stockQuantity <= 0) {
    return <Badge variant="destructive">Out of Stock</Badge>;
  }

  if (reorderThreshold !== null && stockQuantity <= reorderThreshold) {
    return <Badge className="bg-amber-500/15 text-amber-500">Low Stock</Badge>;
  }

  return <Badge className="bg-gold/15 text-gold">In Stock</Badge>;
}
