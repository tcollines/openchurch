-- ============================================================================
-- 007 · A church's own departments (Choir, Ushering, Media…) — new enum values
-- Run this file ON ITS OWN first, then run 008_custom_departments.sql.
-- Handles both type names: department_code/user_role (SQL schema) and
-- "DepartmentCode"/"UserRole" (Prisma db push).
-- ============================================================================

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['department_code', 'DepartmentCode'] LOOP
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = t AND typtype = 'e') THEN
            EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', t, 'CUSTOM');
        END IF;
    END LOOP;
    FOREACH t IN ARRAY ARRAY['user_role', 'UserRole'] LOOP
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = t AND typtype = 'e') THEN
            EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', t, 'DEPT_HOD');
            EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', t, 'DEPT_MEMBER');
        END IF;
    END LOOP;
END $$;
