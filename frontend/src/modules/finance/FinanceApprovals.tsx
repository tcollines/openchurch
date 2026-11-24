import React, { useState } from 'react';
import { Check, ChevronRight, ClipboardCheck, Coins, MessageCircle, Send, Smartphone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import { AccountabilityService, DepartmentService, FinanceService, readStore, requisitionAsk } from '@/services/churchService';
import { RequisitionStatus } from '@/shared/enums';
import { Requisition, RequisitionAccountability } from '@/shared/types';
import { formatDate } from '@/shared/formatters';
import { Badge, DarkCard, EmptyState, PageHeader } from '@/components/ui/kit';
import { MobileSheet, TextAreaInput } from '@/components/ui/FormControls';
import { ReceiptThumb } from '@/components/hod-more/RequisitionFlow';

const LABEL: Record<string, string> = {
  FINANCE: 'Finance',
  BACENTA: 'Bacentas',
  AIRPORT_STARS: 'Airport Stars',
  TELE_PASTORING: 'Tele Pastoring',
  CHILDRENS_CHURCH: 'Children’s Church',
  CAMPUSES: 'Campuses',
  ADMIN: 'Administration',
};
const n = (v: number) => Math.round(v).toLocaleString('en-US');
const sh = (v: number) => (v >= 1_000_000 ? `${Math.round(v / 10_000) / 100}M` : v >= 1_000 ? `${Math.round(v / 1_000)}K` : `${Math.round(v)}`);

const Line: React.FC<{ l: React.ReactNode; r: React.ReactNode; strong?: boolean; tone?: string }> = ({ l, r, strong, tone }) => (
  <div className="flex justify-between gap-3 py-2 border-t border-church-line text-sm">
    <span className={strong ? 'font-semibold text-church-text' : 'text-church-muted'}>{l}</span>
    <span className={`font-display tabular-nums whitespace-nowrap ${strong ? 'text-base font-bold' : 'font-semibold'} ${tone ?? ''}`}>{r}</span>
  </div>
);

/** Approved requisition: expand, choose Cash or Mobile Money, pay out. */
const PayCard: React.FC<{ r: Requisition; dept: string; open: boolean; onToggle: () => void; currency: string }> = ({ r, dept, open, onToggle, currency }) => {
  const { user, activeTenantId } = useAuth();
  const db = readStore();
  const requester = db.users.find((u) => u.id === r.requestedBy);
  const [method, setMethod] = useState<'Cash' | 'Mobile Money'>('Mobile Money');
  const [phone, setPhone] = useState(requester?.phoneNumber || '');
  const [ref, setRef] = useState('');
  const toPay = Math.max(0, requisitionAsk(r) - Number(r.amountPaid || 0));
  const give = Number(r.deptContributionAmount || 0);
  const pay = () => {
    if (!user || toPay <= 0) return;
    FinanceService.recordExpense({
      tenantId: activeTenantId,
      departmentId: r.departmentId,
      requisitionId: r.id,
      serviceId: r.serviceId,
      amount: toPay,
      paymentMethod: method,
      referenceCode: ref.trim() || undefined,
      description: `${r.requisitionNumber} · ${r.title}${method === 'Mobile Money' && phone ? ` · to ${phone}` : ''}`,
      transactionDate: new Date().toISOString().slice(0, 10),
      recordedBy: user.id,
    });
  };
  const head = (
    <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center justify-between gap-2.5 text-left">
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="oc-sub truncate">
          {dept} · {r.requisitionNumber} · approved
        </span>
        <span className="font-display text-[17px] font-semibold leading-snug">{r.title}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <span className="oc-num text-lg">{sh(toPay)}</span>
        <ChevronRight className={`w-[18px] h-[18px] text-church-faint transition ${open ? 'rotate-90' : ''}`} />
      </span>
    </button>
  );
  if (!open) return <section className="bg-white rounded-[20px] p-4">{head}</section>;
  return (
    <section className="bg-white rounded-[20px] p-4 flex flex-col gap-3.5 border-[1.5px] border-church-forest">
      {head}
      <div>
        {r.items.map((it, i) => (
          <Line key={i} l={`${it.quantity}× ${it.description}`} r={n(it.quantity * it.unitCost)} />
        ))}
        <Line l="Total" r={n(r.totalAmount)} />
        {give > 0 && <Line l={`${dept} contributes`} r={`− ${n(give)}`} tone="text-church-pos" />}
        {r.amountPaid > 0 && <Line l="Already paid" r={`− ${n(r.amountPaid)}`} />}
        <Line l="To pay out" r={`${currency} ${n(toPay)}`} strong />
      </div>
      <span className="oc-label">Pay with</span>
      <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2.5 -mt-1.5">
        {(['Cash', 'Mobile Money'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            onClick={() => setMethod(m)}
            className={`oc-press flex items-center gap-2.5 p-3.5 rounded-2xl border-[1.5px] text-[15px] font-bold text-left ${method === m ? 'border-church-forest bg-[#F1F9E6]' : 'border-[#E2E5DF] bg-white'}`}
          >
            {m === 'Cash' ? <Coins className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
            <span className="flex-1">{m}</span>
            {method === m && <Check className="w-[18px] h-[18px]" />}
          </button>
        ))}
      </div>
      {method === 'Mobile Money' && (
        <label className="flex flex-col gap-1.5">
          <span className="oc-label">Send to</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+256 7…" className="h-[52px] px-3.5 rounded-[14px] border-[1.5px] border-[#E2E5DF] bg-[#FAFBF8] text-base outline-none focus:border-church-forest" />
        </label>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="oc-label">{method === 'Cash' ? 'Receipt / voucher number (optional)' : 'Transaction reference'}</span>
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={method === 'Cash' ? 'e.g. PV-0142' : 'e.g. MM-77120'} className="h-[52px] px-3.5 rounded-[14px] border-[1.5px] border-[#E2E5DF] bg-[#FAFBF8] text-base outline-none focus:border-church-forest" />
      </label>
      {requester && (
        <span className="oc-sub -mt-1.5">
          Requested by {requester.fullName} · {dept}
        </span>
      )}
      <button type="button" onClick={pay} disabled={toPay <= 0} className="oc-btn-primary w-full">
        <Send className="w-5 h-5" /> Pay out {currency} {n(toPay)}
      </button>
    </section>
  );
};

/** Submitted accountability: items, receipts, accept or query. */
const AccountCard: React.FC<{ a: RequisitionAccountability; r?: Requisition; dept: string; open: boolean; onToggle: () => void; currency: string; onQuery: () => void }> = ({
  a,
  r,
  dept,
  open,
  onToggle,
  currency,
  onQuery,
}) => {
  const { user } = useAuth();
  const head = (
    <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center justify-between gap-2.5 text-left">
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="oc-sub truncate">
          {dept} · {r?.requisitionNumber ?? ''} · submitted {formatDate(a.submittedAt)}
        </span>
        <span className="font-display text-[17px] font-semibold leading-snug">{r?.title ?? 'Requisition'}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <Badge kind="warn">To check</Badge>
        <ChevronRight className={`w-[18px] h-[18px] text-church-faint transition ${open ? 'rotate-90' : ''}`} />
      </span>
    </button>
  );
  if (!open) return <section className="bg-white rounded-[20px] p-4">{head}</section>;
  return (
    <section className="bg-white rounded-[20px] p-4 flex flex-col gap-3.5 border-[1.5px] border-church-forest">
      {head}
      <div>
        {a.items.map((it, i) => (
          <Line key={i} l={`${it.quantity}× ${it.description}`} r={n(it.amount)} />
        ))}
      </div>
      <div className="rounded-2xl bg-[#F6F7F3] px-3.5 py-1 [&>*:first-child]:border-t-0">
        <Line l="Paid out" r={`${currency} ${n(a.amountReceived)}`} />
        {Number(r?.deptContributionAmount || 0) > 0 && <Line l={`${dept} gave`} r={`${currency} ${n(Number(r?.deptContributionAmount))}`} />}
        <Line l="Spent" r={`${currency} ${n(a.amountSpent)}`} />
        <Line l={a.balanceReturned > 0 ? `Balance returned · ${a.balanceMethod || 'cash'}` : 'Balance'} r={`${currency} ${n(a.balanceReturned)}`} strong tone="text-church-pos" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="oc-label">Receipts · tap to view</span>
        <div className="flex flex-wrap gap-2.5">
          {a.receiptPaths.map((p, i) => (
            <ReceiptThumb key={i} path={p} label={`Receipt ${i + 1}`} size={72} />
          ))}
          {!a.receiptPaths.length && <span className="oc-sub">No receipts attached.</span>}
        </div>
      </div>
      {a.notes && <p className="m-0 text-sm leading-[1.45] text-[#3E4741]">“{a.notes}”</p>}
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={onQuery} className="oc-btn !h-12 bg-church-canvas text-church-text">
          <MessageCircle className="w-[18px] h-[18px]" /> Query
        </button>
        <button type="button" onClick={() => user && AccountabilityService.review(a.id, 'ACCEPTED', '', user.id)} className="oc-btn-primary !h-12">
          <Check className="w-[18px] h-[18px]" /> Accept
        </button>
      </div>
    </section>
  );
};

export const FinanceApprovalsView: React.FC = () => {
  useChurchStoreRefresh();
  const { user, tenant, activeTenantId } = useAuth();
  const currency = tenant?.currency || 'UGX';
  const [tab, setTab] = useState<'reqs' | 'acc'>('reqs');
  const [openId, setOpenId] = useState<string | null>(null);
  const [querying, setQuerying] = useState<RequisitionAccountability | null>(null);
  const [queryNote, setQueryNote] = useState('');
  const depts = DepartmentService.getDepartments(activeTenantId);
  const deptName = (id: string) => {
    const d = depts.find((x) => x.id === id);
    return d ? LABEL[d.code] ?? d.name : 'Department';
  };
  const reqs = DepartmentService.getRequisitions(activeTenantId);
  const toPay = reqs.filter((r) => r.status === RequisitionStatus.APPROVED && requisitionAsk(r) - r.amountPaid > 0);
  const accs = AccountabilityService.getAll(activeTenantId);
  const toCheck = accs.filter((a) => a.status === 'SUBMITTED');
  const checked = accs.filter((a) => a.status !== 'SUBMITTED').slice(0, 12);
  const total = toPay.reduce((a, r) => a + requisitionAsk(r) - r.amountPaid, 0);
  const firstOpen = openId ?? (tab === 'reqs' ? toPay[0]?.id : toCheck[0]?.id) ?? null;

  const seg = (
    <div role="tablist" className="flex gap-1 p-1 rounded-[14px] bg-[#E8EAE4] max-w-[440px]">
      {(
        [
          ['reqs', 'Requisitions', toPay.length],
          ['acc', 'Accountabilities', toCheck.length],
        ] as const
      ).map(([k, l, c]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={tab === k}
          onClick={() => {
            setTab(k);
            setOpenId(null);
          }}
          className={`flex-1 h-10 rounded-[11px] flex items-center justify-center gap-1.5 text-sm font-semibold ${tab === k ? 'bg-white shadow-[0_1px_3px_rgba(15,36,24,0.12)] text-church-text' : 'text-church-muted'}`}
        >
          {l}
          <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold leading-5 text-center ${tab === k ? 'bg-church-lime text-church-forest' : 'bg-[#E2E5DF] text-church-forest'}`}>{c}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader title="Approvals" subtitle="Approved requisitions to pay out, and accountabilities to check." />
      {seg}
      {tab === 'reqs' ? (
        <>
          <DarkCard eyebrow="Approved by Administration" title={toPay.length ? `${toPay.length} requisition${toPay.length === 1 ? '' : 's'} · ${currency} ${n(total)} to pay` : 'Nothing to pay out'} />
          {toPay.length === 0 ? (
            <EmptyState icon={Check} title="All paid" sub="Requisitions appear here once Administration approves them." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 items-start">
              {toPay.map((r) => (
                <PayCard key={r.id} r={r} dept={deptName(r.departmentId)} currency={currency} open={firstOpen === r.id} onToggle={() => setOpenId(firstOpen === r.id ? '' : r.id)} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {toCheck.length === 0 ? (
            <EmptyState icon={ClipboardCheck} title="Nothing to check" sub="When a department accounts for a payout, it shows here with its receipts." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 items-start">
              {toCheck.map((a) => (
                <AccountCard
                  key={a.id}
                  a={a}
                  r={reqs.find((r) => r.id === a.requisitionId)}
                  dept={deptName(a.departmentId)}
                  currency={currency}
                  open={firstOpen === a.id}
                  onToggle={() => setOpenId(firstOpen === a.id ? '' : a.id)}
                  onQuery={() => {
                    setQueryNote('');
                    setQuerying(a);
                  }}
                />
              ))}
            </div>
          )}
          {checked.length > 0 && (
            <>
              <span className="oc-h2">Checked</span>
              <section className="bg-white rounded-[20px] px-4 py-1 max-w-[760px]">
                <div className="divide-y divide-church-line">
                  {checked.map((a) => {
                    const r = reqs.find((x) => x.id === a.requisitionId);
                    return (
                      <div key={a.id} className="flex items-center gap-3 min-h-[64px] py-2.5">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.status === 'ACCEPTED' ? 'bg-[#DDF1E4] text-[#0E5A37]' : 'bg-church-warnSoft text-[#7A4300]'}`}>
                          <ClipboardCheck className="w-5 h-5" />
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <span className="text-[15px] font-semibold truncate">
                            {r?.requisitionNumber} · {r?.title}
                          </span>
                          <span className="oc-sub truncate">
                            {deptName(a.departmentId)} · spent {n(a.amountSpent)} of {n(a.amountReceived)}
                          </span>
                        </span>
                        <Badge kind={a.status === 'ACCEPTED' ? 'ok' : 'warn'}>{a.status === 'ACCEPTED' ? 'Accepted' : 'Queried'}</Badge>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </>
      )}

      <MobileSheet open={Boolean(querying)} onClose={() => setQuerying(null)} title="Query this accountability" subtitle="The department will see your question, fix it and resubmit.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!querying || !user || queryNote.trim().length < 5) return;
            AccountabilityService.review(querying.id, 'QUERIED', queryNote, user.id);
            setQuerying(null);
          }}
          className="flex flex-col gap-4"
        >
          <TextAreaInput label="What needs fixing?" value={queryNote} onChange={setQueryNote} placeholder="e.g. The router receipt is missing. Please attach it." required />
          <button type="submit" className="oc-btn-dark w-full">
            <MessageCircle className="w-5 h-5 text-church-lime" /> Send query
          </button>
        </form>
      </MobileSheet>
    </>
  );
};
