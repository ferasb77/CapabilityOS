-- 0003_survey_system.sql
--
-- Satisfaction survey system: one token per participant per workshop, a
-- response per token, and the public /survey/[token] flow that reads and
-- writes them without a login.
--
-- Run manually via the Supabase SQL editor (no service-role key or CLI is
-- configured in this environment). Safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists survey_tokens (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id),
  workshop_id uuid not null references workshops(id),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references survey_tokens(id),
  workshop_id uuid not null references workshops(id),
  participant_id uuid not null references participants(id),
  content_rating integer not null check (content_rating between 1 and 5),
  facilitator_rating integer not null check (facilitator_rating between 1 and 5),
  logistics_rating integer not null check (logistics_rating between 1 and 5),
  overall_rating integer not null check (overall_rating between 1 and 5),
  highlights text,
  improvements text,
  additional_comments text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists survey_tokens_participant_id_idx on survey_tokens (participant_id);
create index if not exists survey_tokens_workshop_id_idx on survey_tokens (workshop_id);
create index if not exists survey_tokens_token_idx on survey_tokens (token);
create index if not exists survey_responses_workshop_id_idx on survey_responses (workshop_id);
create index if not exists survey_responses_token_id_idx on survey_responses (token_id);

-- The "one per participant per workshop" the table comment describes isn't
-- enforced by the base schema (no unique constraint) — added here so resends
-- reuse the same row/link instead of minting a new one every time.
create unique index if not exists survey_tokens_participant_workshop_idx
  on survey_tokens (participant_id, workshop_id);

alter table survey_tokens enable row level security;
alter table survey_responses enable row level security;

drop policy if exists "Authenticated users can manage survey tokens" on survey_tokens;
create policy "Authenticated users can manage survey tokens"
  on survey_tokens for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can read survey responses" on survey_responses;
create policy "Authenticated users can read survey responses"
  on survey_responses for select
  to authenticated
  using (true);

-- Deliberately NOT adding the plain "anon insert/select" policies the spec
-- sketched for survey_tokens/survey_responses. `token` is the only secret
-- gating a participant's survey — a `using (true)` SELECT or UPDATE policy
-- on survey_tokens would let anyone with the public anon key dump every
-- participant's token (or blank out every completed_at) over the open
-- PostgREST endpoint, with no server-side code involved. Same problem for a
-- raw INSERT policy on survey_responses: it would accept a response tied to
-- any guessed token_id/workshop_id/participant_id UUID, bypassing the
-- "not already completed" rule entirely.
--
-- Instead, the two moves the public survey page needs — read context for a
-- given token (and mark it opened), and submit a response (and mark it
-- completed) — are `security definer` functions. Each takes the raw token
-- text as an argument and does the row lookup itself, so the only "access
-- key" is knowing the correct token string, never a table-wide grant.

create or replace function get_survey_context(p_token text)
returns table (
  token_id uuid,
  is_valid boolean,
  is_completed boolean,
  participant_first_name text,
  workshop_title text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token record;
begin
  select st.id, st.completed_at, p.first_name, w.title
    into v_token
    from survey_tokens st
    join participants p on p.id = st.participant_id
    join workshops w on w.id = st.workshop_id
    where st.token = p_token;

  if not found then
    return query select null::uuid, false, false, null::text, null::text;
    return;
  end if;

  update survey_tokens
  set opened_at = now()
  where id = v_token.id and opened_at is null;

  return query
    select v_token.id, true, (v_token.completed_at is not null), v_token.first_name, v_token.title;
end;
$$;

revoke all on function get_survey_context(text) from public;
grant execute on function get_survey_context(text) to anon, authenticated;

create or replace function submit_survey_response(
  p_token text,
  p_content_rating integer,
  p_facilitator_rating integer,
  p_logistics_rating integer,
  p_overall_rating integer,
  p_highlights text,
  p_improvements text,
  p_additional_comments text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token record;
  v_response_id uuid;
begin
  select id, workshop_id, participant_id, completed_at
    into v_token
    from survey_tokens
    where token = p_token
    for update;

  if not found then
    raise exception 'invalid_token';
  end if;

  if v_token.completed_at is not null then
    raise exception 'already_completed';
  end if;

  insert into survey_responses (
    token_id, workshop_id, participant_id,
    content_rating, facilitator_rating, logistics_rating, overall_rating,
    highlights, improvements, additional_comments
  ) values (
    v_token.id, v_token.workshop_id, v_token.participant_id,
    p_content_rating, p_facilitator_rating, p_logistics_rating, p_overall_rating,
    p_highlights, p_improvements, p_additional_comments
  )
  returning id into v_response_id;

  update survey_tokens
  set completed_at = now()
  where id = v_token.id;

  return v_response_id;
end;
$$;

revoke all on function submit_survey_response(text, integer, integer, integer, integer, text, text, text) from public;
grant execute on function submit_survey_response(text, integer, integer, integer, integer, text, text, text) to anon;
