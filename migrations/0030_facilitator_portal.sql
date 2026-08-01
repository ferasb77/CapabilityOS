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
    default encode(gen_random_bytes(32), 'hex');

-- Facilitator unavailability blocks
create table if not exists facilitator_unavailability (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid not null references facilitators(id) on delete cascade,
  workspace_id uuid not null references workspaces(id),
  start_date date not null,
  end_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_date_range check (end_date >= start_date)
);

create index if not exists facilitator_unavailability_facilitator_id_idx on facilitator_unavailability(facilitator_id);
create index if not exists facilitator_unavailability_dates_idx on facilitator_unavailability(start_date, end_date);

alter table facilitator_unavailability enable row level security;

drop policy if exists "Authenticated users can manage facilitator unavailability" on facilitator_unavailability;
create policy "Authenticated users can manage facilitator unavailability"
  on facilitator_unavailability for all to authenticated using (true);

drop trigger if exists facilitator_unavailability_updated_at on facilitator_unavailability;
create trigger facilitator_unavailability_updated_at
  before update on facilitator_unavailability
  for each row execute function update_updated_at();
