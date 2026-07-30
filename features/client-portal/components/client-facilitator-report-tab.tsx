import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientFacilitatorReport } from "../data";

import { DownloadFacilitatorReportButton } from "./download-facilitator-report-button";

type Props = {
  data: ClientFacilitatorReport;
  experienceId: string;
};

export function ClientFacilitatorReportTab({ data, experienceId }: Props) {
  if (data.status === "pending" || !data.content) {
    return (
      <Card className="bg-surface-elevated">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          The facilitator report for this program is being prepared. You will be notified when it is ready.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-elevated">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Facilitator Report</CardTitle>
        <DownloadFacilitatorReportButton experienceId={experienceId} />
      </CardHeader>
      <CardContent>
        <div
          className="prose-sm max-w-none text-sm text-ivory [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gold [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-3 [&_p]:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: data.content }}
        />
      </CardContent>
    </Card>
  );
}
