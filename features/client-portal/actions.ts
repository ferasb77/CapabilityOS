"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireEnv } from "@/infrastructure/env";
import { getResendClient, getResendFromAddress } from "@/infrastructure/email/resend-client";
import { renderClientPortalInvitationEmail } from "@/infrastructure/email/client-portal-email";
import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";
import { getSessionContext } from "@/infrastructure/session/session-context";
import { toActionError } from "@/shared/errors/action-error";
import { getReportBranding } from "@/features/reports/data";
import { downloadReportLogo } from "@/features/reports/storage";
import { generateSatisfactionReportPdf } from "@/features/reports/report";
import { generateFacilitatorReportPdf } from "@/features/observations/report";

import { invitePortalUserSchema } from "./schema";
import { getClientExperienceDetail, getClientPortalSessionContext, getClientSatisfaction, getClientFacilitatorReport } from "./data";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function acceptUrlFor(token: string): string {
  return `${requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "")}/client-portal/accept?token=${token}`;
}

async function sendInvitationEmail(inviterName: string, email: string, token: string): Promise<string | null> {
  const { subject, html } = renderClientPortalInvitationEmail({
    inviterName,
    organizationName: "Enable My Growth",
    acceptUrl: acceptUrlFor(token),
  });

  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({ from: getResendFromAddress(), to: email, subject, html });

    if (error) {
      return toActionError(error, "client-portal", "Unable to send the invitation email.");
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Unable to send the invitation email.";
  }

  return null;
}

async function resolveClientWorkspace(
  supabase: SupabaseServerClient,
  clientId: string
): Promise<{ workspaceId: string; organizationId: string } | null> {
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("workspace_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !clientRow) {
    return null;
  }

  const { data: workspaceRow, error: workspaceError } = await supabase
    .from("workspaces")
    .select("organization_id")
    .eq("id", clientRow.workspace_id)
    .maybeSingle();

  if (workspaceError || !workspaceRow) {
    return null;
  }

  return { workspaceId: clientRow.workspace_id, organizationId: workspaceRow.organization_id };
}

// ---------------------------------------------------------------------------
// Invite / resend / deactivate — operator-side, from the client detail page.
// ---------------------------------------------------------------------------

export type InviteClientPortalUserResult = { success: true } | { success: false; error: string };

export async function inviteClientPortalUser(
  clientId: string,
  data: { fullName: string; email: string; jobTitle?: string }
): Promise<InviteClientPortalUserResult> {
  const parsed = invitePortalUserSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: "Please correct the highlighted fields." };
  }

  const session = await getSessionContext();
  const supabase = await createClient();

  const workspace = await resolveClientWorkspace(supabase, clientId);
  if (!workspace) {
    return { success: false, error: "Client not found." };
  }

  const { data: inserted, error } = await supabase
    .from("client_portal_users")
    .insert({
      organization_id: workspace.organizationId,
      client_id: clientId,
      workspace_id: workspace.workspaceId,
      email: parsed.data.email,
      full_name: parsed.data.fullName,
      job_title: parsed.data.jobTitle ?? null,
      invited_by: session.userId,
    })
    .select("email, invitation_token")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { success: false, error: "This person has already been invited to this client's portal." };
    }
    return { success: false, error: toActionError(error, "client-portal") };
  }

  if (inserted.invitation_token) {
    const emailError = await sendInvitationEmail(session.fullName ?? "A CapabilityOS user", inserted.email, inserted.invitation_token);
    if (emailError) {
      return { success: false, error: emailError };
    }
  }

  revalidatePath(`/dashboard/clients/${clientId}`);
  return { success: true };
}

export type ResendInvitationResult = { success: true } | { success: false; error: string };

export async function resendInvitation(portalUserId: string): Promise<ResendInvitationResult> {
  const session = await getSessionContext();
  const supabase = await createClient();

  const { data: portalUser, error } = await supabase
    .from("client_portal_users")
    .select("email, invitation_token, client_id")
    .eq("id", portalUserId)
    .maybeSingle();

  if (error) {
    return { success: false, error: toActionError(error, "client-portal") };
  }

  if (!portalUser || !portalUser.invitation_token) {
    return { success: false, error: "Invitation not found." };
  }

  const emailError = await sendInvitationEmail(
    session.fullName ?? "A CapabilityOS user",
    portalUser.email,
    portalUser.invitation_token
  );

  if (emailError) {
    return { success: false, error: emailError };
  }

  const { error: touchError } = await supabase
    .from("client_portal_users")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", portalUserId);

  if (touchError) {
    return { success: false, error: toActionError(touchError, "client-portal") };
  }

  revalidatePath(`/dashboard/clients/${portalUser.client_id}`);
  return { success: true };
}

export type ToggleActivePortalUserResult = { success: true; isActive: boolean } | { success: false; error: string };

/** Toggles is_active — same action backs the operator's Deactivate/Reactivate switch either direction. */
export async function deactivatePortalUser(portalUserId: string): Promise<ToggleActivePortalUserResult> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("client_portal_users")
    .select("is_active, client_id")
    .eq("id", portalUserId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: toActionError(fetchError, "client-portal") };
  }

  if (!existing) {
    return { success: false, error: "Portal user not found." };
  }

  const nextIsActive = !existing.is_active;

  const { error } = await supabase
    .from("client_portal_users")
    .update({ is_active: nextIsActive })
    .eq("id", portalUserId);

  if (error) {
    return { success: false, error: toActionError(error, "client-portal") };
  }

  revalidatePath(`/dashboard/clients/${existing.client_id}`);
  return { success: true, isActive: nextIsActive };
}

// ---------------------------------------------------------------------------
// Invitation acceptance — public route, no session yet.
// ---------------------------------------------------------------------------

export type AcceptInvitationResult = { success: false; error: string } | { success: true };

export async function acceptInvitation(token: string, password: string): Promise<AcceptInvitationResult> {
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const serviceClient = createServiceRoleClient();

  const { data: portalUser, error: fetchError } = await serviceClient
    .from("client_portal_users")
    .select("id, email, invitation_accepted_at, is_active")
    .eq("invitation_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: toActionError(fetchError, "client-portal") };
  }

  if (!portalUser) {
    return { success: false, error: "This invitation link is invalid." };
  }

  if (portalUser.invitation_accepted_at) {
    return { success: false, error: "This invitation has already been accepted. Please sign in instead." };
  }

  if (!portalUser.is_active) {
    return { success: false, error: "This invitation is no longer active. Contact your program coordinator." };
  }

  const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
    email: portalUser.email,
    password,
    email_confirm: true,
  });

  if (createError || !createdUser.user) {
    if (createError?.message.toLowerCase().includes("already")) {
      return { success: false, error: "An account with this email already exists. Please sign in instead." };
    }
    return { success: false, error: toActionError(createError ?? new Error("No user returned"), "client-portal", "Unable to set up your account.") };
  }

  const { error: updateError } = await serviceClient
    .from("client_portal_users")
    .update({ auth_user_id: createdUser.user.id, invitation_accepted_at: new Date().toISOString() })
    .eq("id", portalUser.id);

  if (updateError) {
    return { success: false, error: toActionError(updateError, "client-portal") };
  }

  // Establishes the session cookie for this browser — admin.createUser above
  // creates the auth user but doesn't sign anyone in.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: portalUser.email, password });

  if (signInError) {
    return { success: false, error: "Account created — please sign in." };
  }

  redirect("/client-portal");
}

// ---------------------------------------------------------------------------
// Client portal sign in / out. Same Supabase Auth system as the operator
// dashboard's features/auth/actions.ts login() — the two are distinguished
// entirely by which table the authenticated user resolves against
// (infrastructure/supabase/session.ts), not by a different auth mechanism.
// ---------------------------------------------------------------------------

export type ClientPortalLoginState = { error: string };

export async function clientPortalLogin(
  _previousState: ClientPortalLoginState,
  formData: FormData
): Promise<ClientPortalLoginState> {
  const supabase = await createClient();

  const email = formData.get("email")?.toString().trim() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: toActionError(error, "client-portal", "Incorrect email or password.") };
  }

  redirect("/client-portal");
}

export async function clientPortalSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/client-portal/login");
}

export type RequestPasswordResetState = { success: boolean; message: string };

export async function requestPasswordReset(
  _previousState: RequestPasswordResetState,
  formData: FormData
): Promise<RequestPasswordResetState> {
  const email = formData.get("email")?.toString().trim() ?? "";

  if (!email) {
    return { success: false, message: "Enter your email address." };
  }

  const supabase = await createClient();
  const redirectTo = `${requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "")}/client-portal/reset-password`;

  // Always returns the same message regardless of whether the email is
  // registered — this is a public form and must not reveal which emails
  // have portal accounts.
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  return { success: true, message: "If that email has a portal account, a reset link has been sent." };
}

// ---------------------------------------------------------------------------
// Last-seen tracking — the only mutation reachable from inside the portal
// itself. Uses the service-role client since there is no RLS UPDATE policy
// granting a portal user write access to their own row (only SELECT) — but
// the row updated is always resolved by matching auth_user_id to the
// currently authenticated session, never trusted from the caller-supplied
// id alone.
// ---------------------------------------------------------------------------

export async function updateLastSeen(portalUserId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const serviceClient = createServiceRoleClient();
  await serviceClient
    .from("client_portal_users")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", portalUserId)
    .eq("auth_user_id", user.id);
}

// ---------------------------------------------------------------------------
// Read-only PDF downloads. Neither writes to facilitator_reports or any
// storage bucket — the client portal is read-only apart from
// updateLastSeen, so these regenerate the PDF fresh on every click rather
// than reusing the operator-side actions (features/reports/actions.ts,
// features/observations/actions.ts), which return signed URLs to a stored
// file and, in the facilitator report's case, mutate exported_at/status.
//
// Both resolve the requesting portal user's clientId from their own
// session — never from a client-supplied parameter — and validate the
// requested experience belongs to that client before touching any report
// data, since this is the data-fetching-layer enforcement CLAUDE.md
// requires for this feature.
// ---------------------------------------------------------------------------

export type DownloadPdfResult = { success: true; base64: string; filename: string } | { success: false; error: string };

function slugifyFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "report"
  );
}

export async function downloadSatisfactionReportPdf(experienceId: string): Promise<DownloadPdfResult> {
  const portalUser = await getClientPortalSessionContext();
  const supabase = await createClient();

  const experience = await getClientExperienceDetail(experienceId, portalUser.clientId);
  if (!experience) {
    return { success: false, error: "Program not found." };
  }

  const workspace = await resolveClientWorkspace(supabase, portalUser.clientId);
  if (!workspace) {
    return { success: false, error: "Client not found." };
  }

  const [reportData, branding] = await Promise.all([
    getClientSatisfaction(experienceId),
    getReportBranding(workspace.workspaceId),
  ]);

  if (!reportData) {
    return { success: false, error: "Survey results are not available for this program yet." };
  }

  let logoBytes: Uint8Array | null = null;
  if (branding.logoPath) {
    try {
      logoBytes = await downloadReportLogo(branding.logoPath);
    } catch {
      logoBytes = null;
    }
  }

  try {
    const pdfBytes = await generateSatisfactionReportPdf({
      branding: {
        organizationName: branding.organizationName,
        organizationTagline: branding.organizationTagline,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        accentColor: branding.accentColor,
        footerText: branding.footerText,
        website: branding.website,
        contactEmail: branding.contactEmail,
      },
      logoBytes,
      data: reportData,
    });

    return {
      success: true,
      base64: Buffer.from(pdfBytes).toString("base64"),
      filename: `${slugifyFilename(reportData.experienceTitle)}-satisfaction-report.pdf`,
    };
  } catch (error) {
    return { success: false, error: toActionError(error, "client-portal", "Unable to generate the report.") };
  }
}

export async function downloadFacilitatorReportPdf(experienceId: string): Promise<DownloadPdfResult> {
  const portalUser = await getClientPortalSessionContext();
  const supabase = await createClient();

  const experience = await getClientExperienceDetail(experienceId, portalUser.clientId);
  if (!experience) {
    return { success: false, error: "Program not found." };
  }

  const report = await getClientFacilitatorReport(experienceId);
  if (report.status === "pending" || !report.content) {
    return { success: false, error: "The facilitator report isn't ready for download yet." };
  }

  const workspace = await resolveClientWorkspace(supabase, portalUser.clientId);
  if (!workspace) {
    return { success: false, error: "Client not found." };
  }

  const branding = await getReportBranding(workspace.workspaceId);

  let logoBytes: Uint8Array | null = null;
  if (branding.logoPath) {
    try {
      logoBytes = await downloadReportLogo(branding.logoPath);
    } catch {
      logoBytes = null;
    }
  }

  try {
    const pdfBytes = await generateFacilitatorReportPdf({
      branding: {
        organizationName: branding.organizationName,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        website: branding.website,
        contactEmail: branding.contactEmail,
      },
      logoBytes,
      data: {
        experienceTitle: experience.title,
        clientName: portalUser.clientName,
        date: new Date().toISOString().slice(0, 10),
        facilitatorName: report.facilitatorName ?? "Facilitator",
        contentHtml: report.content,
      },
    });

    return {
      success: true,
      base64: Buffer.from(pdfBytes).toString("base64"),
      filename: `${slugifyFilename(experience.title)}-facilitator-report.pdf`,
    };
  } catch (error) {
    return { success: false, error: toActionError(error, "client-portal", "Unable to generate the report.") };
  }
}
