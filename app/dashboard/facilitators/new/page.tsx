import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FacilitatorForm } from "@/features/facilitators/components/facilitator-form";

export default function NewFacilitatorPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/dashboard/facilitators"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
        >
          <ArrowLeft className="size-4" />
          Back to facilitators
        </Link>

        <h1 className="mt-3 text-3xl font-bold">Add Facilitator</h1>
        <p className="mt-2 text-muted-foreground">
          Build out a full profile now, or come back and fill in the rest later.
        </p>
      </div>

      <FacilitatorForm />
    </div>
  );
}
