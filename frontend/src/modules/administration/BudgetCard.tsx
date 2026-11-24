import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { DepartmentService, requisitionAsk } from '@/services/churchService';
import { RequisitionStatus, WorkflowStatus } from '@/shared/enums';
import { Card, Stats } from '@/components/ui/kit';

const LABEL: Record<string, string> = {
  FINANCE: 'Finance',
  BACENTA: 'Bacentas',
  AIRPORT_STARS: 'Airport Stars',
  TELE_PASTORING: 'Tele Pastoring',
  CHILDRENS_CHURCH: 'Children’s Church',
  CAMPUSES: 'Campuses',
  ADMIN: 'Administration',
};
const sh = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 10_000) / 100}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${Math.round(n)}`);

/** Approved workplans make each ministry's budget for the month; approved requisitions are spent against it. */
export const BudgetCard: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const navigate = useNavigate();
  const month = new Date().toISOString().slice(0, 7);
  const monthName = new Date().toLocaleDateString('en-GB', { month: 'long' });
  const depts = DepartmentService.getDepartments(tenantId);
  const wps = DepartmentService.getWorkplans(tenantId).filter((w) => w.status === WorkflowStatus.APPROVED && w.monthLabel.startsWith(month));
  const reqs = DepartmentService.getRequisitions(tenantId).filter(
    (r) => (r.status === RequisitionStatus.APPROVED || r.status === RequisitionStatus.PAID) && (r.requestedAt || r.createdAt).startsWith(month)
  );
  const rows = depts
    .map((d) => ({
      id: d.id,
      label: LABEL[d.code] ?? d.name,
      budget: wps.filter((w) => w.departmentId === d.id).reduce((a, w) => a + Number(w.totalApproved || 0), 0),
      requested: reqs.filter((r) => r.departmentId === d.id).reduce((a, r) => a + requisitionAsk(r), 0),
    }))
    .filter((r) => r.budget > 0 || r.requested > 0)
    .sort((a, b) => b.budget - a.budget);
  const budget = rows.reduce((a, r) => a + r.budget, 0);
  const requested = reqs.reduce((a, r) => a + requisitionAsk(r), 0);
  const paid = reqs.reduce((a, r) => a + Number(r.amountPaid || 0), 0);
  const pct = budget ? Math.round((requested / budget) * 100) : 0;
  const w = (n: number) => `${budget ? Math.min(100, (n / budget) * 100) : 0}%`;
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <span className="oc-h2">Budget vs requested</span>
        <button type="button" onClick={() => navigate('/admin/approvals')} className="text-sm font-semibold text-[#2F6B0A] flex items-center gap-0.5">
          Workplans <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {budget === 0 && requested === 0 ? (
        <p className="m-0 oc-sub">No approved workplans for {monthName} yet. Approved workplans become each ministry’s budget.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 -mt-1">
            <span className="oc-num text-[24px]">{budget ? `${pct}%` : '—'}</span>
            <span className="oc-sub !text-sm">of {monthName}’s budget requested</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div role="img" aria-label={`${pct} percent of the budget requested`} className="h-3 rounded-md bg-church-line overflow-hidden flex">
              <div className="bg-church-forest" style={{ width: w(paid) }} />
              <div className="bg-church-lime" style={{ width: w(Math.max(0, requested - paid)) }} />
            </div>
            <span className="flex flex-wrap gap-3.5 text-xs text-church-muted">
              <span className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-[3px] bg-church-forest" /> Paid out
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-[3px] bg-church-lime" /> Approved, not paid
              </span>
              <span className="flex items-center gap-1.5">
                <i className="w-2.5 h-2.5 rounded-[3px] bg-church-line" /> Left
              </span>
            </span>
          </div>
          <Stats
            items={[
              { label: 'Budgeted', value: sh(budget) },
              { label: 'Requested', value: sh(requested), color: '#A15C00' },
              { label: 'Left', value: sh(Math.max(0, budget - requested)), color: '#116B43' },
            ]}
          />
          <div className="flex flex-col gap-3 pt-3 border-t border-church-line">
            {rows.map((r) => {
              const p = r.budget ? Math.round((r.requested / r.budget) * 100) : 100;
              return (
                <div key={r.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="font-semibold">{r.label}</span>
                    <span className="font-display text-[13px] font-semibold text-church-muted tabular-nums">
                      {r.budget ? `${sh(r.requested)} of ${sh(r.budget)}` : `${sh(r.requested)} · no workplan`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded bg-church-line">
                    <div className={`h-1.5 rounded ${p > 85 ? 'bg-[#A15C00]' : 'bg-church-forest'}`} style={{ width: `${Math.min(100, p)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
};
