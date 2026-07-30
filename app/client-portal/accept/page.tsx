import { AcceptInvitationForm } from "@/features/client-portal/components/accept-invitation-form";
import { getInvitationByToken } from "@/features/client-portal/data";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
      <h1 className="text-xl font-bold text-slate-900">This invitation link isn&apos;t valid</h1>
      <p className="mt-3 text-slate-500">{message}</p>
    </div>
  );
}

export default async function ClientPortalAcceptPage({ searchParams }: Props) {
  const { token } = await searchParams;

  const invitation = token ? await getInvitationByToken(token) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      {!token || !invitation ? (
        <ErrorCard message="This invitation link is invalid or has expired. Contact your program coordinator for a new invitation." />
      ) : invitation.alreadyAccepted ? (
        <ErrorCard message="This invitation has already been accepted. Please sign in instead." />
      ) : (
        <AcceptInvitationForm token={token} fullName={invitation.fullName} />
      )}
    </main>
  );
}
