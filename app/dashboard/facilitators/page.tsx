import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FacilitatorDirectory } from "@/features/facilitators/components/facilitator-directory";
import { getAllFacilitators } from "@/features/facilitators/data";

export default async function FacilitatorsPage() {
  const facilitators = await getAllFacilitators();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Facilitators</h1>
          <p className="mt-2 text-muted-foreground">The people who deliver your experiences.</p>
        </div>

        <Button size="lg" nativeButton={false} render={<Link href="/dashboard/facilitators/new" />}>
          <Plus className="size-4" />
          Add Facilitator
        </Button>
      </div>

      <FacilitatorDirectory facilitators={facilitators} />
    </div>
  );
}
