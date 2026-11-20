-- Open Church · church profile + Get started setup
-- Run once in Supabase → SQL Editor (or run `npm run db:push` in /backend).
-- Safe to run more than once.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS short_name         TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address            TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone              TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email              TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone           TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS launch_date        TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMP(3);
