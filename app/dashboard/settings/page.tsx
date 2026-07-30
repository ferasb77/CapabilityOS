import Link from "next/link";
import { ChevronRight, Award, ClipboardList, FileText, Wallet } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSessionContext } from "@/infrastructure/session/session-context";

export default async function SettingsPage() {
  const session = await getSessionContext();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="mt-2 text-muted-foreground">
        Your account, organization, and workspace.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Signed in as</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{session.fullName || "—"}</p>
            <p className="text-muted-foreground">{session.email}</p>
            <p className="text-muted-foreground">Role: {session.role}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization &amp; workspace</CardTitle>
            <CardDescription>Where this account operates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{session.organizationName || "—"}</p>
            <p className="text-muted-foreground">
              {session.workspaceName || "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-ivory">Configuration</h2>
        <Link
          href="/dashboard/settings/surveys"
          className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-4 transition-colors hover:border-gold/40"
        >
          <div className="flex items-center gap-3">
            <ClipboardList className="size-5 text-gold" />
            <div>
              <p className="font-medium text-ivory">Survey Templates</p>
              <p className="text-sm text-muted-foreground">Build custom surveys and assign them to experiences.</p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/settings/certificates"
          className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-4 transition-colors hover:border-gold/40"
        >
          <div className="flex items-center gap-3">
            <Award className="size-5 text-gold" />
            <div>
              <p className="font-medium text-ivory">Certificate Templates</p>
              <p className="text-sm text-muted-foreground">Branding and content for issued certificates.</p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/settings/reports"
          className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-4 transition-colors hover:border-gold/40"
        >
          <div className="flex items-center gap-3">
            <FileText className="size-5 text-gold" />
            <div>
              <p className="font-medium text-ivory">Report Branding</p>
              <p className="text-sm text-muted-foreground">Logo, colors, and copy for client-facing satisfaction reports.</p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
        <Link
          href="/dashboard/settings/finance"
          className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-elevated p-4 transition-colors hover:border-gold/40"
        >
          <div className="flex items-center gap-3">
            <Wallet className="size-5 text-gold" />
            <div>
              <p className="font-medium text-ivory">Finance</p>
              <p className="text-sm text-muted-foreground">Finance contacts, default currency, and payment terms.</p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
