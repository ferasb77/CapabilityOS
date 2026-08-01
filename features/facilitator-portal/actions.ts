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

import {
  acceptFacilitatorInvitationSchema,
  addUnavailabilitySchema,
  documentsSchema,
  expertiseCertificationsSchema,
  languagesRegionsSchema,
  personalProfessionalSchema,
} from "./schema";
import {
  checkAvailabilityConflict,
  getFacilitatorExperienceDetail,
  getFacilitatorPortalUser,
  getFacilitatorUnavailabilityConflict,
  type AvailabilityConflict,
  type FacilitatorExperienceDetail,
  type UnavailabilityConflict,
} from "./data";
import { uploadFacilitatorPhoto } from "./storage";

function acceptUrlFor(token: string): string {
  return `${requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "")}/facilitator-portal/accept?token=${token}`;
}

async function sendInvitationEmail(email: string, token: string): Promise<string | null> {
  const { subject, html } = renderFacilitatorPortalInvitationEmail({
    organizationName: "Enable My Growth",
    acceptUrl: acceptUrlFor(token),
  });

  try {
    const resend = getResendClient();
    const { error } = await resend.emails.send({ from: getResendFromAddress(), to: email, subject, html });

    if (error) {
      return toActionError(error, "facilitator-portal", "Unable to send the invitation email.");
    }
  } catch (error) {
    return error instanceof Error ? error.message : "Unable to send the invitation email.";
  }

  return null;
}

/**
 * `facilitators` has no workspace_id/organization_id of its own (it
 * predates the Engineering Constitution's multi-tenancy rule — see
 * migration 0007's header). facilitator_unavailability still must carry
 * both per the rule, so this resolves them the same way daily_attendance's
 * check-in RPC (0026) and facilitator_reports (0027) do for this
 * single-tenant deployment: the one existing workspace/organization row.
 */
export async function resolveDefaultWorkspace(): Promise<{ workspaceId: string; organizationId: string } | null> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.from("workspaces").select("id, organization_id").limit(1).maybeSingle();

  if (error || !data) {
    return null;
  }

  return { workspaceId: data.id, organizationId: data.organization_id };
}

// ---------------------------------------------------------------------------
// Invite / resend / deactivate — operator-side, from the facilitator detail
// page. Mirrors features/client-portal/actions.ts's inviteClientPortalUser
// pattern (CLAUDE.md: "invitation flow mirrors the client portal invitation
// pattern from Sprint 32").
// ---------------------------------------------------------------------------

export type InviteFacilitatorResult = { success: true } | { success: false; error: string };

export async function inviteFacilitatorToPortal(facilitatorId: string): Promise<InviteFacilitatorResult> {
  const session = await getSessionContext();
  const supabase = await createClient();

  const { data: facilitator, error: fetchError } = await supabase
    .from("facilitators")
    .select("email, invitation_accepted_at, invitation_token")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: toActionError(fetchError, "facilitator-portal") };
  }

  if (!facilitator) {
    return { success: false, error: "Facilitator not found." };
  }

  if (facilitator.invitation_accepted_at) {
    return { success: false, error: "This facilitator has already accepted their portal invitation." };
  }

  const { data: updated, error: updateError } = await supabase
    .from("facilitators")
    .update({
      invited_at: new Date().toISOString(),
      invited_by: session.userId,
      portal_access_active: true,
    })
    .eq("id", facilitatorId)
    .select("invitation_token")
    .single();

  if (updateError) {
    return { success: false, error: toActionError(updateError, "facilitator-portal") };
  }

  const token = updated.invitation_token ?? facilitator.invitation_token;

  if (!token) {
    return { success: false, error: "Unable to generate an invitation link. Please try again." };
  }

  const emailError = await sendInvitationEmail(facilitator.email, token);
  if (emailError) {
    return { success: false, error: emailError };
  }

  revalidatePath(`/dashboard/facilitators/${facilitatorId}`);
  return { success: true };
}

export type ResendFacilitatorInvitationResult = { success: true } | { success: false; error: string };

export async function resendFacilitatorInvitation(facilitatorId: string): Promise<ResendFacilitatorInvitationResult> {
  const supabase = await createClient();

  const { data: facilitator, error } = await supabase
    .from("facilitators")
    .select("email, invitation_token")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (error) {
    return { success: false, error: toActionError(error, "facilitator-portal") };
  }

  if (!facilitator || !facilitator.invitation_token) {
    return { success: false, error: "Invitation not found." };
  }

  const emailError = await sendInvitationEmail(facilitator.email, facilitator.invitation_token);
  if (emailError) {
    return { success: false, error: emailError };
  }

  const { error: touchError } = await supabase
    .from("facilitators")
    .update({ invited_at: new Date().toISOString() })
    .eq("id", facilitatorId);

  if (touchError) {
    return { success: false, error: toActionError(touchError, "facilitator-portal") };
  }

  revalidatePath(`/dashboard/facilitators/${facilitatorId}`);
  return { success: true };
}

export type TogglePortalAccessResult = { success: true; isActive: boolean } | { success: false; error: string };

/** Toggles portal_access_active — same action backs the operator's
 * Deactivate/Reactivate control either direction. Deliberately independent
 * of `is_active` (directory visibility) — see migration 0030's comment. */
export async function togglePortalAccess(facilitatorId: string): Promise<TogglePortalAccessResult> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("facilitators")
    .select("portal_access_active")
    .eq("id", facilitatorId)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: toActionError(fetchError, "facilitator-portal") };
  }

  if (!existing) {
    return { success: false, error: "Facilitator not found." };
  }

  const next = !existing.portal_access_active;

  const { error } = await supabase
    .from("facilitators")
    .update({ portal_access_active: next })
    .eq("id", facilitatorId);

  if (error) {
    return { success: false, error: toActionError(error, "facilitator-portal") };
  }

  revalidatePath(`/dashboard/facilitators/${facilitatorId}`);
  return { success: true, isActive: next };
}

// ---------------------------------------------------------------------------
// Invitation acceptance — public route, no session yet.
// ---------------------------------------------------------------------------

export type AcceptFacilitatorInvitationResult = { success: false; error: string } | { success: true };

export async function acceptFacilitatorInvitation(token: string, password: string): Promise<AcceptFacilitatorInvitationResult> {
  const parsed = acceptFacilitatorInvitationSchema.safeParse({ token, password, confirmPassword: password });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid submission." };
  }

  const serviceClient = createServiceRoleClient();

  const { data: facilitator, error: fetchError } = await serviceClient
    .from("facilitators")
    .select("id, email, invitation_accepted_at, portal_access_active")
    .eq("invitation_token", token)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: toActionError(fetchError, "facilitator-portal") };
  }

  if (!facilitator) {
    return { success: false, error: "This invitation link is invalid." };
  }

  if (facilitator.invitation_accepted_at) {
    return { success: false, error: "This invitation has already been accepted. Please sign in instead." };
  }

  if (!facilitator.portal_access_active) {
    return { success: false, error: "This invitation is no longer active. Contact your coordinator." };
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
    .update({ auth_user_id: createdUser.user.id, invitation_accepted_at: new Date().toISOString() })
    .eq("id", facilitator.id);

  if (updateError) {
    return { success: false, error: toActionError(updateError, "facilitator-portal") };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: facilitator.email, password });

  if (signInError) {
    return { success: false, error: "Account created — please sign in." };
  }

  redirect("/facilitator-portal");
}

// ---------------------------------------------------------------------------
// Self-service profile — validates the caller's own auth_user_id before
// touching any row, so a facilitator can only ever edit their own profile
// (CLAUDE.md: "Facilitators can only edit their own profile").
// ---------------------------------------------------------------------------

export type UpdateFacilitatorProfileResult =
  | { success: true; savedAt: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

async function resolveOwnFacilitatorId(facilitatorId: string): Promise<{ error: string } | { facilitatorId: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your session has expired. Please sign in again." };
  }

  const { data: facilitator, error } = await supabase
    .from("facilitators")
    .select("id")
    .eq("id", facilitatorId)
    .eq("auth_user_id", user.id)
    .eq("portal_access_active", true)
    .maybeSingle();

  if (error) {
    return { error: toActionError(error, "facilitator-portal") };
  }

  if (!facilitator) {
    return { error: "You do not have permission to edit this profile." };
  }

  return { facilitatorId: facilitator.id };
}

type ProfileSection = "personal" | "expertise" | "languages" | "documents";

export async function updateFacilitatorProfile(
  facilitatorId: string,
  section: ProfileSection,
  _prevState: UpdateFacilitatorProfileResult,
  formData: FormData
): Promise<UpdateFacilitatorProfileResult> {
  const owned = await resolveOwnFacilitatorId(facilitatorId);
  if ("error" in owned) {
    return { success: false, error: owned.error };
  }

  const supabase = await createClient();

  if (section === "personal") {
    const parsed = personalProfessionalSchema.safeParse({
      firstName: formData.get("firstName")?.toString() ?? "",
      lastName: formData.get("lastName")?.toString() ?? "",
      title: formData.get("title")?.toString() ?? "",
      organization: formData.get("organization")?.toString() ?? "",
      yearsExperience: formData.get("yearsExperience")?.toString() ?? "",
      bio: formData.get("bio")?.toString() ?? "",
    });

    if (!parsed.success) {
      return { success: false, error: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const { error } = await supabase
      .from("facilitators")
      .update({
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        title: parsed.data.title || null,
        organization: parsed.data.organization || null,
        years_experience: parsed.data.yearsExperience ?? null,
        bio: parsed.data.bio || null,
      })
      .eq("id", owned.facilitatorId);

    if (error) {
      return { success: false, error: toActionError(error, "facilitator-portal") };
    }
  } else if (section === "expertise") {
    const parsed = expertiseCertificationsSchema.safeParse({
      expertiseAreas: formData.get("expertiseAreas")?.toString() ?? "",
      certifications: formData.get("certifications")?.toString() ?? "",
    });

    if (!parsed.success) {
      return { success: false, error: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const { error } = await supabase
      .from("facilitators")
      .update({
        expertise_areas: parsed.data.expertiseAreas,
        certifications: parsed.data.certifications,
      })
      .eq("id", owned.facilitatorId);

    if (error) {
      return { success: false, error: toActionError(error, "facilitator-portal") };
    }
  } else if (section === "languages") {
    const parsed = languagesRegionsSchema.safeParse({
      languages: formData.get("languages")?.toString() ?? "",
      regions: formData.getAll("regions").map(String),
      willingToTravel: formData.get("willingToTravel")?.toString() ?? "",
      travelNotes: formData.get("travelNotes")?.toString() ?? "",
    });

    if (!parsed.success) {
      return { success: false, error: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const { error } = await supabase
      .from("facilitators")
      .update({
        languages: parsed.data.languages,
        regions: parsed.data.regions,
        willing_to_travel: parsed.data.willingToTravel,
        travel_notes: parsed.data.travelNotes || null,
      })
      .eq("id", owned.facilitatorId);

    if (error) {
      return { success: false, error: toActionError(error, "facilitator-portal") };
    }
  } else {
    const parsed = documentsSchema.safeParse({
      passportExpiry: formData.get("passportExpiry")?.toString() ?? "",
      visaCountries: formData.getAll("visaCountries").map(String),
    });

    if (!parsed.success) {
      return { success: false, error: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const { error } = await supabase
      .from("facilitators")
      .update({
        passport_expiry: parsed.data.passportExpiry || null,
        visa_countries: parsed.data.visaCountries,
      })
      .eq("id", owned.facilitatorId);

    if (error) {
      return { success: false, error: toActionError(error, "facilitator-portal") };
    }
  }

  revalidatePath("/facilitator-portal/profile");
  return { success: true, savedAt: new Date().toISOString() };
}

export type UploadFacilitatorPhotoResult = { success: true; photoUrl: string } | { success: false; error: string };

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function uploadFacilitatorProfilePhoto(
  facilitatorId: string,
  formData: FormData
): Promise<UploadFacilitatorPhotoResult> {
  const owned = await resolveOwnFacilitatorId(facilitatorId);
  if ("error" in owned) {
    return { success: false, error: owned.error };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Choose a photo to upload." };
  }

  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return { success: false, error: "Photos must be JPG, PNG, or WEBP." };
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return { success: false, error: "Photos must be smaller than 5MB." };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const photoUrl = await uploadFacilitatorPhoto(owned.facilitatorId, file.name, bytes, file.type);

    const supabase = await createClient();
    const { error } = await supabase.from("facilitators").update({ photo_url: photoUrl }).eq("id", owned.facilitatorId);

    if (error) {
      return { success: false, error: toActionError(error, "facilitator-portal") };
    }

    revalidatePath("/facilitator-portal/profile");
    return { success: true, photoUrl };
  } catch (error) {
    return { success: false, error: toActionError(error, "facilitator-portal", "Unable to upload photo.") };
  }
}

// ---------------------------------------------------------------------------
// Experience detail — called from the client-side slide-over on the My
// Programs page. Re-derives the caller's own facilitator identity from the
// session rather than trusting a client-supplied email, then delegates to
// getFacilitatorExperienceDetail's own ownership check.
// ---------------------------------------------------------------------------

export async function getFacilitatorExperienceDetailForPortal(
  experienceId: string
): Promise<FacilitatorExperienceDetail | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const portalUser = await getFacilitatorPortalUser(user.id);
  if (!portalUser) {
    return null;
  }

  return getFacilitatorExperienceDetail(experienceId, portalUser.email);
}

export async function checkFacilitatorUnavailabilityForAssignment(
  facilitatorId: string,
  startDate: string,
  endDate: string
): Promise<UnavailabilityConflict> {
  return getFacilitatorUnavailabilityConflict(facilitatorId, startDate, endDate);
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export async function checkUnavailabilityConflict(
  facilitatorId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilityConflict> {
  return checkAvailabilityConflict(facilitatorId, startDate, endDate);
}

export type AddUnavailabilityResult =
  | { success: true; conflict: AvailabilityConflict }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function addUnavailability(
  facilitatorId: string,
  startDate: string,
  endDate: string,
  reason: string | undefined
): Promise<AddUnavailabilityResult> {
  const owned = await resolveOwnFacilitatorId(facilitatorId);
  if ("error" in owned) {
    return { success: false, error: owned.error };
  }

  const parsed = addUnavailabilitySchema.safeParse({ startDate, endDate, reason });
  if (!parsed.success) {
    return { success: false, error: "Please correct the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const workspace = await resolveDefaultWorkspace();
  if (!workspace) {
    return { success: false, error: "Unable to save — workspace not configured." };
  }

  const conflict = await checkAvailabilityConflict(owned.facilitatorId, parsed.data.startDate, parsed.data.endDate);

  const supabase = await createClient();
  const { error } = await supabase.from("facilitator_unavailability").insert({
    facilitator_id: owned.facilitatorId,
    organization_id: workspace.organizationId,
    workspace_id: workspace.workspaceId,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    reason: parsed.data.reason || null,
  });

  if (error) {
    return { success: false, error: toActionError(error, "facilitator-portal") };
  }

  revalidatePath("/facilitator-portal/availability");
  return { success: true, conflict };
}

export type RemoveUnavailabilityResult = { success: true } | { success: false; error: string };

export async function removeUnavailability(unavailabilityId: string): Promise<RemoveUnavailabilityResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Your session has expired. Please sign in again." };
  }

  // Ownership is enforced by joining through facilitators.auth_user_id, not
  // by trusting the caller-supplied id alone.
  const { data: block, error: fetchError } = await supabase
    .from("facilitator_unavailability")
    .select("id, facilitators!inner(auth_user_id)")
    .eq("id", unavailabilityId)
    .eq("facilitators.auth_user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return { success: false, error: toActionError(fetchError, "facilitator-portal") };
  }

  if (!block) {
    return { success: false, error: "Unavailability block not found." };
  }

  const { error } = await supabase
    .from("facilitator_unavailability")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", unavailabilityId);

  if (error) {
    return { success: false, error: toActionError(error, "facilitator-portal") };
  }

  revalidatePath("/facilitator-portal/availability");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Facilitator portal sign out — same Supabase Auth system as the operator
// dashboard's features/auth/actions.ts signOut(); the shared /login page is
// the correct landing spot for either kind of user signing out.
// ---------------------------------------------------------------------------

export async function facilitatorPortalSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
