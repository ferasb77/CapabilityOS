import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ReportBrandingForm } from "@/features/reports/components/report-branding-form";
import { getReportBranding } from "@/features/reports/data";
import { saveReportBranding } from "@/features/reports/actions";
import { getReportLogoPublicUrl } from "@/features/reports/storage";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function ReportBrandingSettingsPage() {
  const session = await getSessionContext();
  const branding = await getReportBranding(session.workspaceId);
  const existingLogoUrl = branding.logoPath ? getReportLogoPublicUrl(branding.logoPath) : null;
  const boundSave = saveReportBranding.bind(null, session.workspaceId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/dashboard/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Back to Settings
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Report Branding</h1>
        <p className="mt-2 text-muted-foreground">
          How the client-facing satisfaction report looks when generated from an experience.
        </p>
      </div>

      <ReportBrandingForm action={boundSave} branding={branding} existingLogoUrl={existingLogoUrl} />
    </div>
  );
}
