import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFacilitatorInvitationByToken } from "@/features/facilitator-portal/data";
import { AcceptInvitationForm } from "@/features/facilitator-portal/components/accept-invitation-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AcceptFacilitatorInvitationPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night p-6">
        <Card className="w-full max-w-md bg-surface-elevated border-border-subtle text-center">
          <CardHeader>
            <AlertCircle className="mx-auto size-10 text-destructive mb-2" />
            <CardTitle className="text-lg font-bold text-ivory">Invalid Invitation Link</CardTitle>
            <CardDescription>
              No invitation token was provided. Please check the invitation email sent to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link href="/login" />}>
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const invitation = await getFacilitatorInvitationByToken(token);

  if (!invitation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night p-6">
        <Card className="w-full max-w-md bg-surface-elevated border-border-subtle text-center">
          <CardHeader>
            <AlertCircle className="mx-auto size-10 text-destructive mb-2" />
            <CardTitle className="text-lg font-bold text-ivory">Invitation Expired or Invalid</CardTitle>
            <CardDescription>
              This invitation link is no longer valid. Please contact your program coordinator for a new invitation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link href="/login" />}>
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (invitation.alreadyAccepted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-night p-6">
        <Card className="w-full max-w-md bg-surface-elevated border-border-subtle text-center">
          <CardHeader>
            <CheckCircle2 className="mx-auto size-10 text-emerald-400 mb-2" />
            <CardTitle className="text-lg font-bold text-ivory">Invitation Already Accepted</CardTitle>
            <CardDescription>
              Your facilitator portal account is active. Please sign in with your email and password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" render={<Link href="/login" />}>
              Sign In to Facilitator Portal
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-night p-6">
      <AcceptInvitationForm
        token={token}
        fullName={invitation.fullName}
        email={invitation.email}
      />
    </main>
  );
}
