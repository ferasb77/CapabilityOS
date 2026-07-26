-- 0021_public_checkin_context.sql
--
-- The public check-in form at /r/[slug] needs to render the real
-- experience's title, type, venue, and dates for a signed-out visitor.
-- experiences is RLS-protected to the authenticated user's own
-- organization/workspace, so a plain anon-key SELECT against it returns
-- zero rows (silently — no error, just an empty result), which is exactly
-- why /r/[slug] was previously showing hardcoded copy instead of a real
-- experience: reading the table directly was never actually possible from
-- this page.
--
-- This mirrors get_survey_context (0003/0015) and get_materials_by_token
-- (0018): a narrow, security definer function returning only the fields
-- safe to show on a public page — no facilitator contact info, client
-- contact info, or internal notes — granted to anon.
--
-- Run manually via the Supabase SQL editor. Safe to re-run.

drop function if exists get_checkin_context(text);

create function get_checkin_context(p_slug text)
returns table (
  title text,
  experience_type text,
  venue text,
  start_date timestamptz,
  end_date timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select e.title, e.experience_type, e.venue, e.start_date, e.end_date
    from experiences e
    where e.slug = p_slug
      and e.deleted_at is null;
end;
$$;

revoke all on function get_checkin_context(text) from public;
grant execute on function get_checkin_context(text) to anon, authenticated;
