-- 0019_asset_inventory.sql
--
-- Sprint 21: asset inventory management — a catalog of physical assets
-- (unique items like games kits and cameras; consumable items like name
-- cards and USB sticks) that coordinators assign to experiences. Unique
-- assets are hard-blocked from double-booking via check_unique_asset_conflict;
-- consumable stock is deducted/restored explicitly in the Server Action on
-- assign/remove, not by a trigger, so the deduction stays auditable.
--
-- assets and experience_assets are exactly as given in the sprint brief.
-- asset_stock_adjustments is not given as SQL in the brief (only described
-- in prose: "add a simple asset_stock_adjustments table in the migration"
-- to back the Adjust Stock panel's +/- quantity + reason log) — designed
-- here to match this migration's own conventions: workspace-scoped,
-- authenticated-only RLS, an append-only audit log (no updated_at/trigger,
-- since adjustment records are never edited after creation).
--
-- Run manually via the Supabase SQL editor. Safe to re-run.

-- Asset catalog
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  name text not null,
  description text,
  asset_type text not null check (asset_type in ('unique', 'consumable')),
  category text,
  -- For unique assets
  serial_number text,
  location text,
  -- For consumable assets
  stock_quantity integer not null default 0,
  stock_unit text not null default 'units',
  reorder_threshold integer,
  reorder_quantity integer,
  -- Status
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Asset assignments to experiences
create table if not exists experience_assets (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references experiences(id) on delete cascade,
  asset_id uuid not null references assets(id),
  workspace_id uuid not null references workspaces(id),
  -- For consumable: how many units needed
  quantity_needed integer not null default 1,
  quantity_deducted integer not null default 0,
  -- Status
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'delivered', 'returned')),
  notes text,
  -- Audit
  assigned_by uuid references profiles(id),
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Stock adjustment log for consumable assets — backs the "Adjust Stock"
-- panel (+/- quantity, reason). Append-only: never updated or deleted, so
-- it doubles as the audit trail for every manual stock change.
create table if not exists asset_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id),
  workspace_id uuid not null references workspaces(id),
  quantity_change integer not null,
  reason text not null check (reason in ('received', 'damaged', 'lost', 'correction')),
  notes text,
  adjusted_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists assets_workspace_id_idx on assets(workspace_id);
create index if not exists assets_asset_type_idx on assets(asset_type);
create index if not exists experience_assets_experience_id_idx on experience_assets(experience_id);
create index if not exists experience_assets_asset_id_idx on experience_assets(asset_id);
create index if not exists asset_stock_adjustments_asset_id_idx on asset_stock_adjustments(asset_id);

alter table assets enable row level security;
alter table experience_assets enable row level security;
alter table asset_stock_adjustments enable row level security;

drop policy if exists "Authenticated users can manage assets" on assets;
create policy "Authenticated users can manage assets"
  on assets for all to authenticated using (true);

drop policy if exists "Authenticated users can manage experience assets" on experience_assets;
create policy "Authenticated users can manage experience assets"
  on experience_assets for all to authenticated using (true);

drop policy if exists "Authenticated users can manage asset stock adjustments" on asset_stock_adjustments;
create policy "Authenticated users can manage asset stock adjustments"
  on asset_stock_adjustments for all to authenticated using (true);

drop trigger if exists assets_updated_at on assets;
create trigger assets_updated_at
  before update on assets
  for each row execute function update_updated_at();

drop trigger if exists experience_assets_updated_at on experience_assets;
create trigger experience_assets_updated_at
  before update on experience_assets
  for each row execute function update_updated_at();

-- Conflict detection function for unique assets
create or replace function check_unique_asset_conflict(
  p_asset_id uuid,
  p_experience_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table(
  conflict_experience_id uuid,
  conflict_experience_title text,
  conflict_start_date timestamptz,
  conflict_end_date timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select
    e.id,
    e.title,
    e.start_date,
    e.end_date
  from experience_assets ea
  join experiences e on e.id = ea.experience_id
  where ea.asset_id = p_asset_id
    and ea.experience_id != p_experience_id
    and ea.status != 'returned'
    and e.deleted_at is null
    and e.status not in ('cancelled', 'completed')
    and (
      (e.start_date, e.end_date) overlaps (p_start_date, p_end_date)
    );
end;
$$;
