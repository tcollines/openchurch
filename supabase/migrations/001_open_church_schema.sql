-- ============================================================================
-- OPEN CHURCH — MULTI-TENANT CHURCH MANAGEMENT SYSTEM
-- PostgreSQL / Supabase Complete Schema, RLS Isolation, Triggers & RPCs
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── 1. ENUMS ────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE department_code AS ENUM (
        'ADMIN',
        'FINANCE',
        'BACENTA',
        'AIRPORT_STARS',
        'TELE_PASTORING',
        'CHILDRENS_CHURCH',
        'CAMPUSES'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'PLATFORM_ADMIN',
        'ADMIN',
        'FINANCE_HOD',
        'FINANCE_OFFICER',
        'BACENTA_HOD',
        'BACENTA_LEADER',
        'AIRPORT_HOD',
        'AIRPORT_MEMBER',
        'TELE_HOD',
        'TELE_PASTOR',
        'CHILDREN_HOD',
        'CHILDREN_WORKER',
        'CAMPUS_HOD',
        'CAMPUS_LEADER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE service_category AS ENUM ('SUNDAY', 'MIDWEEK', 'SPECIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE service_status AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE finance_type AS ENUM ('INCOME', 'EXPENSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE finance_category AS ENUM (
        'OFFERTORY',
        'TITHE',
        'PARTNERSHIP',
        'DEPT_CONTRIBUTION',
        'REQUISITION_PAYOUT',
        'TELE_REACHOUT_EXPENSE',
        'OTHER_EXPENSE'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE finance_scope AS ENUM (
        'SERVICE',
        'BACENTA_MEETING',
        'CAMPUS_MEETING',
        'DEPARTMENT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE workflow_status AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE requisition_status AS ENUM ('DRAFT', 'PENDING_ADMIN', 'APPROVED', 'PAID', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE fellowship_unit_type AS ENUM ('BACENTA', 'CAMPUS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE reachout_mode AS ENUM ('PHYSICAL_VISIT', 'PHONE_CALL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE absentee_status AS ENUM ('PENDING', 'CONTACTED', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE soul_source_type AS ENUM (
        'SERVICE',
        'BACENTA_OUTREACH',
        'BACENTA_MEETING',
        'CAMPUS_OUTREACH',
        'CAMPUS_MEETING',
        'CHILDRENS_CHURCH'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE soul_status AS ENUM (
        'NEW',
        'WEEK_1',
        'WEEK_2',
        'WEEK_3',
        'WEEK_4',
        'INTEGRATED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. TENANTS & DEPARTMENTS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT DEFAULT '/logo.jpg',
    currency TEXT NOT NULL DEFAULT 'UGX',
    city TEXT,
    country TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code department_code NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, code)
);

-- Automatically provision the 7 Core Departments whenever a new Church Tenant is created
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
        (NEW.id, 'CAMPUSES', 'Campuses Ministry', 'University & school campus fellowships, outreach reports, attendance & offerings');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_tenant_departments ON public.tenants;
CREATE TRIGGER trg_seed_tenant_departments
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.fn_seed_tenant_departments();

-- ─── 3. FELLOWSHIP UNITS (BACENTAS & CAMPUSES) & USERS ───────────────────────

CREATE TABLE IF NOT EXISTS public.fellowship_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_type fellowship_unit_type NOT NULL,
    name TEXT NOT NULL,
    location_or_institution TEXT NOT NULL,
    meeting_day TEXT DEFAULT 'Wednesday',
    leader_name TEXT,
    leader_phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    role user_role NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    fellowship_unit_id UUID REFERENCES public.fellowship_units(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fellowship_units
    ADD COLUMN IF NOT EXISTS leader_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- ─── 4. MEMBERS, CHILDREN & SERVING MEMBERS ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    gender TEXT CHECK (gender IN ('Male', 'Female')),
    residence TEXT,
    bacenta_id UUID REFERENCES public.fellowship_units(id) ON DELETE SET NULL,
    campus_id UUID REFERENCES public.fellowship_units(id) ON DELETE SET NULL,
    is_first_timer BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_tenant_search ON public.members(tenant_id, full_name, phone_number);

CREATE TABLE IF NOT EXISTS public.children (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 0 AND age <= 18),
    age_group TEXT,
    guardian_name TEXT NOT NULL,
    guardian_phone TEXT NOT NULL,
    parent_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.serving_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    serving_role TEXT NOT NULL DEFAULT 'Member', -- 'HOD' | 'Coordinator' | 'Member'
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    joined_dept_at DATE NOT NULL DEFAULT CURRENT_DATE,
    UNIQUE (department_id, member_id)
);

-- ─── 5. SERVICES & ATTENDANCE (ADULT, SERVING DEPT, CHILDREN) ────────────────

CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    service_date DATE NOT NULL,
    category service_category NOT NULL DEFAULT 'SUNDAY',
    status service_status NOT NULL DEFAULT 'OPEN',
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_tenant_date ON public.services(tenant_id, service_date DESC);

CREATE TABLE IF NOT EXISTS public.service_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    is_first_time_visit BOOLEAN NOT NULL DEFAULT FALSE,
    is_serving_checkin BOOLEAN NOT NULL DEFAULT FALSE,
    serving_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checked_in_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    UNIQUE (service_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.child_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checked_out_at TIMESTAMPTZ,
    soul_won BOOLEAN NOT NULL DEFAULT FALSE,
    checked_in_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    UNIQUE (service_id, child_id)
);

-- ─── 6. PARTNERS, DEPT CONTRIBUTIONS & UNIFIED FINANCE LEDGER ────────────────

CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    email TEXT,
    tier_or_pledge TEXT DEFAULT 'Kingdom Partner',
    monthly_pledge NUMERIC(14,2) DEFAULT 0,
    frequency TEXT DEFAULT 'Monthly',
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dept_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    purpose TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    reference_code TEXT,
    contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workplans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    month_label TEXT NOT NULL, -- e.g. '2026-11'
    title TEXT NOT NULL,
    total_requested NUMERIC(14,2) NOT NULL DEFAULT 0,
    dept_contribution_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_approved NUMERIC(14,2) NOT NULL DEFAULT 0,
    status workflow_status NOT NULL DEFAULT 'DRAFT',
    review_notes TEXT,
    submitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workplan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workplan_id UUID NOT NULL REFERENCES public.workplans(id) ON DELETE CASCADE,
    activity TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_cost NUMERIC(14,2) NOT NULL CHECK (unit_cost >= 0),
    total_cost NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED
);

CREATE TABLE IF NOT EXISTS public.requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    workplan_id UUID REFERENCES public.workplans(id) ON DELETE SET NULL,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    requisition_number TEXT NOT NULL,
    title TEXT NOT NULL,
    items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
    amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
    status requisition_status NOT NULL DEFAULT 'PENDING_ADMIN',
    rejection_reason TEXT,
    requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    requested_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    type finance_type NOT NULL,
    category finance_category NOT NULL,
    source_scope finance_scope NOT NULL DEFAULT 'SERVICE',
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    partner_id UUID REFERENCES public.partners(id) ON DELETE RESTRICT,
    member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
    fellowship_unit_id UUID REFERENCES public.fellowship_units(id) ON DELETE SET NULL,
    requisition_id UUID REFERENCES public.requisitions(id) ON DELETE SET NULL,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    reference_code TEXT,
    description TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_partnership_requires_partner CHECK (
        category <> 'PARTNERSHIP' OR partner_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_finance_tenant_service ON public.finance_transactions(tenant_id, service_id, type);

-- ─── 7. BACENTA & CAMPUS MEETINGS & OUTREACHES ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.fellowship_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.fellowship_units(id) ON DELETE CASCADE,
    meeting_date DATE NOT NULL,
    title TEXT NOT NULL,
    labourers_count INTEGER NOT NULL DEFAULT 1,
    souls_won_count INTEGER NOT NULL DEFAULT 0,
    testimony TEXT,
    tithe_collected NUMERIC(14,2) NOT NULL DEFAULT 0,
    offertory_collected NUMERIC(14,2) NOT NULL DEFAULT 0,
    submitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fellowship_meeting_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    meeting_id UUID NOT NULL REFERENCES public.fellowship_meetings(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (meeting_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.fellowship_outreaches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES public.fellowship_units(id) ON DELETE CASCADE,
    outreach_date DATE NOT NULL,
    location TEXT,
    labourers_count INTEGER NOT NULL CHECK (labourers_count >= 1),
    souls_won_count INTEGER NOT NULL DEFAULT 0 CHECK (souls_won_count >= 0),
    testimony TEXT NOT NULL,
    submitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 8. TELE PASTORING, 3-MISS ABSENTEES & 4-WEEK SOULS PIPELINE ─────────────

CREATE TABLE IF NOT EXISTS public.tele_reachouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    mode reachout_mode NOT NULL,
    labourers_count INTEGER,
    amount_spent NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_spent >= 0),
    comment TEXT NOT NULL,
    finance_transaction_id UUID REFERENCES public.finance_transactions(id) ON DELETE SET NULL,
    reached_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reachout_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_physical_requires_labourers CHECK (
        mode <> 'PHYSICAL_VISIT' OR (labourers_count IS NOT NULL AND labourers_count >= 1)
    )
);

CREATE TABLE IF NOT EXISTS public.absentee_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    person_type TEXT NOT NULL CHECK (person_type IN ('ADULT', 'CHILD')),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
    missed_services_count INTEGER NOT NULL DEFAULT 3,
    status absentee_status NOT NULL DEFAULT 'CONTACTED',
    comment TEXT NOT NULL,
    followed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.souls_won (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    is_child BOOLEAN NOT NULL DEFAULT FALSE,
    source_type soul_source_type NOT NULL,
    source_label TEXT,
    service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    fellowship_unit_id UUID REFERENCES public.fellowship_units(id) ON DELETE SET NULL,
    won_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status soul_status NOT NULL DEFAULT 'NEW',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.soul_followup_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    soul_id UUID NOT NULL REFERENCES public.souls_won(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 4),
    contact_mode reachout_mode NOT NULL DEFAULT 'PHONE_CALL',
    attended_service BOOLEAN NOT NULL DEFAULT FALSE,
    comment TEXT NOT NULL,
    completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (soul_id, week_number)
);

-- ─── 9. ROW-LEVEL SECURITY (RLS) HELPERS & POLICIES ──────────────────────────

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'PLATFORM_ADMIN', FALSE);
$$;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'departments', 'fellowship_units', 'users', 'members', 'children',
        'serving_members', 'services', 'service_attendance', 'child_attendance',
        'partners', 'dept_contributions', 'workplans', 'requisitions',
        'finance_transactions', 'fellowship_meetings', 'fellowship_meeting_attendance',
        'fellowship_outreaches', 'tele_reachouts', 'absentee_followups',
        'souls_won', 'soul_followup_weeks'
    ]
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I;', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON public.%I FOR ALL USING (public.is_platform_admin() OR tenant_id = public.current_tenant_id()) WITH CHECK (public.is_platform_admin() OR tenant_id = public.current_tenant_id());',
            tbl
        );
    END LOOP;
END $$;

-- ─── 10. ANALYTICS & RETENTION RPCs ──────────────────────────────────────────

-- Administration: Attendance Percentage Graph per Service
CREATE OR REPLACE FUNCTION public.rpc_get_attendance_percentage_trend(
    p_tenant_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    service_id UUID,
    service_title TEXT,
    service_date DATE,
    category service_category,
    checked_in_count BIGINT,
    eligible_members_count BIGINT,
    attendance_percentage NUMERIC(5,1)
)
LANGUAGE sql
STABLE
AS $$
    WITH recent_services AS (
        SELECT s.id, s.title, s.service_date, s.category
        FROM public.services s
        WHERE s.tenant_id = p_tenant_id
        ORDER BY s.service_date DESC
        LIMIT p_limit
    )
    SELECT
        rs.id AS service_id,
        rs.title AS service_title,
        rs.service_date,
        rs.category,
        (SELECT COUNT(*) FROM public.service_attendance sa WHERE sa.service_id = rs.id) AS checked_in_count,
        GREATEST(
            (SELECT COUNT(*) FROM public.members m WHERE m.tenant_id = p_tenant_id AND m.is_active = TRUE AND m.joined_at <= rs.service_date),
            1
        ) AS eligible_members_count,
        ROUND(
            ((SELECT COUNT(*) FROM public.service_attendance sa WHERE sa.service_id = rs.id)::numeric /
            GREATEST((SELECT COUNT(*) FROM public.members m WHERE m.tenant_id = p_tenant_id AND m.is_active = TRUE AND m.joined_at <= rs.service_date), 1)::numeric) * 100,
            1
        ) AS attendance_percentage
    FROM recent_services rs
    ORDER BY rs.service_date ASC;
$$;

-- Tele Pastoring & Children's Church: Members or Children who missed the last 3 consecutive services
CREATE OR REPLACE FUNCTION public.rpc_get_three_service_absentees(
    p_tenant_id UUID,
    p_person_type TEXT DEFAULT 'ADULT'
)
RETURNS TABLE (
    person_id UUID,
    full_name TEXT,
    phone_number TEXT,
    secondary_info TEXT,
    missed_count INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_last_three_service_ids UUID[];
    v_earliest_date DATE;
BEGIN
    SELECT ARRAY_AGG(id), MIN(service_date)
    INTO v_last_three_service_ids, v_earliest_date
    FROM (
        SELECT id, service_date
        FROM public.services
        WHERE tenant_id = p_tenant_id
        ORDER BY service_date DESC
        LIMIT 3
    ) sub;

    IF v_last_three_service_ids IS NULL OR array_length(v_last_three_service_ids, 1) < 3 THEN
        RETURN;
    END IF;

    IF p_person_type = 'CHILD' THEN
        RETURN QUERY
        SELECT
            c.id,
            c.full_name,
            c.guardian_phone,
            c.guardian_name,
            3
        FROM public.children c
        WHERE c.tenant_id = p_tenant_id
          AND c.is_active = TRUE
          AND c.joined_at <= v_earliest_date
          AND NOT EXISTS (
              SELECT 1 FROM public.child_attendance ca
              WHERE ca.child_id = c.id
                AND ca.service_id = ANY(v_last_three_service_ids)
          );
    ELSE
        RETURN QUERY
        SELECT
            m.id,
            m.full_name,
            m.phone_number,
            COALESCE(m.residence, 'General'),
            3
        FROM public.members m
        WHERE m.tenant_id = p_tenant_id
          AND m.is_active = TRUE
          AND m.joined_at <= v_earliest_date
          AND NOT EXISTS (
              SELECT 1 FROM public.service_attendance sa
              WHERE sa.member_id = m.id
                AND sa.service_id = ANY(v_last_three_service_ids)
          );
    END IF;
END;
$$;

