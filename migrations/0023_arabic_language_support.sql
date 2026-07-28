-- 0023_arabic_language_support.sql
--
-- Sprint 27: Arabic language support for participant-facing surfaces
-- (check-in, survey, certificates, experience titles). This is a data-layer
-- migration only — every field here is optional, English remains the
-- fallback everywhere, and the operator dashboard is untouched.
--
-- Deviation from the sprint brief, flagged here for the record:
--   The brief's survey_questions block has a stray `;` after
--   `options_ar jsonb` that silently closes the `alter table` statement,
--   leaving `add column if not exists low_label_ar text;` as a dangling
--   fragment with no table context — a syntax error. Split into five
--   separate `alter table ... add column` statements below instead, one per
--   column, matching this migration's own style elsewhere.
--
-- Run manually via the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- experiences: language classification + Arabic title
-- ---------------------------------------------------------------------------

alter table experiences
  add column if not exists language text not null default 'en'
    check (language in ('en', 'ar', 'bilingual'));

alter table experiences
  add column if not exists title_ar text;

-- ---------------------------------------------------------------------------
-- participants: optional Arabic name, captured on the check-in form
-- ---------------------------------------------------------------------------

alter table participants
  add column if not exists first_name_ar text;

alter table participants
  add column if not exists last_name_ar text;

-- ---------------------------------------------------------------------------
-- survey_questions: optional Arabic translation per field
-- ---------------------------------------------------------------------------

alter table survey_questions
  add column if not exists question_text_ar text;

alter table survey_questions
  add column if not exists description_ar text;

alter table survey_questions
  add column if not exists options_ar jsonb;

alter table survey_questions
  add column if not exists low_label_ar text;

alter table survey_questions
  add column if not exists high_label_ar text;

-- ---------------------------------------------------------------------------
-- get_checkin_context: dropped + recreated (return shape changes — adds
-- title_ar) so the public check-in page can show the Arabic title when
-- Arabic is selected. Mirrors 0021.
-- ---------------------------------------------------------------------------

drop function if exists get_checkin_context(text);

create function get_checkin_context(p_slug text)
returns table (
  title text,
  title_ar text,
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
    select e.title, e.title_ar, e.experience_type, e.venue, e.start_date, e.end_date
    from experiences e
    where e.slug = p_slug
      and e.deleted_at is null;
end;
$$;

revoke all on function get_checkin_context(text) from public;
grant execute on function get_checkin_context(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_survey_context: dropped + recreated (return shape changes — adds
-- experience_title_ar, and the questions jsonb payload now carries each
-- question's five _ar fields). Mirrors 0017's two-arg signature exactly;
-- the only change is the added Arabic fields.
-- ---------------------------------------------------------------------------

drop function if exists get_survey_context(text, text);

create function get_survey_context(
  p_token text,
  p_survey_type text default 'satisfaction'
)
returns table (
  token_id uuid,
  participant_id uuid,
  experience_id uuid,
  participant_first_name text,
  experience_title text,
  experience_title_ar text,
  organization_name text,
  already_completed boolean,
  template_id uuid,
  questions jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token survey_tokens%rowtype;
  v_participant participants%rowtype;
  v_experience experiences%rowtype;
  v_template_id uuid;
  v_questions jsonb;
begin
  -- Resolve token
  select * into v_token
  from survey_tokens
  where token = p_token and survey_type = p_survey_type;

  if not found then return; end if;

  update survey_tokens
  set opened_at = now()
  where id = v_token.id and opened_at is null;

  select * into v_participant from participants where id = v_token.participant_id;
  select * into v_experience from experiences where id = v_token.workshop_id;

  -- Resolve template: experience override → org default for this type.
  -- See 0017 for why every column here is qualified with its table name.
  select experience_survey_templates.template_id into v_template_id
  from experience_survey_templates
  where experience_survey_templates.experience_id = v_token.workshop_id and survey_type = p_survey_type;

  if v_template_id is null then
    select id into v_template_id
    from survey_templates
    where workspace_id = (
      select workspace_id from workspaces
      join organizations o on o.id = workspaces.organization_id
      limit 1
    )
    and survey_type = p_survey_type
    and is_default = true
    limit 1;
  end if;

  -- Build questions JSON if template found
  if v_template_id is not null then
    select jsonb_agg(
      jsonb_build_object(
        'id', id,
        'order_index', order_index,
        'question_type', question_type,
        'question_text', question_text,
        'question_text_ar', question_text_ar,
        'description', description,
        'description_ar', description_ar,
        'is_required', is_required,
        'options', options,
        'options_ar', options_ar,
        'low_label', low_label,
        'low_label_ar', low_label_ar,
        'high_label', high_label,
        'high_label_ar', high_label_ar
      ) order by order_index
    ) into v_questions
    from survey_questions
    where survey_questions.template_id = v_template_id;
  end if;

  return query select
    v_token.id,
    v_token.participant_id,
    v_token.workshop_id,
    v_participant.first_name,
    v_experience.title,
    v_experience.title_ar,
    'Enable My Growth'::text,
    v_token.completed_at is not null,
    v_template_id,
    v_questions;
end;
$$;

revoke all on function get_survey_context(text, text) from public;
grant execute on function get_survey_context(text, text) to anon, authenticated;
