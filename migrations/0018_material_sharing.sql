-- 0018_material_sharing.sql
--
-- Sprint 20: material sharing — a participant materials portal
-- (/materials/[token], fully public) and a facilitator resource folder
-- (/facilitator/[id]/materials/[experienceSlug], authenticated), both
-- backed by one `experience_materials` library per experience.
--
-- Deviations from the sprint brief, flagged here for the record:
--
--   1. The brief's RLS policies grant `anon` a bare SELECT on both new
--      tables:
--        `on experience_materials for select to anon using (deleted_at is null)`
--        `on participant_material_tokens for select to anon using (true)`
--      The second one is the same mistake migration 0003's header comment
--      specifically warned against for survey_tokens: a `using (true)`
--      SELECT policy over the public PostgREST endpoint lets anyone with
--      the published anon key run `GET /participant_material_tokens?select=*`
--      and dump every participant's materials-access token — no token
--      needed to get the tokens. That directly contradicts this same
--      sprint's own architecture rule ("Token is the only authentication
--      for the participant portal — treat it like a password"). The first
--      policy is a lesser version of the same problem: it lets anyone list
--      every material across every experience (titles, file paths,
--      facilitator-only items) with no token at all, bypassing the
--      availability/audience filtering the portal is supposed to enforce.
--      Fixed the same way 0003/0014 fixed it for surveys: no anon table
--      grants at all; a single `security definer` RPC
--      (`get_materials_by_token`) does the token lookup and the
--      availability-filtered materials query server-side, so the only way
--      to read anything is to already know a valid token string.
--   2. `experience_materials.uploaded_by` (as given) references
--      `profiles(id)` — but `facilitators` has no row in `profiles` and no
--      way to sign in as themselves (confirmed: no `user_id`/`profile_id`
--      column on `facilitators`, no `/facilitator` auth flow anywhere in
--      this codebase). The facilitator resource-folder route is gated by
--      the existing operator session (same as every other authenticated
--      page), not a per-facilitator session, so `uploaded_by` on a
--      facilitator-portal upload would record whichever operator happens
--      to be signed in, not the facilitator — making "Uploaded by
--      [Facilitator Name]" impossible to render correctly from that column
--      alone. Added `uploaded_by_facilitator_id uuid references
--      facilitators(id)`, set instead of (not in addition to) `uploaded_by`
--      when a material is added from the facilitator portal.
--
-- Run manually via the Supabase SQL editor. Safe to re-run.

create table if not exists experience_materials (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  workspace_id uuid not null references workspaces(id),
  -- Content
  title text not null,
  description text,
  material_type text not null check (material_type in (
    'file',   -- uploaded file in Supabase Storage
    'link'    -- external URL
  )),
  -- For file type
  file_path text,        -- Supabase Storage path
  file_name text,        -- original filename
  file_size_bytes bigint,
  mime_type text,
  -- For link type
  url text,
  -- Visibility
  audience text not null check (audience in (
    'participant',  -- visible to registered participants
    'facilitator',  -- visible to assigned facilitators only
    'both'          -- visible to both
  )),
  -- Timing control for participants
  available_from text not null default 'registration'
    check (available_from in (
      'registration',  -- immediately when participant registers
      'start_date',    -- from experience start date
      'manual'         -- operator manually releases
    )),
  is_released boolean not null default true,
  -- Ordering
  order_index integer not null default 0,
  -- Meta
  uploaded_by uuid references profiles(id),
  -- See deviation #2 above: set instead of uploaded_by for uploads made
  -- through the facilitator portal, since facilitators have no profiles row.
  uploaded_by_facilitator_id uuid references facilitators(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Participant material access tokens (one per participant per experience)
create table if not exists participant_material_tokens (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id),
  experience_id uuid not null references experiences(id),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz not null default now(),
  unique(participant_id, experience_id)
);

create index if not exists experience_materials_experience_id_idx on experience_materials(experience_id);
create index if not exists experience_materials_audience_idx on experience_materials(audience);
create index if not exists participant_material_tokens_token_idx on participant_material_tokens(token);
create index if not exists participant_material_tokens_participant_experience_idx
  on participant_material_tokens(participant_id, experience_id);

alter table experience_materials enable row level security;
alter table participant_material_tokens enable row level security;

drop policy if exists "Authenticated users can manage materials" on experience_materials;
create policy "Authenticated users can manage materials"
  on experience_materials for all to authenticated using (true);

drop policy if exists "Authenticated users can manage material tokens" on participant_material_tokens;
create policy "Authenticated users can manage material tokens"
  on participant_material_tokens for all to authenticated using (true);

-- No anon policies on either table — see deviation #1 above. The public
-- /materials/[token] page reads exclusively through get_materials_by_token
-- below, which is the only thing anon is granted execute on.

drop trigger if exists experience_materials_updated_at on experience_materials;
create trigger experience_materials_updated_at
  before update on experience_materials
  for each row execute function update_updated_at();

-- ---------------------------------------------------------------------------
-- get_materials_by_token: the sole public read path for the materials
-- portal. Resolves the token, then returns the participant/experience
-- context plus a jsonb array of materials already filtered by audience
-- (participant-visible only) and availability (registration/start_date/
-- manual rules applied here, not in the client) — same shape of
-- responsibility as get_survey_context from migration 0014/0017.
-- ---------------------------------------------------------------------------

create or replace function get_materials_by_token(p_token text)
returns table (
  token_id uuid,
  participant_id uuid,
  experience_id uuid,
  participant_first_name text,
  experience_title text,
  experience_start_date timestamptz,
  experience_end_date timestamptz,
  experience_venue text,
  materials jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token participant_material_tokens%rowtype;
  v_participant participants%rowtype;
  v_experience experiences%rowtype;
  v_materials jsonb;
begin
  select * into v_token
  from participant_material_tokens
  where token = p_token;

  if not found then return; end if;

  select * into v_participant from participants where id = v_token.participant_id;
  select * into v_experience from experiences where id = v_token.experience_id;

  select jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'title', m.title,
      'description', m.description,
      'material_type', m.material_type,
      'file_path', m.file_path,
      'file_name', m.file_name,
      'file_size_bytes', m.file_size_bytes,
      'mime_type', m.mime_type,
      'url', m.url,
      'available_from', m.available_from,
      'order_index', m.order_index
    ) order by m.order_index
  ) into v_materials
  from experience_materials m
  where m.experience_id = v_token.experience_id
    and m.deleted_at is null
    and m.audience in ('participant', 'both')
    and (
      m.available_from = 'registration'
      or (m.available_from = 'start_date' and now() >= v_experience.start_date)
      or (m.available_from = 'manual' and m.is_released = true)
    );

  return query select
    v_token.id,
    v_token.participant_id,
    v_token.experience_id,
    v_participant.first_name,
    v_experience.title,
    v_experience.start_date,
    v_experience.end_date,
    v_experience.venue,
    coalesce(v_materials, '[]'::jsonb);
end;
$$;

revoke all on function get_materials_by_token(text) from public;
grant execute on function get_materials_by_token(text) to anon, authenticated;
