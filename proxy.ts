import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/infrastructure/supabase/session";

// ---------------------------------------------------------------------------
// In-memory sliding-window rate limiter for public routes. Render restarts
// instances and this repo has no Redis configured, so state lives in a
// module-level Map rather than an external store — acceptable here because
// the goal is abuse/spam throttling per-instance, not a hard global cap.
// ---------------------------------------------------------------------------

type RateLimitRecord = { count: number; resetAt: number };

const rateLimitMap = new Map<string, RateLimitRecord>();
let requestsSinceCleanup = 0;

function cleanupExpired(now: number): void {
  for (const [key, record] of rateLimitMap) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}

function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();

  requestsSinceCleanup++;
  if (requestsSinceCleanup >= 100) {
    requestsSinceCleanup = 0;
    cleanupExpired(now);
  }

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

type RateLimitRule = {
  pattern: RegExp;
  method: string;
  maxRequests: number;
  windowMs: number;
  name: string;
};

const MINUTE = 60 * 1000;

const RATE_LIMIT_RULES: RateLimitRule[] = [
  { name: "checkin", pattern: /^\/r\/[^/]+$/, method: "POST", maxRequests: 10, windowMs: 10 * MINUTE },
  { name: "survey", pattern: /^\/survey\/[^/]+$/, method: "POST", maxRequests: 5, windowMs: 10 * MINUTE },
  { name: "materials", pattern: /^\/materials\/[^/]+$/, method: "GET", maxRequests: 60, windowMs: MINUTE },
  { name: "verify", pattern: /^\/verify\/[^/]+$/, method: "GET", maxRequests: 30, windowMs: MINUTE },
  {
    name: "intelligence-ask",
    pattern: /^\/dashboard\/intelligence\/ask$/,
    method: "POST",
    maxRequests: 20,
    windowMs: 5 * MINUTE,
  },
];

function matchRateLimitRule(pathname: string, method: string): RateLimitRule | null {
  return RATE_LIMIT_RULES.find((rule) => rule.method === method && rule.pattern.test(pathname)) ?? null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rule = matchRateLimitRule(pathname, request.method);

  if (rule) {
    const ip = getClientIp(request);
    const key = `${rule.name}:${ip}`;

    if (!rateLimit(key, rule.maxRequests, rule.windowMs)) {
      if (request.method === "GET") {
        return new NextResponse("Too many requests. Please try again later.", { status: 429 });
      }
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
