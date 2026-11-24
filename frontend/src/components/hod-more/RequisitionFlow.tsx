import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, ClipboardCheck, FileText, Lock, MessageCircle, Plus, Receipt, X } from 'lucide-react';
import { AccountabilityService, ReceiptService } from '@/services/churchService';
import { Requisition, RequisitionAccountability } from '@/shared/types';
import { formatDate } from '@/shared/formatters';
import { Badge, DarkCard } from '@/components/ui/kit';
import { MobileSheet, SelectInput, TextAreaInput } from '@/components/ui/FormControls';

const fmt = (n: number, cur: string) => `${cur} ${Math.round(n).toLocaleString('en-US')}`;

/* ── Receipt thumbnail (fetches a short-lived link for stored receipts) ── */
export const ReceiptThumb: React.FC<{ path: string; label: string; size?: number; onRemove?: () => void }> = ({ path, label, size = 84, onRemove }) => {
  const [url, setUrl] = useState<string>(path.startsWith('data:') ? path : '');
  const isPdf = /\.pdf($|\?)/i.test(path) || path.startsWith('data:application/pdf');
  useEffect(() => {
    let live = true;
    if (!url && !isPdf) ReceiptService.viewUrl(path).then((u) => live && setUrl(u)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [path, url, isPdf]);
  const open = async () => {
    try {
      const u = url || (await ReceiptService.viewUrl(path));
      // Browsers refuse to open data: links in a new tab, so hand them over as a blob link.
      const href = u.startsWith('data:') ? URL.createObjectURL(await (await fetch(u)).blob()) : u;
      window.open(href, '_blank', 'noopener');
    } catch {
      /* offline */
    }
  };
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={open}
        aria-label={`Open ${label}`}
        className="w-full h-full rounded-[14px] border border-[#E2E5DF] bg-gradient-to-br from-white to-[#E9ECE5] overflow-hidden flex flex-col items-center justify-center gap-1 text-church-muted text-[11px] font-semibold"
      >
        {url && !isPdf ? (
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <>
            {isPdf ? <FileText className="w-[22px] h-[22px]" /> : <Receipt className="w-[22px] h-[22px]" />}
            {label}
          </>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="absolute -top-1.5 -right-1.5 w-[22px] h-[22px] rounded-full bg-church-text text-white flex items-center justify-center"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
};

/* ── Submit accountability ─────────────────────────────────────────────── */
type Row = { description: string; quantity: number; amount: number };

export const AccountabilitySheet: React.FC<{
  requisition: Requisition | null;
  tenantId: string;
  userId: string;
  currency: string;
  onClose: () => void;
}> = ({ requisition, tenantId, userId, currency, onClose }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [receipts, setReceipts] = useState<string[]>([]);
  const [method, setMethod] = useState('Cash to Finance');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const previous = requisition ? AccountabilityService.forRequisition(requisition.id) : null;

  useEffect(() => {
    if (!requisition) return;
    if (previous) {
      setRows(previous.items.map((i) => ({ ...i })));
      setReceipts(previous.receiptPaths);
      setNotes(previous.notes);
      setMethod(previous.balanceMethod || 'Cash to Finance');
    } else {
      setRows(requisition.items.map((i) => ({ description: i.description, quantity: i.quantity, amount: i.quantity * i.unitCost })));
      setReceipts([]);
      setNotes('');
      setMethod('Cash to Finance');
    }
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requisition?.id]);

  if (!requisition) return null;
  const received = Number(requisition.amountPaid || 0);
  const gave = Number(requisition.deptContributionAmount || 0);
  const spent = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const balance = Math.min(received, received + gave - spent);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      for (const f of Array.from(files)) {
        const path = await ReceiptService.upload(f);
        setReceipts((r) => [...r, path]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the receipt.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = rows.filter((r) => r.description.trim() && r.amount > 0).map((r) => ({ ...r, description: r.description.trim() }));
    if (!items.length) return setError('Add at least one item you bought.');
    if (!receipts.length) return setError('Add a photo of at least one receipt.');
    if (balance < 0) return setError('You spent more than you had. Check the amounts, or explain in the notes and split the items.');
    AccountabilityService.submit({ tenantId, requisition, items, balanceMethod: method, receiptPaths: receipts, notes, submittedBy: userId });
    onClose();
  };

  return (
    <MobileSheet open onClose={onClose} title="Submit accountability" subtitle={`${requisition.requisitionNumber} · ${requisition.title}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[#F6F7F3]">
          <span className="w-10 h-10 rounded-xl bg-[#FCEFD9] text-[#7A4300] flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[15px] font-semibold">
              {requisition.requisitionNumber} · {fmt(received, currency)}
            </span>
            <span className="oc-sub">Paid out by Finance</span>
          </span>
        </div>
        {previous?.status === 'QUERIED' && (
          <div className="flex gap-2.5 p-3 rounded-[14px] bg-church-warnSoft">
            <MessageCircle className="w-[18px] h-[18px] text-[#7A4300] shrink-0" />
            <span className="text-sm leading-[1.45] text-[#5A3500]">
              <b>Finance asked:</b> {previous.reviewNote || 'Please check and resubmit.'}
            </span>
          </div>
        )}
        <div className="flex justify-between items-baseline">
          <span className="oc-label">What you bought</span>
          <button type="button" onClick={() => setRows([...rows, { description: '', quantity: 1, amount: 0 }])} className="text-sm font-semibold text-[#2F6B0A]">
            + Add item
          </button>
        </div>
        <div className="grid grid-cols-[1fr_64px_110px_28px] gap-2 text-[11px] font-semibold uppercase tracking-wider text-church-muted -mb-2">
          <span>Item</span>
          <span>Qty</span>
          <span>Spent ({currency})</span>
          <span />
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_64px_110px_28px] gap-2 items-center">
            <input
              aria-label="Item bought"
              value={r.description}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
              className="h-[46px] min-w-0 px-3 rounded-[14px] border-[1.5px] border-[#E2E5DF] bg-[#FAFBF8] text-[15px] outline-none focus:border-church-forest"
            />
            <input
              aria-label="Quantity"
              inputMode="numeric"
              value={r.quantity || ''}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)))}
              className="h-[46px] min-w-0 px-3 rounded-[14px] border-[1.5px] border-[#E2E5DF] bg-[#FAFBF8] text-[15px] outline-none focus:border-church-forest"
            />
            <input
              aria-label="Amount spent"
              inputMode="numeric"
              value={r.amount ? r.amount.toLocaleString('en-US') : ''}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value.replace(/\D/g, '')) || 0 } : x)))}
              className="h-[46px] min-w-0 px-3 rounded-[14px] border-[1.5px] border-[#E2E5DF] bg-[#FAFBF8] text-[15px] tabular-nums outline-none focus:border-church-forest"
            />
            <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove item" className="text-church-muted flex items-center justify-center">
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        ))}
        <div className="rounded-2xl bg-[#F6F7F3] px-3.5 py-1">
          <div className="flex justify-between py-2.5 text-sm">
            <span className="text-church-muted">Received from Finance</span>
            <span className="font-display font-semibold tabular-nums">{fmt(received, currency)}</span>
          </div>
          {gave > 0 && (
            <div className="flex justify-between py-2.5 border-t border-church-line text-sm">
              <span className="text-church-muted">Your department gave</span>
              <span className="font-display font-semibold tabular-nums">{fmt(gave, currency)}</span>
            </div>
          )}
          <div className="flex justify-between py-2.5 border-t border-church-line text-sm">
            <span className="text-church-muted">Spent</span>
            <span className="font-display font-semibold tabular-nums">{fmt(spent, currency)}</span>
          </div>
          <div className="flex justify-between items-baseline py-3 border-t border-church-line">
            <span className="text-[15px] font-semibold">{balance >= 0 ? 'Balance to return' : 'Over budget'}</span>
            <span className={`font-display text-lg font-bold tabular-nums ${balance > 0 ? 'text-[#A15C00]' : balance < 0 ? 'text-church-neg' : ''}`}>{fmt(Math.abs(balance), currency)}</span>
          </div>
        </div>
        {balance > 0 && (
          <SelectInput
            label="Balance returned by"
            value={method}
            onChange={setMethod}
            options={[
              { value: 'Cash to Finance', label: 'Cash to Finance' },
              { value: 'Mobile Money to Finance', label: 'Mobile Money to Finance' },
            ]}
          />
        )}
        <div className="flex flex-col gap-2">
          <span className="oc-label">Receipts</span>
          <div className="flex flex-wrap gap-2.5 pt-1.5">
            {receipts.map((p, i) => (
              <ReceiptThumb key={p.slice(-40) + i} path={p} label={`Receipt ${i + 1}`} onRemove={() => setReceipts(receipts.filter((_, j) => j !== i))} />
            ))}
            <label className={`w-[84px] h-[84px] rounded-[14px] border-[1.5px] border-dashed border-[#C9CEC6] flex flex-col items-center justify-center gap-1 text-[11px] font-semibold cursor-pointer ${uploading ? 'opacity-60' : ''}`}>
              <Camera className="w-[22px] h-[22px]" />
              {uploading ? 'Uploading…' : 'Add photo'}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                disabled={uploading}
                onChange={(e) => void addFiles(e.target.files)}
                className="sr-only"
                aria-label="Upload receipt"
              />
            </label>
          </div>
          <span className="oc-sub">Take a clear photo of each receipt. PDFs work too.</span>
        </div>
        <TextAreaInput label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Anything Finance should know…" />
        {error && (
          <p role="alert" className="m-0 text-sm font-medium text-church-neg">
            {error}
          </p>
        )}
        <button type="submit" disabled={uploading} className="oc-btn-primary w-full">
          <ClipboardCheck className="w-5 h-5" /> Submit accountability
        </button>
      </form>
    </MobileSheet>
  );
};

/* ── "Account first" (blocks a new requisition) ────────────────────────── */
export const BlockedSheet: React.FC<{ requisition: Requisition | null; currency: string; onClose: () => void; onAccount: (r: Requisition) => void }> = ({
  requisition,
  currency,
  onClose,
  onAccount,
}) => {
  if (!requisition) return null;
  return (
    <MobileSheet open onClose={onClose} title={`Account for ${requisition.requisitionNumber} first`} subtitle="One requisition at a time: account, then ask again.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2.5 text-center pt-1">
          <span className="w-16 h-16 rounded-[20px] bg-[#FCEFD9] text-[#A15C00] flex items-center justify-center">
            <Lock className="w-[30px] h-[30px]" />
          </span>
          <span className="text-[15px] leading-[1.5] text-[#3E4741] max-w-[300px]">
            Finance paid out your last requisition. Show what you bought and upload the receipts, then you can ask again.
          </span>
        </div>
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#F6F7F3]">
          <span className="w-10 h-10 rounded-xl bg-[#FCEFD9] text-[#7A4300] flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[15px] font-semibold truncate">
              {requisition.requisitionNumber} · {requisition.title}
            </span>
            <span className="oc-sub">Paid {fmt(requisition.amountPaid, currency)}</span>
          </span>
        </div>
        <button type="button" onClick={() => onAccount(requisition)} className="oc-btn-primary w-full">
          <ClipboardCheck className="w-5 h-5" /> Submit accountability
        </button>
        <button type="button" onClick={onClose} className="oc-btn-ghost w-full">
          Not now
        </button>
      </div>
    </MobileSheet>
  );
};

/* ── Accountability section (department More tab) ───────────────────────── */
const STATUS: Record<RequisitionAccountability['status'], { label: string; kind: 'ok' | 'warn' | 'neutral' }> = {
  SUBMITTED: { label: 'With Finance', kind: 'neutral' },
  ACCEPTED: { label: 'Accepted', kind: 'ok' },
  QUERIED: { label: 'Queried', kind: 'warn' },
};

export const AccountabilitySection: React.FC<{
  tenantId: string;
  departmentId: string;
  currency: string;
  requisitions: Requisition[];
  onAccount: (r: Requisition) => void;
}> = ({ tenantId, departmentId, currency, requisitions, onAccount }) => {
  const due = AccountabilityService.dueFor(tenantId, departmentId);
  const submitted = AccountabilityService.getAll(tenantId, departmentId).filter((a) => a.status !== 'QUERIED');
  const reqOf = (id: string) => requisitions.find((r) => r.id === id);
  const dueTotal = due.reduce((a, r) => a + r.amountPaid, 0);
  return (
    <div className="flex flex-col gap-4">
      <DarkCard eyebrow="To account for" title={due.length ? `${due.length} payout${due.length === 1 ? '' : 's'} · ${fmt(dueTotal, currency)}` : 'You’re all accounted for'}>
        <span className="text-sm leading-[1.45] text-church-mist">
          {due.length ? 'New requisitions open again once these are submitted.' : 'Every payout has been accounted for. You can send new requisitions.'}
        </span>
      </DarkCard>
      {due.length > 0 && <span className="oc-h2">Waiting on you</span>}
      {due.map((r) => {
        const acc = AccountabilityService.forRequisition(r.id);
        return (
          <section key={r.id} className="bg-white rounded-[20px] p-4 flex flex-col gap-3">
            <div className="flex justify-between gap-2.5">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="oc-sub">
                  {r.requisitionNumber} · paid {formatDate(r.requestedAt)}
                </span>
                <span className="font-display text-[17px] font-semibold leading-snug">{r.title}</span>
              </div>
              {acc?.status === 'QUERIED' ? <Badge kind="warn">Queried</Badge> : <Badge kind="warn">Due</Badge>}
            </div>
            {acc?.status === 'QUERIED' && (
              <div className="flex gap-2.5 p-3 rounded-[14px] bg-church-warnSoft">
                <AlertTriangle className="w-[18px] h-[18px] text-[#7A4300] shrink-0" />
                <span className="text-sm leading-[1.45] text-[#5A3500]">
                  <b>Finance:</b> {acc.reviewNote || 'Please check and resubmit.'}
                </span>
              </div>
            )}
            <div>
              {r.items.map((it, i) => (
                <div key={i} className="flex justify-between gap-3 py-2 border-t border-church-line text-sm">
                  <span className="text-church-muted">
                    {it.quantity}× {it.description}
                  </span>
                  <span className="font-display font-semibold tabular-nums">{(it.quantity * it.unitCost).toLocaleString('en-US')}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-baseline">
              <span className="oc-sub">Received from Finance</span>
              <span className="oc-num text-[22px]">{fmt(r.amountPaid, currency)}</span>
            </div>
            <button type="button" onClick={() => onAccount(r)} className="oc-btn-primary w-full">
              <ClipboardCheck className="w-5 h-5" /> {acc?.status === 'QUERIED' ? 'Fix & resubmit' : 'Submit accountability'}
            </button>
          </section>
        );
      })}
      {submitted.length > 0 && <span className="oc-h2">Submitted</span>}
      {submitted.length > 0 && (
        <section className="bg-white rounded-[20px] px-4 py-1">
          <div className="divide-y divide-church-line">
            {submitted.map((a) => {
              const r = reqOf(a.requisitionId);
              return (
                <div key={a.id} className="flex items-center gap-3 min-h-[64px] py-2.5">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.status === 'ACCEPTED' ? 'bg-[#DDF1E4] text-[#0E5A37]' : 'bg-[#DDEBF7] text-[#1D4E7A]'}`}>
                    <ClipboardCheck className="w-5 h-5" />
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold truncate">
                      {r?.requisitionNumber ?? 'Requisition'} · {r?.title ?? ''}
                    </span>
                    <span className="oc-sub truncate">
                      Spent {fmt(a.amountSpent, currency)} of {Math.round(a.amountReceived).toLocaleString('en-US')} · {a.receiptPaths.length} receipt{a.receiptPaths.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <Badge kind={STATUS[a.status].kind}>{STATUS[a.status].label}</Badge>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {!due.length && !submitted.length && (
        <p className="m-0 text-center oc-sub py-4 flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Paid requisitions will appear here to account for.
        </p>
      )}
    </div>
  );
};
