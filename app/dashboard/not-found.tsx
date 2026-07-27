import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <SearchX className="size-8 text-muted-foreground" />
      <div>
        <h1 className="text-lg font-semibold">Not found</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          This record doesn&apos;t exist or may have been removed.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard" />}>
        Back to dashboard
      </Button>
    </div>
  );
}
