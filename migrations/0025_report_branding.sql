-- Sprint 29: branded PDF satisfaction reports for client delivery.
-- Report branding settings per workspace.
create table report_branding (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) unique,
  -- Organization identity
  organization_name text not null default 'Enable My Growth',
  organization_tagline text,
  logo_path text, -- Supabase Storage path
  -- Colors (hex)
  primary_color text not null default '#26215C',
  secondary_color text not null default '#C9A96E',
  accent_color text not null default '#EDEAE3',
  -- Report footer
  footer_text text,
  website text,
  contact_email text,
  -- Meta
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table report_branding enable row level security;
drop policy if exists "Authenticated users can manage report branding" on report_branding;
create policy "Authenticated users can manage report branding"
  on report_branding for all to authenticated using (true);

create trigger report_branding_updated_at
  before update on report_branding
  for each row execute function update_updated_at();

-- Seed default branding for Enable My Growth workspace
insert into report_branding (workspace_id, organization_name, organization_tagline, primary_color, secondary_color, footer_text, website)
select w.id, 'Enable My Growth', 'Perspective changes what becomes possible.',
  '#26215C', '#C9A96E',
  'This report was prepared by Enable My Growth. Confidential — for client use only.',
  'enablemygrowth.com'
from workspaces w
join organizations o on o.id = w.organization_id
where o.slug = 'enable-my-growth'
limit 1;
