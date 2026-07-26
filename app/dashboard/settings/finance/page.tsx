import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { FinanceContactsCard } from "@/features/financial/components/finance-contacts-card";
import { FinanceDefaultsCard } from "@/features/financial/components/finance-defaults-card";
import { getFinanceContacts, getFinanceSettings } from "@/features/financial/data";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function FinanceSettingsPage() {
  const session = await getSessionContext();
  const [contacts, settings] = await Promise.all([
    getFinanceContacts(session.workspaceId),
    getFinanceSettings(session.workspaceId),
  ]);

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
        <h1 className="text-3xl font-bold">Finance</h1>
        <p className="mt-2 text-muted-foreground">
          Who gets notified when a payment milestone triggers, and the defaults new milestones start from.
        </p>
      </div>

      <FinanceContactsCard workspaceId={session.workspaceId} contacts={contacts} />
      <FinanceDefaultsCard
        workspaceId={session.workspaceId}
        defaultCurrency={settings.defaultCurrency}
        defaultPaymentTerms={settings.defaultPaymentTerms}
      />
    </div>
  );
}
