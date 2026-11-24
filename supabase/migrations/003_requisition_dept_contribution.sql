-- Requisitions record how much the department itself contributes towards the cost.
-- Finance pays out the rest (total_amount - dept_contribution_amount).
-- Run this in Supabase (SQL editor) BEFORE deploying the new backend.
ALTER TABLE requisitions
  ADD COLUMN IF NOT EXISTS dept_contribution_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
