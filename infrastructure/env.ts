const FALLBACKS: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "placeholder-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",
  RESEND_FROM_EMAIL: "noreply@example.com",
};

export function requireEnv(name: string): string {
  const value = process.env[name] || FALLBACKS[name];

  if (!value) {
    throw new Error(`${name} is not configured. Add it to .env before using this feature.`);
  }

  return value;
}
