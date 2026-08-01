import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type SupabaseMiddlewareClient = ReturnType<typeof createServerClient>;

/**
 * Resolves which of the two, mutually exclusive user tables the
 * authenticated session belongs to — an operator (profiles) or a client
 * contact (client_portal_users). Only ever called once per request, and
 * only when the route actually needs to know, since it costs two extra
 * queries beyond the getClaims() call already made.
 */
async function resolveUserKind(
  supabase: SupabaseMiddlewareClient,
  userId: string
): Promise<"dashboard" | "portal" | "facilitator" | "none"> {
  const [{ data: profile }, { data: portalUser }, { data: facilitator }] = await Promise.all([
    supabase.from("profiles").select("id").eq("id", userId).maybeSingle(),
    supabase.from("client_portal_users").select("id").eq("auth_user_id", userId).eq("is_active", true).maybeSingle(),
    supabase.from("facilitators").select("id").eq("auth_user_id", userId).eq("portal_access_active", true).maybeSingle(),
  ]);

  if (profile) return "dashboard";
  if (portalUser) return "portal";
  if (facilitator) return "facilitator";
  return "none";
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the user's authentication state.
  // Supabase now recommends getClaims() for authorization checks.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  const { pathname } = request.nextUrl;
  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";

  // Public portal routes
  const isClientPortalPublicRoute =
    pathname === "/client-portal/accept" ||
    pathname === "/client-portal/forgot-password" ||
    pathname === "/client-portal/reset-password";
  const isClientPortalLoginRoute = pathname === "/client-portal/login";
  const isClientPortalGuardedRoute =
    pathname.startsWith("/client-portal") && !isClientPortalPublicRoute && !isClientPortalLoginRoute;

  const isFacilitatorPortalPublicRoute = pathname === "/facilitator-portal/accept";
  const isFacilitatorPortalGuardedRoute =
    pathname.startsWith("/facilitator-portal") && !isFacilitatorPortalPublicRoute;

  if (isClientPortalPublicRoute || isFacilitatorPortalPublicRoute) {
    return response;
  }

  const userKind = isAuthenticated && userId && (isDashboardRoute || isLoginRoute || isClientPortalGuardedRoute || isClientPortalLoginRoute || isFacilitatorPortalGuardedRoute)
    ? await resolveUserKind(supabase, userId)
    : null;

  if (isDashboardRoute) {
    if (!isAuthenticated) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    if (userKind === "portal") {
      const portalUrl = request.nextUrl.clone();
      portalUrl.pathname = "/client-portal";
      return NextResponse.redirect(portalUrl);
    }
    if (userKind === "facilitator") {
      const facilitatorUrl = request.nextUrl.clone();
      facilitatorUrl.pathname = "/facilitator-portal";
      return NextResponse.redirect(facilitatorUrl);
    }
    if (userKind !== "dashboard") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isLoginRoute) {
    if (userKind === "dashboard") {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashboardUrl);
    }
    if (userKind === "portal") {
      const portalUrl = request.nextUrl.clone();
      portalUrl.pathname = "/client-portal";
      return NextResponse.redirect(portalUrl);
    }
    if (userKind === "facilitator") {
      const facilitatorUrl = request.nextUrl.clone();
      facilitatorUrl.pathname = "/facilitator-portal";
      return NextResponse.redirect(facilitatorUrl);
    }
  }

  if (isClientPortalGuardedRoute) {
    if (!isAuthenticated) {
      const portalLoginUrl = request.nextUrl.clone();
      portalLoginUrl.pathname = "/client-portal/login";
      return NextResponse.redirect(portalLoginUrl);
    }
    if (userKind === "dashboard") {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashboardUrl);
    }
    if (userKind === "facilitator") {
      const facilitatorUrl = request.nextUrl.clone();
      facilitatorUrl.pathname = "/facilitator-portal";
      return NextResponse.redirect(facilitatorUrl);
    }
    if (userKind !== "portal") {
      const portalLoginUrl = request.nextUrl.clone();
      portalLoginUrl.pathname = "/client-portal/login";
      return NextResponse.redirect(portalLoginUrl);
    }
  }

  if (isFacilitatorPortalGuardedRoute) {
    if (!isAuthenticated) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    if (userKind === "dashboard") {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashboardUrl);
    }
    if (userKind === "portal") {
      const portalUrl = request.nextUrl.clone();
      portalUrl.pathname = "/client-portal";
      return NextResponse.redirect(portalUrl);
    }
    if (userKind !== "facilitator") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isClientPortalLoginRoute && userKind === "portal") {
    const portalUrl = request.nextUrl.clone();
    portalUrl.pathname = "/client-portal";
    return NextResponse.redirect(portalUrl);
  }

  return response;
}
