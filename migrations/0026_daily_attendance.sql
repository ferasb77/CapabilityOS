-- Sprint 30: daily attendance tracking for multi-day experiences.
--
-- organization_id/workspace_id are required on every new table per the
-- Engineering Constitution, even though `experiences` and `participants`
-- predate that rule and carry neither column themselves (see 0022's
-- comment). Both are resolved the same way report_branding (0025) resolves
-- workspace_id for this single-tenant deployment: the one existing
-- workspace/organization row, joined together so both columns can be set
-- from a single lookup.
--
-- Run manually via the Supabase SQL editor. Safe to re-run.

create table daily_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  workspace_id uuid not null references workspaces(id),
  experience_id uuid not null references experiences(id) on delete cascade,
  participant_id uuid not null references participants(id),
  attendance_date date not null,
  checked_in_at timestamptz not null default now(),
  check_in_method text not null default 'qr'
    check (check_in_method in ('qr', 'manual', 'self_report')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Prevent duplicate check-ins per day per participant. A plain (non-partial)
-- constraint, not scoped to `where deleted_at is null` — Postgres can only
-- use a partial index as an ON CONFLICT arbiter if the conflict clause
-- repeats its exact WHERE predicate, which the Supabase JS client's
-- `.upsert()` has no way to express. "Mark All Present" (features/attendance/
-- actions.ts) relies on plain `ON CONFLICT ... DO NOTHING` semantics, so this
-- stays a real constraint; no code path in this feature ever soft-deletes an
-- attendance row, so the tradeoff (a deleted row would block re-check-in for
-- that date) never actually bites.
alter table daily_attendance
  add constraint daily_attendance_unique_checkin unique (experience_id, participant_id, attendance_date);

create index on daily_attendance(experience_id, attendance_date);
create index on daily_attendance(participant_id);
create index on daily_attendance(workspace_id);
create index on daily_attendance(organization_id);

alter table daily_attendance enable row level security;

create policy "Authenticated users can manage daily attendance"
  on daily_attendance for all to authenticated using (true);

-- Anonymous check-ins never insert into this table directly — only via
-- record_daily_attendance below, which runs as security definer and so
-- bypasses this policy entirely. This policy exists purely to make that
-- intent explicit and to keep a stray direct-insert attempt from anon
-- failing closed rather than silently succeeding.
create policy "Public can insert daily attendance via RPC"
  on daily_attendance for insert to anon with check (false);

create trigger daily_attendance_updated_at
  before update on daily_attendance
  for each row execute function update_updated_at();

-- Add daily_checkin_enabled flag to experiences
alter table experiences
  add column if not exists daily_checkin_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- Security definer RPC for anonymous daily check-in
-- ---------------------------------------------------------------------------

drop function if exists record_daily_attendance(text, text, date);

create function record_daily_attendance(
  p_experience_slug text,
  p_participant_email text,
  p_attendance_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_experience experiences%rowtype;
  v_participant participants%rowtype;
  v_organization_id uuid;
  v_workspace_id uuid;
  v_attendance_id uuid;
  v_already_checked_in boolean;
begin
  -- Resolve experience
  select * into v_experience
  from experiences
  where slug = p_experience_slug and deleted_at is null;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Experience not found');
  end if;

  if not v_experience.daily_checkin_enabled then
    return jsonb_build_object('success', false, 'error', 'Daily check-in not enabled for this experience');
  end if;

  -- Resolve participant by email + experience slug
  select * into v_participant
  from participants
  where email = p_participant_email
  and workshop_slug = p_experience_slug
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Participant not found. Please register first.');
  end if;

  -- Check if already checked in today
  select exists(
    select 1 from daily_attendance
    where experience_id = v_experience.id
    and participant_id = v_participant.id
    and attendance_date = p_attendance_date
    and deleted_at is null
  ) into v_already_checked_in;

  if v_already_checked_in then
    return jsonb_build_object(
      'success', true,
      'already_checked_in', true,
      'participant_name', v_participant.first_name,
      'attendance_date', p_attendance_date
    );
  end if;

  select w.id, w.organization_id into v_workspace_id, v_organization_id
  from workspaces w
  limit 1;

  -- Insert attendance record
  insert into daily_attendance (
    organization_id, workspace_id, experience_id, participant_id,
    attendance_date, check_in_method
  ) values (
    v_organization_id, v_workspace_id, v_experience.id, v_participant.id,
    p_attendance_date, 'qr'
  ) returning id into v_attendance_id;

  return jsonb_build_object(
    'success', true,
    'already_checked_in', false,
    'participant_name', v_participant.first_name,
    'attendance_date', p_attendance_date,
    'attendance_id', v_attendance_id
  );
end;
$$;

revoke all on function record_daily_attendance(text, text, date) from public;
grant execute on function record_daily_attendance(text, text, date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_checkin_context (0021) and get_experience_for_checkin (0022) both need
-- daily_checkin_enabled — the public check-in page uses the first to decide
-- whether to show the "Check In" tab at all, and checkInParticipant
-- (features/participants/actions.ts) uses the second to decide whether to
-- also record Day 1 attendance right after registering.
-- ---------------------------------------------------------------------------

drop function if exists get_checkin_context(text);

create function get_checkin_context(p_slug text)
returns table (
  title text,
  title_ar text,
  experience_type text,
  venue text,
  start_date timestamptz,
  end_date timestamptz,
  daily_checkin_enabled boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select e.title, e.title_ar, e.experience_type, e.venue, e.start_date, e.end_date, e.daily_checkin_enabled
    from experiences e
    where e.slug = p_slug
      and e.deleted_at is null;
end;
$$;

revoke all on function get_checkin_context(text) from public;
grant execute on function get_checkin_context(text) to anon, authenticated;

drop function if exists get_experience_for_checkin(text);

create function get_experience_for_checkin(p_slug text)
returns table (
  id uuid,
  daily_checkin_enabled boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select e.id, e.daily_checkin_enabled
    from experiences e
    where e.slug = p_slug
      and e.deleted_at is null;
end;
$$;

revoke all on function get_experience_for_checkin(text) from public;
grant execute on function get_experience_for_checkin(text) to anon, authenticated;
