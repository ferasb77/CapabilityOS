-- 0022_experience_checkin_lookup.sql
--
-- checkInParticipant (features/participants/actions.ts) looks up the
-- experience's id by slug right after inserting the participant, purely to
-- gate three fire-and-forget side effects: auto-certificate issuance, the
-- pre-training survey trigger, and materials-token creation. That lookup
-- went through the session-bound client — but anonymous check-in visitors
-- have no session, and `experiences` SELECT is restricted to
-- `authenticated` (see pg_policies), so the lookup silently returned
-- nothing and all three side effects were skipped for every real,
-- anonymous check-in.
--
-- get_experience_for_checkin is a narrow, security definer function
-- scoped to exactly what those three call sites need — none of
-- maybeAutoIssueCertificate, sendPreTrainingSurveyOnRegistration, or
-- createOrGetMaterialToken take anything but an experience id, so that's
-- all this returns (experiences has no workspace_id/organization_id
-- column in this schema to return alongside it). Granted to anon so this
-- stays independently callable the same way get_checkin_context (0021)
-- is; the checkInParticipant call site itself uses the service-role
-- client, which already bypasses RLS outright — matching how
-- maybeAutoIssueCertificate/createOrGetMaterialToken already read and
-- write from this same fire-and-forget path.
--
-- Run manually via the Supabase SQL editor. Safe to re-run.

drop function if exists get_experience_for_checkin(text);

create function get_experience_for_checkin(p_slug text)
returns table (
  id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select e.id
    from experiences e
    where e.slug = p_slug
      and e.deleted_at is null;
end;
$$;

revoke all on function get_experience_for_checkin(text) from public;
grant execute on function get_experience_for_checkin(text) to anon, authenticated;
