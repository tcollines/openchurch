-- ============================================================================
-- 006 · Discipleship department — tables, department rows, RLS
-- Run AFTER 005_discipleship_enums.sql. Safe to run more than once.
-- ============================================================================

-- 1. Every church gets the Discipleship department (existing and new churches)
INSERT INTO public.departments (id, tenant_id, code, name, description)
SELECT gen_random_uuid(), t.id, 'DISCIPLESHIP', 'Discipleship',
       'Discipleship classes, member check-in and progress from enrolled to completed'
FROM public.tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM public.departments d WHERE d.tenant_id = t.id AND d.code::text = 'DISCIPLESHIP'
);

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
    ON CONFLICT (tenant_id, code) DO NOTHING;
    RETURN NEW;
END;
$$;

-- 2. Classes (Discipleship only — never part of service check-in)
CREATE TABLE IF NOT EXISTS public.discipleship_classes (
    id                UUID PRIMARY KEY,
    tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
    department_id     UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE ON UPDATE CASCADE,
    name              TEXT NOT NULL,
    class_date        TEXT NOT NULL,                 -- YYYY-MM-DD
    start_time        TEXT NOT NULL DEFAULT '18:00', -- HH:MM
    trainer_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL ON UPDATE CASCADE,
    trainer_name      TEXT NOT NULL DEFAULT '',
    created_by        UUID,
    created_at        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS discipleship_classes_tenant_id_class_date_idx ON public.discipleship_classes (tenant_id, class_date);

-- 3. Enrollments (status ACTIVE | WITHDRAWN; progress comes from attendance)
CREATE TABLE IF NOT EXISTS public.discipleship_enrollments (
    id          UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
    member_id   UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE ON UPDATE CASCADE,
    status      TEXT NOT NULL DEFAULT 'ACTIVE',
    enrolled_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enrolled_by UUID
);
CREATE UNIQUE INDEX IF NOT EXISTS discipleship_enrollments_tenant_id_member_id_key ON public.discipleship_enrollments (tenant_id, member_id);

-- 4. Class attendance (is_team = trainer / helper on duty)
CREATE TABLE IF NOT EXISTS public.discipleship_attendance (
    id            UUID PRIMARY KEY,
    tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
    class_id      UUID NOT NULL REFERENCES public.discipleship_classes(id) ON DELETE CASCADE ON UPDATE CASCADE,
    member_id     UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE ON UPDATE CASCADE,
    is_team       BOOLEAN NOT NULL DEFAULT FALSE,
    checked_in_by UUID,
    checked_in_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS discipleship_attendance_class_id_member_id_key ON public.discipleship_attendance (class_id, member_id);
CREATE INDEX IF NOT EXISTS discipleship_attendance_tenant_id_member_id_idx ON public.discipleship_attendance (tenant_id, member_id);

-- 5. Settings (how many classes complete the track)
CREATE TABLE IF NOT EXISTS public.discipleship_settings (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
    classes_to_complete INTEGER NOT NULL DEFAULT 6,
    updated_at          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS discipleship_settings_tenant_id_key ON public.discipleship_settings (tenant_id);

-- 6. Row-level security: each church sees only its own rows
DO $$
DECLARE tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY['discipleship_classes', 'discipleship_enrollments', 'discipleship_attendance', 'discipleship_settings'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I;', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON public.%I FOR ALL USING (public.is_platform_admin() OR tenant_id = public.current_tenant_id()) WITH CHECK (public.is_platform_admin() OR tenant_id = public.current_tenant_id());',
            tbl
        );
    END LOOP;
END $$;
