-- 0004_workshop_status_cancelled.sql
--
-- The demo seed script (scripts/seed-demo.ts) needs a cancelled workshop,
-- but workshop_status (added in 0002) only has draft/active/completed.
--
-- Run manually via the Supabase SQL editor. Safe to re-run.

alter type workshop_status add value if not exists 'cancelled';
