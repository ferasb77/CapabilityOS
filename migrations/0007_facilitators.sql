-- 0007_facilitators.sql
--
-- Facilitator directory: rich profiles browsed/searched/filtered from
-- /dashboard/facilitators, with delivery history computed live by joining
-- facilitators.email to workshops.facilitator_email (no FK between them —
-- workshops.facilitator_email is a free-text field from the Sprint 5
-- creation form, matched case-insensitively in application code).
--
-- Run manually via the Supabase SQL editor. Safe to re-run.

create table if not exists facilitators (
  id uuid primary key default gen_random_uuid(),
  -- Identity
  first_name text not null,
  last_name text not null,
  email text not null unique,
  phone text,
  photo_url text,
  -- Professional
  bio text,
  title text,
  organization text,
  years_experience integer,
  -- Expertise
  expertise_areas text[] not null default '{}',
  certifications text[] not null default '{}',
  languages text[] not null default '{}',
  -- Delivery
  regions text[] not null default '{}',
  willing_to_travel boolean not null default true,
  travel_notes text,
  -- Documents
  passport_expiry date,
  visa_countries text[] not null default '{}',
  -- Availability
  availability_status text not null default 'available'
    check (availability_status in ('available', 'partially_available', 'unavailable')),
  availability_notes text,
  -- Status
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists facilitators_email_idx on facilitators (email);
create index if not exists facilitators_availability_status_idx on facilitators (availability_status);
create index if not exists facilitators_is_active_idx on facilitators (is_active);

alter table facilitators enable row level security;

drop policy if exists "Authenticated users can manage facilitators" on facilitators;
create policy "Authenticated users can manage facilitators"
  on facilitators for all
  to authenticated
  using (true)
  with check (true);

-- Reuses update_updated_at() from migration 0005.
drop trigger if exists facilitators_updated_at on facilitators;
create trigger facilitators_updated_at
  before update on facilitators
  for each row execute function update_updated_at();
