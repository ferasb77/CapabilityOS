/**
 * Every Server Action must return a human-readable error, never a raw
 * Postgres/Supabase error string (CLAUDE.md: "Never return raw Supabase
 * errors to the client"). This is the single choke point for that: logs the
 * real error server-side (with a label so it's traceable in server logs)
 * and returns a safe, user-facing fallback message in its place.
 */
export function toActionError(error: unknown, label: string, fallback = "Something went wrong. Please try again."): string {
  console.error(`[${label}]`, error);
  return fallback;
}
