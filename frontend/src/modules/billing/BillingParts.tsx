import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Check, Copy, Download, Loader2, Smartphone, Sparkles, Wallet } from 'lucide-react';
import { SubscriptionPayment, Tenant } from '@/shared/types';
import { SubscriptionService, SubscriptionState, TRIAL_DAYS } from '@/services/churchService';
import {
  churchShortName,
  formatLongDate,
  formatShortDay,
  PAYMENT_DETAILS,
  PAYMENT_DETAILS_ARE_EXAMPLES,
  paymentReference,
} from '@/shared/billing';
import { Card, ListCard, num, Row, Tile } from '@/components/ui/kit';
import { formatDate } from '@/shared/formatters';

const AMBER = '#F59E0B';

/* ── Dark plan card: trial / active / due / expired ─────────────────────────── */

export const PlanCard: React.FC<{ state: SubscriptionState }> = ({ state }) => {
  const expired = state.phase === 'expired';
  const day = formatShortDay(state.endsAt);
  let eyebrow: string;
  let title: string;
  let line: string;
  let pct: number;
  if (expired) {
    eyebrow = 'Subscription expired';
    title = 'Open Church is paused';
    line = `Expired ${day} · every department is locked until you pay`;
    pct = 100;
  } else if (state.isTrial) {
    eyebrow = `Free trial · day ${state.trialDay} of ${TRIAL_DAYS}`;
    title = state.daysLeft <= 1 ? 'Your trial ends today' : `${state.daysLeft} days left in your trial`;
    line = `Trial ends ${day} · then UGX ${num(state.fee)} every month`;
    pct = Math.round((state.trialDay / TRIAL_DAYS) * 100);
  } else {
    eyebrow = state.phase === 'due' ? 'Payment due soon' : 'Subscription active';
    title = state.phase === 'due' ? `Renews in ${state.daysLeft} day${state.daysLeft === 1 ? '' : 's'}` : `Paid until ${day}`;
    line = `Next payment ${day} · UGX ${num(state.fee)}`;
    pct = Math.min(100, Math.max(4, Math.round((1 - state.daysLeft / 30) * 100)));
  }
  const bar = expired ? AMBER : '#A3E635';
  return (
    <section className="bg-church-forest text-[#EEF5E9] rounded-[24px] p-5 flex flex-col gap-3.5">
      <span className="flex items-center gap-2">
        <span className="w-7 h-[3px] rounded-sm" style={{ background: bar }} />
        <span className="text-[13px] font-semibold" style={{ color: expired ? '#FCD9A0' : '#C9F08A' }}>
          {eyebrow}
        </span>
      </span>
      <span className="font-display text-[26px] leading-[1.15] font-bold text-white">{title}</span>
      <div className="flex flex-col gap-1.5">
        <div className="h-2 rounded bg-white/[0.12]">
          <div className="h-2 rounded" style={{ width: `${pct}%`, background: bar }} />
        </div>
        <span className="text-[13px] text-[#A9B8AC]">{line}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-[14px] bg-white/[0.07] px-3 py-2.5 flex flex-col gap-0.5">
          <span className="text-xs text-[#A9B8AC]">Plan</span>
          <span className="font-display text-lg font-bold text-white">Monthly</span>
        </div>
        <div className="rounded-[14px] bg-white/[0.07] px-3 py-2.5 flex flex-col gap-0.5">
          <span className="text-xs text-[#A9B8AC]">Amount</span>
          <span className="font-display text-lg font-bold text-[#A3E635] tabular-nums">UGX {num(state.fee)}</span>
        </div>
      </div>
    </section>
  );
};

export const DueBanner: React.FC<{ state: SubscriptionState; onClick?: () => void }> = ({ state, onClick }) => (
  <div
    role={onClick ? 'button' : undefined}
    onClick={onClick}
    className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[#FCEFD9] text-[#7A4300] ${onClick ? 'cursor-pointer oc-press' : ''}`}
  >
    <AlertTriangle className="w-5 h-5 shrink-0" strokeWidth={1.8} />
    <span className="flex-1 text-sm font-semibold leading-snug">
      Pay before {formatShortDay(state.endsAt)} to keep every department working.
    </span>
    {onClick && <ArrowRight className="w-4 h-4 shrink-0" />}
  </div>
);

/* ── Pay with Mobile Money ──────────────────────────────────────────────────── */

type Network = 'MTN_MOMO' | 'AIRTEL_MONEY';

const NetworkButton: React.FC<{ net: Network; on: boolean; onClick: () => void }> = ({ net, on, onClick }) => {
  const mtn = net === 'MTN_MOMO';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex-1 min-w-0 flex items-center gap-2.5 p-3 rounded-2xl text-left oc-press ${
        on ? 'border-2 border-[#A3E635] bg-[#F1F9E6]' : 'border-[1.5px] border-[#E2E5DF] bg-white'
      }`}
    >
      <span
        className="w-[34px] h-[34px] shrink-0 rounded-[10px] flex items-center justify-center font-display font-extrabold text-[11px]"
        style={{ background: mtn ? '#FFCB05' : '#E40000', color: mtn ? '#18231C' : '#FFFFFF' }}
      >
        {mtn ? 'MTN' : 'Airtel'}
      </span>
      <span className="flex-1 min-w-0 text-sm font-semibold text-church-text">{mtn ? 'MTN MoMo' : 'Airtel Money'}</span>
      {on ? (
        <span className="w-[22px] h-[22px] shrink-0 rounded-full bg-[#A3E635] text-church-forest flex items-center justify-center">
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </span>
      ) : (
        <span className="w-[22px] h-[22px] shrink-0 rounded-full border-2 border-[#DADDD6]" />
      )}
    </button>
  );
};

export const PayCard: React.FC<{
  tenant: Tenant;
  state: SubscriptionState;
  defaultPhone?: string;
  userId?: string;
  cta?: string;
  /** Called when the Mobile Money prompt is sent, before the payment is recorded. */
  onStart?: () => void;
  onPaid: (p: SubscriptionPayment) => void;
}> = ({ tenant, state, defaultPhone = '', userId, cta, onStart, onPaid }) => {
  const [net, setNet] = useState<Network>(/^\+?256\s?7[05]/.test(defaultPhone) ? 'AIRTEL_MONEY' : 'MTN_MOMO');
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);

  // Preview of the renewal date shown before paying (same rule as SubscriptionService.recordPayment).
  const now = new Date();
  const start = state.phase !== 'expired' && state.endsAt > now ? state.endsAt : now;
  const renews = new Date(start);
  renews.setMonth(renews.getMonth() + 1);

  useEffect(() => {
    if (!waiting) return;
    // Simulated provider confirmation. Replace with the real Mobile Money callback.
    const t = window.setTimeout(() => {
      const p = SubscriptionService.recordPayment({
        tenantId: tenant.id,
        method: net,
        phoneOrAccount: phone,
        recordedBy: userId,
      });
      setWaiting(false);
      onPaid(p);
    }, 2200);
    return () => window.clearTimeout(t);
  }, [waiting]); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      setError('Enter the Mobile Money number to charge.');
      return;
    }
    setError('');
    onStart?.();
    setWaiting(true);
  };

  if (waiting) {
    return (
      <Card className="items-center text-center !gap-3 !py-8">
        <span className="w-16 h-16 rounded-full bg-[#F1F9E6] text-church-forest flex items-center justify-center">
          <Smartphone className="w-7 h-7" strokeWidth={1.8} />
        </span>
        <h2 className="oc-h2">Check your phone</h2>
        <p className="text-[15px] text-church-muted leading-snug max-w-[300px]">
          Approve UGX {num(state.fee)} on {phone} with your {net === 'MTN_MOMO' ? 'MTN MoMo' : 'Airtel Money'} PIN.
        </p>
        <span className="flex items-center gap-2 text-sm font-semibold text-church-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Waiting for confirmation…
        </span>
        <button type="button" onClick={() => setWaiting(false)} className="oc-btn-ghost mt-1">
          Cancel
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="oc-h2">Pay with Mobile Money</h2>
        <span className="oc-sub">Instant</span>
      </div>
      <div className="flex gap-2.5">
        <NetworkButton net="MTN_MOMO" on={net === 'MTN_MOMO'} onClick={() => setNet('MTN_MOMO')} />
        <NetworkButton net="AIRTEL_MONEY" on={net === 'AIRTEL_MONEY'} onClick={() => setNet('AIRTEL_MONEY')} />
      </div>
      <label className="flex flex-col gap-1.5 min-w-0">
        <span className="oc-label">Phone number to charge</span>
        <input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+256 772 000000"
          className={`oc-field tabular-nums ${error ? '!border-church-neg' : ''}`}
        />
        {error && <span className="text-[13px] font-medium text-church-neg">{error}</span>}
      </label>
      <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-[14px] bg-[#F6F7F3]">
        <span className="flex flex-col">
          <span className="oc-sub">You’ll pay</span>
          <span className="font-display text-[22px] font-bold tabular-nums">UGX {num(state.fee)}</span>
        </span>
        <span className="oc-sub text-right">
          1 month · {churchShortName(tenant.name, tenant.shortName)}
          <br />
          Renews {formatDate(renews.toISOString())}
        </span>
      </div>
      <button type="button" onClick={pay} className="oc-btn-primary w-full !h-14 !text-[17px]">
        <Smartphone className="w-5 h-5" strokeWidth={1.8} />
        {cta ?? `Pay UGX ${num(state.fee)}`}
      </button>
      <p className="-mt-1 text-[13px] leading-normal text-church-muted text-center">
        You’ll get a prompt on this phone. Enter your Mobile Money PIN to confirm.
      </p>
    </Card>
  );
};

/* ── Manual payment details ─────────────────────────────────────────────────── */

const CopyRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value.split(' · ')[0]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };
  return (
    <div className="flex items-center gap-2.5 py-2.5 border-t border-church-line first:border-t-0">
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="oc-sub">{label}</span>
        <span className="text-[15px] font-semibold text-church-text break-words">{value}</span>
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className={`w-9 h-9 shrink-0 rounded-[10px] flex items-center justify-center oc-press ${
          copied ? 'bg-[#DDF1E4] text-[#0E5A37]' : 'bg-church-canvas text-church-text'
        }`}
      >
        {copied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" strokeWidth={1.8} />}
      </button>
    </div>
  );
};

export const ManualPayCard: React.FC<{ tenant: Tenant }> = ({ tenant }) => (
  <Card>
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="oc-h2">Or pay manually</h2>
      <span className="oc-sub">Bank or MoMo Pay</span>
    </div>
    <div>
      <CopyRow label="MTN MoMo Pay merchant code" value={PAYMENT_DETAILS.mtnMerchantCode} />
      <CopyRow label="Airtel Money pay code" value={PAYMENT_DETAILS.airtelPayCode} />
      <CopyRow label="Bank account" value={PAYMENT_DETAILS.bankAccount} />
      <CopyRow label="Reference to use" value={paymentReference(tenant.slug)} />
    </div>
    <p className="text-[13px] leading-normal text-church-muted">
      Use your church reference so we can match the payment. Manual payments unlock within 1 working day.
      {PAYMENT_DETAILS_ARE_EXAMPLES && (
        <span className="text-church-warn font-semibold"> Example details — set the real ones before launch.</span>
      )}
    </p>
  </Card>
);

/* ── Billing history ───────────────────────────────────────────────────────── */

const METHOD_LABEL: Record<SubscriptionPayment['paymentMethod'], string> = {
  MTN_MOMO: 'MTN MoMo',
  AIRTEL_MONEY: 'Airtel Money',
  BANK_TRANSFER: 'Bank transfer',
  VISA: 'Card',
};

export const BillingHistory: React.FC<{ tenant: Tenant }> = ({ tenant }) => {
  const payments = SubscriptionService.getPayments(tenant.id);
  const trialStart = tenant.trialEndsAt
    ? new Date(new Date(tenant.trialEndsAt).getTime() - TRIAL_DAYS * 86400000)
    : new Date(tenant.createdAt);
  return (
    <ListCard title="Billing history" aside={payments.length ? `${payments.length} paid` : undefined}>
      {payments.map((p) => (
        <Row
          key={p.id}
          lead={<Tile icon={Wallet} tone="green" />}
          title={`${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`}
          sub={`${METHOD_LABEL[p.paymentMethod]} · ${formatDate(p.createdAt)}`}
          trail={<span className="font-display text-[15px] font-bold tabular-nums">UGX {num(p.amount)}</span>}
        />
      ))}
      <Row
        lead={<Tile icon={Sparkles} tone="lime" />}
        title="Free trial started"
        sub={`${formatDate(trialStart.toISOString())} · ${TRIAL_DAYS} days`}
        trail={<span className="font-display text-[15px] font-bold">UGX 0</span>}
      />
    </ListCard>
  );
};

/* ── Payment received ──────────────────────────────────────────────────────── */

const downloadReceipt = (p: SubscriptionPayment, tenant: Tenant) => {
  const lines = [
    'OPEN CHURCH — PAYMENT RECEIPT',
    '',
    `Church:        ${tenant.name}`,
    `Amount:        ${p.currency} ${num(p.amount)}`,
    `Paid with:     ${METHOD_LABEL[p.paymentMethod]}${p.phoneOrAccount ? ` · ${p.phoneOrAccount}` : ''}`,
    `Transaction:   ${p.referenceNumber}`,
    `Period:        ${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`,
    `Paid on:       ${formatDate(p.createdAt)}`,
    '',
    'Thank you.',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `open-church-receipt-${p.referenceNumber}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

export const PaidView: React.FC<{ payment: SubscriptionPayment; tenant: Tenant; onDone: () => void }> = ({
  payment,
  tenant,
  onDone,
}) => (
  <div className="w-full max-w-[440px] mx-auto flex flex-col items-center text-center gap-[18px] pt-8 md:pt-12">
    <span className="w-[84px] h-[84px] rounded-full bg-[#A3E635] text-church-forest flex items-center justify-center">
      <Check className="w-10 h-10" strokeWidth={2.5} />
    </span>
    <h1 className="oc-h1">Payment received</h1>
    <p className="text-base leading-normal text-church-muted">
      Thank you. Open Church is active for every department in {churchShortName(tenant.name, tenant.shortName)} until{' '}
      {formatLongDate(new Date(payment.periodEnd))}.
    </p>
    <Card className="self-stretch text-left !gap-0">
      {[
        ['Amount', `UGX ${num(payment.amount)}`],
        ['Paid with', `${METHOD_LABEL[payment.paymentMethod]}${payment.phoneOrAccount ? ` · ${payment.phoneOrAccount}` : ''}`],
        ['Transaction', payment.referenceNumber],
        ['Next payment', formatDate(payment.periodEnd)],
      ].map(([k, v], i) => (
        <div key={k} className={`flex justify-between gap-3 py-2.5 ${i ? 'border-t border-church-line' : ''}`}>
          <span className="oc-sub">{k}</span>
          <span className={`text-right ${i === 0 ? 'font-display font-bold text-base' : 'font-semibold'}`}>{v}</span>
        </div>
      ))}
    </Card>
    <div className="self-stretch flex flex-col gap-2.5">
      <button type="button" onClick={onDone} className="oc-btn-primary w-full">
        <ArrowRight className="w-5 h-5" /> Back to Open Church
      </button>
      <button type="button" onClick={() => downloadReceipt(payment, tenant)} className="oc-btn-ghost w-full">
        <Download className="w-5 h-5" strokeWidth={1.8} /> Download receipt
      </button>
    </div>
  </div>
);
