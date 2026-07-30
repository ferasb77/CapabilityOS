-- Sprint 31: facilitator observations and AI-assisted final report.
--
-- organization_id/workspace_id added to every table per the Engineering
-- Constitution, same reasoning as migration 0026: experiences/participants
-- predate that rule and carry neither column, so both are resolved from the
-- single workspace/organization row at write time.
--
-- Two changes from the drafted schema, both because this app has no
-- facilitator-specific login (see 0018's header comment and
-- features/participants/components/checkin-page-content.tsx) — "the
-- facilitator" is whichever authenticated dashboard user typed into the
-- Facilitator Name field, not a row the session can be reliably joined to:
--
-- 1. `unique(..., facilitator_id)` as drafted would not actually enforce
--    "one row per facilitator" — facilitator_id is nullable, and Postgres
--    unique constraints treat every NULL as distinct from every other NULL,
--    so any number of unlinked observations could exist per participant.
--    The Server Action signatures in the brief confirm the real identity
--    key is the facilitator's name (saveParticipantObservation and
--    saveExperienceObservation both take facilitatorName, never
--    facilitatorId) — so these constraints key on facilitator_name instead.
-- 2. `deleted_at` is added to the three content tables (participant_
--    observations, experience_observations, facilitator_reports) per the
--    constitution's soft-delete rule, but not to observation_tags — that
--    table is a simple, freely reorderable per-experience config list, the
--    same shape as survey_questions (migrations 0003/0014), which this
--    codebase already hard-deletes from with no deleted_at column at all.
--
-- Run manually via the Supabase SQL editor. Safe to re-run.

create table observation_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  workspace_id uuid not null references workspaces(id),
  experience_id uuid not null references experiences(id) on delete cascade,
  label text not null,
  color text not null default '#C9A96E',
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table participant_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  workspace_id uuid not null references workspaces(id),
  experience_id uuid not null references experiences(id) on delete cascade,
  participant_id uuid not null references participants(id),
  facilitator_id uuid references facilitators(id),
  facilitator_name text not null,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (experience_id, participant_id, facilitator_name)
);

create table experience_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  workspace_id uuid not null references workspaces(id),
  experience_id uuid not null references experiences(id) on delete cascade,
  facilitator_id uuid references facilitators(id),
  facilitator_name text not null,
  group_dynamics text,
  key_themes text,
  recommendations text,
  general_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (experience_id, facilitator_name)
);

create table facilitator_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  workspace_id uuid not null references workspaces(id),
  experience_id uuid not null references experiences(id) on delete cascade,
  facilitator_id uuid references facilitators(id),
  facilitator_name text not null,
  draft_content text not null,
  edited_content text,
  status text not null default 'draft'
    check (status in ('draft', 'edited', 'approved', 'exported')),
  generated_at timestamptz not null default now(),
  approved_at timestamptz,
  exported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (experience_id, facilitator_name)
);

-- Indexes — every foreign key, per the constitution.
create index on observation_tags(experience_id);
create index on observation_tags(workspace_id);
create index on observation_tags(organization_id);

create index on participant_observations(experience_id);
create index on participant_observations(participant_id);
create index on participant_observations(facilitator_id);
create index on participant_observations(workspace_id);
create index on participant_observations(organization_id);

create index on experience_observations(experience_id);
create index on experience_observations(facilitator_id);
create index on experience_observations(workspace_id);
create index on experience_observations(organization_id);

create index on facilitator_reports(experience_id);
create index on facilitator_reports(facilitator_id);
create index on facilitator_reports(workspace_id);
create index on facilitator_reports(organization_id);

-- RLS — same "authenticated only, no per-org scoping yet" pattern every
-- other table in this single-tenant deployment uses (see 0024's audit).
alter table observation_tags enable row level security;
alter table participant_observations enable row level security;
alter table experience_observations enable row level security;
alter table facilitator_reports enable row level security;

create policy "Authenticated users can manage observation tags"
  on observation_tags for all to authenticated using (true);
create policy "Authenticated users can manage participant observations"
  on participant_observations for all to authenticated using (true);
create policy "Authenticated users can manage experience observations"
  on experience_observations for all to authenticated using (true);
create policy "Authenticated users can manage facilitator reports"
  on facilitator_reports for all to authenticated using (true);

create trigger participant_observations_updated_at
  before update on participant_observations
  for each row execute function update_updated_at();
create trigger experience_observations_updated_at
  before update on experience_observations
  for each row execute function update_updated_at();
create trigger facilitator_reports_updated_at
  before update on facilitator_reports
  for each row execute function update_updated_at();

-- Default tags (Leadership, Quiet, Influential, Analytical, Resistant,
-- Collaborative, Engaged) are NOT bulk-seeded here — observation_tags.
-- experience_id is NOT NULL (no "global default" row to copy from), and new
-- experiences keep being created indefinitely after this migration runs.
-- getObservationTags (features/observations/data.ts) lazily inserts the
-- seven defaults for an experience the first time its tags are read and
-- none exist yet, so every experience — past or future — gets them without
-- a one-time backfill.
