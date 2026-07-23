-- 0002_workshop_status_slug_and_dashboard_access.sql
--
-- Sprint 2 (operator dashboard) needs two things the live `workshops` table
-- doesn't have: a `slug` to join against `participants.workshop_slug`, and
-- a `status` to drive stats, badges, and attention-flagging. Verified via
-- the PostgREST schema (no service-role key is configured in this
-- environment) that neither column exists yet, and that both `workshops`
-- and `participants` have row level security enabled with zero policies —
-- meaning no row is currently visible outside the service role, including
-- to authenticated dashboard users.
--
-- organization_id / workspace_id are intentionally NOT added here — that is
-- the separate "multi-tenancy audit" step CLAUDE.md schedules after the
-- dashboard. Read access below is single-tenant on purpose.
--
-- Run manually via the Supabase SQL editor (or `supabase db push` once the
-- CLI is linked). Safe to re-run.

do $$
begin
  create type workshop_status as enum ('draft', 'active', 'completed');
exception
  when duplicate_object then null;
end
$$;

alter table workshops add column if not exists slug text;
alter table workshops add column if not exists status workshop_status not null default 'draft';

-- Backfill the one real workshop this repo already has check-in links for
-- (participants.workshop_slug = 'ai-powered-design-thinking'). Its dates
-- (July 21-22) have passed, so it's complete rather than active.
update workshops
set slug = 'ai-powered-design-thinking',
    status = 'completed'
where title = 'AI Powered Design Thinking'
  and slug is null;

alter table workshops alter column slug set not null;

create unique index if not exists workshops_slug_idx on workshops (slug);
create index if not exists workshops_status_idx on workshops (status);
create index if not exists workshops_start_date_idx on workshops (start_date);
create index if not exists participants_workshop_slug_idx on participants (workshop_slug);
create index if not exists participants_checked_in_idx on participants (checked_in);
create index if not exists participants_created_at_idx on participants (created_at);

alter table workshops enable row level security;
alter table participants enable row level security;

drop policy if exists "Authenticated users can view workshops" on workshops;
create policy "Authenticated users can view workshops"
  on workshops for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can view participants" on participants;
create policy "Authenticated users can view participants"
  on participants for select
  to authenticated
  using (true);
