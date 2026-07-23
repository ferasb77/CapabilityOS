import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getFacilitatorById } from "@/features/facilitators/data";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditFacilitatorPage({ params }: Props) {
  const { id } = await params;
  const facilitator = await getFacilitatorById(id);

  if (!facilitator) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/dashboard/facilitators/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Back to {facilitator.fullName}
      </Link>

      <Card className="bg-surface-elevated">
        <CardHeader>
          <CardTitle>Edit Facilitator</CardTitle>
          <CardDescription>
            Editing is planned for a later sprint. For now, this is a placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This is where {facilitator.fullName}&apos;s profile details can be updated.
        </CardContent>
      </Card>
    </div>
  );
}
