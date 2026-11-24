-- ============================================================================
-- 005 · Discipleship department — new enum values
-- Run this file ON ITS OWN first (Postgres must commit new enum values before
-- they can be used), then run 006_discipleship.sql.
-- Handles both type names: department_code/user_role (SQL schema) and
-- "DepartmentCode"/"UserRole" (Prisma db push).
-- ============================================================================

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['department_code', 'DepartmentCode'] LOOP
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = t AND typtype = 'e') THEN
            EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', t, 'DISCIPLESHIP');
        END IF;
    END LOOP;
    FOREACH t IN ARRAY ARRAY['user_role', 'UserRole'] LOOP
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = t AND typtype = 'e') THEN
            EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', t, 'DISCIPLESHIP_HOD');
            EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', t, 'DISCIPLESHIP_MEMBER');
        END IF;
    END LOOP;
END $$;
