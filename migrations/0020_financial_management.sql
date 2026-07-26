-- 0020_financial_management.sql
--
-- Sprint 26: financial management layer. Connects delivery to billing —
-- payment milestones trigger automatically when experiences/engagements
-- reach the relevant status, finance contacts get notified by email, and
-- the resulting evidence surfaces on the engagement Financial tab, the
-- executive dashboard, and the Intelligence module.
--
-- payment_milestones and finance_contacts match the sprint brief's given
-- SQL, with one addition: `deleted_at timestamptz` on both tables. The
-- brief's own architecture rules ("Payment milestones are soft-deleted
-- where possible") and deleteMilestone's spec ("soft delete... if column
-- exists") anticipate this column; CLAUDE.md's "created_at, updated_at,
-- deleted_at on all tables" rule settles it in favor of adding it, matching
-- every other table in this migration set (clients, engagements, assets, ...).
--
-- No seed data here — see scripts/seed-financial.ts.
--
-- Run manually via the Supabase SQL editor. Safe to re-run.

-- Payment milestones per engagement
create table if not exists payment_milestones (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references engagements(id) on delete cascade,
  workspace_id uuid not null references workspaces(id),
  title text not null,
  description text,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  -- Trigger configuration
  trigger_type text not null check (trigger_type in (
    'engagement_signing',     -- manual, triggered when engagement is created/activated
    'experience_completion',  -- triggers when a specific experience is completed
    'engagement_completion',  -- triggers when all experiences in engagement are completed
    'date_based',             -- triggers on a specific date
    'manual'                  -- triggered manually by operator
  )),
  trigger_experience_id uuid references experiences(id),  -- for experience_completion type
  trigger_date date,                                        -- for date_based type
  -- Status
  status text not null default 'pending'
    check (status in ('pending', 'triggered', 'invoiced', 'collected', 'overdue')),
  -- Dates
  triggered_at timestamptz,
  invoiced_at timestamptz,
  collected_at timestamptz,
  due_date date,
  -- Finance notification
  finance_email text,
  notification_sent_at timestamptz,
  -- Notes
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Finance contacts per workspace
create table if not exists finance_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  name text not null,
  email text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists payment_milestones_engagement_id_idx on payment_milestones(engagement_id);
create index if not exists payment_milestones_workspace_id_idx on payment_milestones(workspace_id);
create index if not exists payment_milestones_status_idx on payment_milestones(status);
create index if not exists payment_milestones_trigger_experience_id_idx on payment_milestones(trigger_experience_id);
create index if not exists payment_milestones_deleted_at_idx on payment_milestones(deleted_at);
create index if not exists finance_contacts_workspace_id_idx on finance_contacts(workspace_id);
create index if not exists finance_contacts_deleted_at_idx on finance_contacts(deleted_at);

alter table payment_milestones enable row level security;
alter table finance_contacts enable row level security;

drop policy if exists "Authenticated users can manage payment milestones" on payment_milestones;
create policy "Authenticated users can manage payment milestones"
  on payment_milestones for all to authenticated using (true);

drop policy if exists "Authenticated users can manage finance contacts" on finance_contacts;
create policy "Authenticated users can manage finance contacts"
  on finance_contacts for all to authenticated using (true);

drop trigger if exists payment_milestones_updated_at on payment_milestones;
create trigger payment_milestones_updated_at
  before update on payment_milestones
  for each row execute function update_updated_at();

-- Workspace-level finance defaults, for the Finance Settings page. Added to
-- `workspaces` rather than a new one-row-per-workspace table — there is
-- nothing else about these two fields that warrants its own table.
alter table workspaces
  add column if not exists default_currency text not null default 'USD',
  add column if not exists default_payment_terms text not null default 'net_30'
    check (default_payment_terms in ('net_30', 'net_45', 'net_60'));
