-- Requisition accountability: what a department bought with a payout, plus receipt photos.
-- Receipt files live in the private Supabase Storage bucket "receipts" (the backend creates it
-- automatically on the first upload; it needs SUPABASE_SERVICE_ROLE_KEY).
-- Run this in Supabase (SQL editor) BEFORE deploying the new backend.

CREATE TABLE IF NOT EXISTS public.requisition_accountabilities (
    id               UUID PRIMARY KEY,
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
    requisition_id   UUID NOT NULL REFERENCES public.requisitions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    department_id    UUID NOT NULL,
    items_json       JSONB NOT NULL DEFAULT '[]',
    amount_received  DOUBLE PRECISION NOT NULL DEFAULT 0,
    amount_spent     DOUBLE PRECISION NOT NULL DEFAULT 0,
    balance_returned DOUBLE PRECISION NOT NULL DEFAULT 0,
    balance_method   TEXT NOT NULL DEFAULT '',
    receipt_paths    JSONB NOT NULL DEFAULT '[]',
    notes            TEXT NOT NULL DEFAULT '',
    status           TEXT NOT NULL DEFAULT 'SUBMITTED',  -- SUBMITTED | ACCEPTED | QUERIED
    review_note      TEXT NOT NULL DEFAULT '',
    submitted_by     UUID,
    submitted_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by      UUID,
    reviewed_at      TIMESTAMP(3),
    created_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS requisition_accountabilities_requisition_id_key
    ON public.requisition_accountabilities (requisition_id);
CREATE INDEX IF NOT EXISTS requisition_accountabilities_tenant_id_department_id_idx
    ON public.requisition_accountabilities (tenant_id, department_id);

-- Same church-isolation rule as every other table.
ALTER TABLE public.requisition_accountabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON public.requisition_accountabilities;
CREATE POLICY tenant_isolation_policy ON public.requisition_accountabilities FOR ALL
    USING (public.is_platform_admin() OR tenant_id = public.current_tenant_id())
    WITH CHECK (public.is_platform_admin() OR tenant_id = public.current_tenant_id());
