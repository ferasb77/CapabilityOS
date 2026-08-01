-- 0030_facilitator_portal.sql
--
-- Build Sprint 34: Facilitator Portal
-- Link facilitator records to Supabase Auth users and track unavailability blocks.

-- Link facilitator records to auth users
alter table facilitators
  add column if not exists auth_user_id uuid unique references auth.users(id),
  add column if not exists invited_at timestamptz,
  add column if not exists invited_by uuid references profiles(id),
  add column if not exists invitation_accepted_at timestamptz,
  add column if not exists invitation_token text unique
    default encode(gen_random_bytes(32), 'hex'),
  -- Gates portal sign-in independent of `is_active` (directory visibility) —
  -- an operator can pull portal access without removing the facilitator
  -- from the directory. Defaults false: only inviteFacilitatorToPortal()
  -- flips it true, so a freshly-added facilitator has no standing access.
  add column if not exists portal_access_active boolean not null default false;

-- Facilitator unavailability blocks
create table if not exists facilitator_unavailability (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references facilitators(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  workspace_id uuid not null references workspaces(id),
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint valid_date_range check (end_date >= start_date)
);

-- Additive in case this migration originally ran before organization_id /
-- deleted_at were added to the create table block above (safe to re-run;
-- `create table if not exists` is a no-op once the table exists).
alter table facilitator_unavailability
  add column if not exists organization_id uuid references organizations(id),
  add column if not exists deleted_at timestamptz;

alter table facilitator_unavailability alter column organization_id set not null;

create index if not exists facilitator_unavailability_facilitator_id_idx on facilitator_unavailability(facilitator_id);
create index if not exists facilitator_unavailability_dates_idx on facilitator_unavailability(start_date, end_date);
create index if not exists facilitator_unavailability_organization_id_idx on facilitator_unavailability(organization_id);
create index if not exists facilitator_unavailability_workspace_id_idx on facilitator_unavailability(workspace_id);

alter table facilitator_unavailability enable row level security;

drop policy if exists "Authenticated users can manage facilitator unavailability" on facilitator_unavailability;
create policy "Authenticated users can manage facilitator unavailability"
  on facilitator_unavailability for all to authenticated using (true);

drop trigger if exists facilitator_unavailability_updated_at on facilitator_unavailability;
create trigger facilitator_unavailability_updated_at
  before update on facilitator_unavailability
  for each row execute function update_updated_at();
