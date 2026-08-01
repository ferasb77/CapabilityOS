"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireEnv } from "@/infrastructure/env";
import { getResendClient, getResendFromAddress } from "@/infrastructure/email/resend-client";
import { renderFacilitatorPortalInvitationEmail } from "@/infrastructure/email/facilitator-portal-email";
import { createClient } from "@/infrastructure/supabase/server";
import { createServiceRoleClient } from "@/infrastructure/supabase/service-role";
import { getSessionContext } from "@/infrastructure/session/session-context";
import { toActionError } from "@/shared/errors/action-error";

import { updateFacilitatorProfileSchema, type UpdateFacilitatorProfileInput } from "./schema";
import { checkAvailabilityConflict, getFacilitatorPortalSessionContext } from "./data";

function acceptUrlFor(token: string): string {
  return `${requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "")}/facilitator-portal/accept?token=${token}`;
}

async function sendInvitationEmail(
  organizationName: string,
  email: string,
  token: string
): Promise<string | null> {
  const { subject, html } = renderFacilitatorPortalInvitationEmail({
    organizationName,
    acceptUrl: acceptUrlFor(token),
  });

  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: getResendFromAddress(),
      to: email,
      subject,
      html,
    });

    if (error) {
      return toActionError(error, "facilitator-portal", "Unable to send invitation email.");
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Unable to send invitation email.";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Operator actions: Invite / Resend / Deactivate
// ---------------------------------------------------------------------------

export type InviteActionResult = { success: true } | { success: false; error: string };

export async function inviteFacilitatorToPortal(facilitatorId: string): Promise<InviteActionResult> {
  const session = await getSessionContext();
  const supabase = await createClient();

  const { data: facilitator, error: fetchError } = await supabase
    .from("facilitators")
    .select("id, email, invitation_token, auth_user_id, is_active")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (fetchError || !facilitator) {
    return { success: false, error: "Facilitator not found." };
  }

  if (facilitator.auth_user_id) {
    return { success: false, error: "This facilitator has already accepted their portal invitation." };
  }

  // Ensure an invitation token exists
  let token = facilitator.invitation_token;
  if (!token) {
    const serviceClient = createServiceRoleClient();
    const { data: updated, error: updateErr } = await serviceClient
      .from("facilitators")
      .update({
        invited_at: new Date().toISOString(),
        invited_by: session.userId,
      })
      .eq("id", facilitatorId)
      .select("invitation_token")
      .single();

    if (updateErr || !updated) {
      return { success: false, error: "Failed to generate invitation token." };
    }
    token = updated.invitation_token;
  } else {
    await supabase
      .from("facilitators")
      .update({
        invited_at: new Date().toISOString(),
        invited_by: session.userId,
      })
      .eq("id", facilitatorId);
  }

  if (token) {
    const emailErr = await sendInvitationEmail(
      session.organizationName || "Enable My Growth",
      facilitator.email,
      token
    );
    if (emailErr) {
      return { success: false, error: emailErr };
    }
  }

  revalidatePath(`/dashboard/facilitators/${facilitatorId}`);
  return { success: true };
}

export async function resendFacilitatorInvitation(facilitatorId: string): Promise<InviteActionResult> {
  const session = await getSessionContext();
  const supabase = await createClient();

  const { data: facilitator, error } = await supabase
    .from("facilitators")
    .select("id, email, invitation_token")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (error || !facilitator || !facilitator.invitation_token) {
    return { success: false, error: "Invitation record not found." };
  }

  const emailErr = await sendInvitationEmail(
    session.organizationName || "Enable My Growth",
    facilitator.email,
    facilitator.invitation_token
  );

  if (emailErr) {
    return { success: false, error: emailErr };
  }

  await supabase
    .from("facilitators")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", facilitatorId);

  revalidatePath(`/dashboard/facilitators/${facilitatorId}`);
  return { success: true };
}

export async function deactivateFacilitatorPortal(facilitatorId: string): Promise<InviteActionResult> {
  await getSessionContext();
  const supabase = await createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("facilitators")
    .select("is_active")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { success: false, error: "Facilitator not found." };
  }

  const nextIsActive = !existing.is_active;

  const { error } = await supabase
    .from("facilitators")
    .update({ is_active: nextIsActive })
    .eq("id", facilitatorId);

  if (error) {
    return { success: false, error: toActionError(error, "facilitator-portal") };
  }

  revalidatePath(`/dashboard/facilitators/${facilitatorId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Invitation acceptance (Public route)
// ---------------------------------------------------------------------------

export type AcceptInvitationResult = { success: false; error: string } | { success: true };

export async function acceptFacilitatorInvitation(
  token: string,
  password: string
): Promise<AcceptInvitationResult> {
  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const serviceClient = createServiceRoleClient();

  const { data: facilitator, error: fetchError } = await serviceClient
    .from("facilitators")
    .select("id, email, first_name, last_name, invitation_accepted_at, is_active")
    .eq("invitation_token", token)
    .maybeSingle();

  if (fetchError || !facilitator) {
    return { success: false, error: "This invitation link is invalid." };
  }

  if (facilitator.invitation_accepted_at) {
    return { success: false, error: "This invitation has already been accepted. Please sign in instead." };
  }

  if (!facilitator.is_active) {
    return { success: false, error: "This invitation is no longer active. Contact your program coordinator." };
  }

  const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
    email: facilitator.email,
    password,
    email_confirm: true,
  });

  if (createError || !createdUser.user) {
    if (createError?.message.toLowerCase().includes("already")) {
      return { success: false, error: "An account with this email already exists. Please sign in instead." };
    }
    return {
      success: false,
      error: toActionError(createError ?? new Error("No user returned"), "facilitator-portal", "Unable to set up your account."),
    };
  }

  const { error: updateError } = await serviceClient
    .from("facilitators")
    .update({
      auth_user_id: createdUser.user.id,
      invitation_accepted_at: new Date().toISOString(),
    })
    .eq("id", facilitator.id);

  if (updateError) {
    return { success: false, error: toActionError(updateError, "facilitator-portal") };
  }

  // Log the user in
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: facilitator.email,
    password,
  });

  if (signInError) {
    return { success: false, error: "Account created — please sign in." };
  }

  redirect("/facilitator-portal");
}

// ---------------------------------------------------------------------------
// Facilitator Self-Service: Update Profile
// ---------------------------------------------------------------------------

export type UpdateProfileResult =
  | { success: true; lastSavedAt: string }
  | { success: false; error: string };

export async function updateFacilitatorProfile(
  facilitatorId: string,
  data: UpdateFacilitatorProfileInput
): Promise<UpdateProfileResult> {
  const portalUser = await getFacilitatorPortalSessionContext();

  if (portalUser.id !== facilitatorId) {
    return { success: false, error: "You can only update your own profile." };
  }

  const parsed = updateFacilitatorProfileSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Please correct the invalid profile fields." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("facilitators")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      title: parsed.data.title ?? null,
      organization: parsed.data.organization ?? null,
      years_experience: parsed.data.yearsExperience ?? null,
      bio: parsed.data.bio ?? null,
      photo_url: parsed.data.photoUrl ?? null,
      expertise_areas: parsed.data.expertiseAreas,
      certifications: parsed.data.certifications,
      languages: parsed.data.languages,
      regions: parsed.data.regions,
      willing_to_travel: parsed.data.willingToTravel,
      travel_notes: parsed.data.travelNotes ?? null,
      passport_expiry: parsed.data.passportExpiry ?? null,
      visa_countries: parsed.data.visaCountries,
    })
    .eq("id", facilitatorId)
    .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id ?? "");

  if (error) {
    return { success: false, error: toActionError(error, "facilitator-portal") };
  }

  revalidatePath("/facilitator-portal/profile");
  return {
    success: true,
    lastSavedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

// ---------------------------------------------------------------------------
// Availability Management
// ---------------------------------------------------------------------------

export type AddUnavailabilityResult =
  | { success: true; warning?: string }
  | { success: false; error: string };

export async function addUnavailability(
  facilitatorId: string,
  startDate: string,
  endDate: string,
  reason?: string
): Promise<AddUnavailabilityResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Resolve workspace ID from session context or service role
  const { data: profile } = await supabase
    .from("profiles")
    .select("workspace_id")
    .eq("id", user.id)
    .maybeSingle();

  let workspaceId = profile?.workspace_id;

  if (!workspaceId) {
    // If signed in as facilitator
    const { data: defaultWorkspace } = await supabase
      .from("workspaces")
      .select("id")
      .limit(1)
      .maybeSingle();
    workspaceId = defaultWorkspace?.id;
  }

  if (!workspaceId) {
    return { success: false, error: "Workspace context missing." };
  }

  // Check conflicts
  const conflict = await checkAvailabilityConflict(facilitatorId, startDate, endDate);
  let warningMessage: string | undefined;

  if (conflict.hasConflict) {
    warningMessage = `You have ${conflict.count} assigned program(s) during this period. Please contact your coordinator before blocking these dates.`;
  }

  const { error } = await supabase.from("facilitator_unavailability").insert({
    facilitator_id: facilitatorId,
    workspace_id: workspaceId,
    start_date: startDate,
    end_date: endDate,
    reason: reason || null,
  });

  if (error) {
    return { success: false, error: toActionError(error, "facilitator-portal") };
  }

  revalidatePath("/facilitator-portal/availability");
  revalidatePath(`/dashboard/facilitators/${facilitatorId}`);
  return { success: true, warning: warningMessage };
}

export async function removeUnavailability(unavailabilityId: string): Promise<InviteActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("facilitator_unavailability")
    .delete()
    .eq("id", unavailabilityId);

  if (error) {
    return { success: false, error: toActionError(error, "facilitator-portal") };
  }

  revalidatePath("/facilitator-portal/availability");
  return { success: true };
}
