-- ============================================================================
-- 008 · A church's own departments — columns, uniqueness, seeding trigger
-- Run AFTER 007_custom_departments_enums.sql. Safe to run more than once.
-- ============================================================================

-- 1. Custom departments get a slug (unique per church) and the look Administration picks.
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS slug  TEXT NOT NULL DEFAULT '';
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS icon  TEXT;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS color TEXT;

-- 2. One of each core department per church (slug ''), many custom ones (each its own slug).
ALTER TABLE public.departments DROP CONSTRAINT IF EXISTS departments_tenant_id_code_key;
DROP INDEX IF EXISTS public.departments_tenant_id_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS departments_tenant_id_code_slug_key ON public.departments (tenant_id, code, slug);

-- 3. New churches still get the core departments (conflicts on the new key are skipped).
CREATE OR REPLACE FUNCTION public.fn_seed_tenant_departments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.departments (tenant_id, code, name, description)
    VALUES
        (NEW.id, 'ADMIN', 'Administration', 'Overall church oversight, attendance analytics, budgets, finance & serving members'),
        (NEW.id, 'FINANCE', 'Finance Department', 'Per-service Offertory, Tithe, Partner-linked Partnership, remittances & payouts'),
        (NEW.id, 'BACENTA', 'Bacenta Ministry', 'Micro-church home fellowships, outreach reports, member attendance & meeting offerings'),
        (NEW.id, 'AIRPORT_STARS', 'Airport Stars', 'Service creation, rapid member check-in & first-timer registration'),
        (NEW.id, 'TELE_PASTORING', 'Tele Pastoring', '3-missed-services retention, physical/phone pastoral reachouts & 4-week soul follow-up'),
        (NEW.id, 'CHILDRENS_CHURCH', 'Children''s Church', 'Service-linked child check-in, child salvations & 3-missed-services guardian follow-up'),
        (NEW.id, 'CAMPUSES', 'Campuses Ministry', 'University & school campus fellowships, outreach reports, attendance & offerings'),
        (NEW.id, 'DISCIPLESHIP', 'Discipleship', 'Discipleship classes, member check-in and progress from enrolled to completed')
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;
