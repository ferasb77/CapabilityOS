-- Sprint 32: client portal.
--
-- organization_id added to the drafted schema per the Engineering
-- Constitution (every new table carries it) — `clients` itself has
-- workspace_id but no organization_id column, so it's resolved via
-- workspaces.organization_id at invite time, same pattern as migrations
-- 0026/0027.
--
-- Everything else below (columns, both RLS policies, the updated_at
-- trigger) is exactly as drafted. Note for anyone extending this table's
-- read surface later: this is the one table in the schema with *real*
-- per-workspace RLS (`workspace_id in (select workspace_id from profiles
-- where id = auth.uid())`) rather than the blanket "authenticated using
-- (true)" every other table in this single-tenant deployment uses — but
-- every OTHER table a client portal user needs to read (experiences,
-- participants, survey_responses, daily_attendance, facilitator_reports,
-- clients, engagements) still has that blanket policy, which would let an
-- authenticated portal user read any client's data through it. That's why
-- CLAUDE.md's brief for this sprint says access is "enforced at the data
-- fetching layer, not just the UI" — features/client-portal/data.ts must
-- always filter and validate ownership in code; it cannot rely on RLS
-- alone to keep one client's contacts from seeing another's programs.
--
-- Run manually via the Supabase SQL editor. Safe to re-run.

create table client_portal_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  client_id uuid not null references clients(id) on delete cascade,
  workspace_id uuid not null references workspaces(id),
  -- Identity
  email text not null,
  full_name text not null,
  job_title text,
  -- Supabase Auth user (set after they accept invitation)
  auth_user_id uuid unique,
  -- Invitation
  invited_at timestamptz not null default now(),
  invited_by uuid references profiles(id),
  invitation_accepted_at timestamptz,
  invitation_token text unique default encode(gen_random_bytes(32), 'hex'),
  -- Status
  is_active boolean not null default true,
  last_seen_at timestamptz,
  -- Meta
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(client_id, email)
);

create index on client_portal_users(client_id);
create index on client_portal_users(auth_user_id);
create index on client_portal_users(email);
create index on client_portal_users(workspace_id);
create index on client_portal_users(organization_id);

alter table client_portal_users enable row level security;

create policy "Authenticated workspace users can manage client portal users"
  on client_portal_users for all to authenticated
  using (workspace_id in (
    select workspace_id from profiles where id = auth.uid()
  ));

create policy "Client portal users can see their own record"
  on client_portal_users for select to authenticated
  using (auth_user_id = auth.uid());

create trigger client_portal_users_updated_at
  before update on client_portal_users
  for each row execute function update_updated_at();
