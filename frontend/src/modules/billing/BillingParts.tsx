import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from 'lucide-react';
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

/* ── Pay with MarzPay (Mobile Money + Card) ─────────────────────────────────── */

type PayMethod = 'MTN_MOMO' | 'AIRTEL_MONEY' | 'VISA';

const MethodButton: React.FC<{ method: PayMethod; on: boolean; onClick: () => void }> = ({
  method,
  on,
  onClick,
}) => {
  const isMtn = method === 'MTN_MOMO';
  const isAirtel = method === 'AIRTEL_MONEY';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`relative flex flex-col items-start gap-2 p-3 rounded-2xl text-left oc-press ${
        on ? 'border-2 border-[#A3E635] bg-[#F1F9E6]' : 'border-[1.5px] border-[#E2E5DF] bg-white'
      }`}
    >
      <div className="w-full flex items-center justify-between gap-1.5">
        {method === 'VISA' ? (
          <span className="w-[32px] h-[32px] shrink-0 rounded-[10px] bg-[#0F2418] text-[#A3E635] flex items-center justify-center">
            <CreditCard className="w-4 h-4" strokeWidth={2} />
          </span>
        ) : (
          <span
            className="w-[32px] h-[32px] shrink-0 rounded-[10px] flex items-center justify-center font-display font-extrabold text-[10px]"
            style={{
              background: isMtn ? '#FFCB05' : '#E40000',
              color: isMtn ? '#18231C' : '#FFFFFF',
            }}
          >
            {isMtn ? 'MTN' : 'Airtel'}
          </span>
        )}
        {on ? (
          <span className="w-[20px] h-[20px] shrink-0 rounded-full bg-[#A3E635] text-church-forest flex items-center justify-center">
            <Check className="w-3 h-3" strokeWidth={3} />
          </span>
        ) : (
          <span className="w-[20px] h-[20px] shrink-0 rounded-full border-2 border-[#DADDD6]" />
        )}
      </div>
      <span className="text-[13px] font-semibold text-church-text leading-tight">
        {isMtn ? 'MTN MoMo' : isAirtel ? 'Airtel Money' : 'Card'}
      </span>
    </button>
  );
};

export const PayCard: React.FC<{
  tenant: Tenant;
  state: SubscriptionState;
  defaultPhone?: string;
  userId?: string;
  cta?: string;
  /** Called when the MarzPay prompt is sent, before the payment is confirmed. */
  onStart?: () => void;
  onPaid: (p: SubscriptionPayment) => void;
}> = ({ tenant, state, defaultPhone = '', cta, onStart, onPaid }) => {
  const detectNetwork = (val: string): 'MTN_MOMO' | 'AIRTEL_MONEY' | null => {
    const digits = val.replace(/\D/g, '');
    const local = digits.startsWith('256')
      ? digits.slice(3)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits;
    const prefix = local.slice(0, 2);
    if (['70', '74', '75'].includes(prefix)) return 'AIRTEL_MONEY';
    if (['76', '77', '78', '39'].includes(prefix)) return 'MTN_MOMO';
    return null;
  };

  const [method, setMethod] = useState<PayMethod>(
    detectNetwork(defaultPhone) ?? 'MTN_MOMO'
  );
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [inFlight, setInFlight] = useState<{
    payment: SubscriptionPayment;
    redirectUrl: string | null;
    message: string;
  } | null>(null);
  const pollCountRef = useRef(0);

  // Preview of the renewal date shown before paying
  const now = new Date();
  const start = state.phase !== 'expired' && state.endsAt > now ? state.endsAt : now;
  const renews = new Date(start);
  renews.setMonth(renews.getMonth() + 1);

  const checkStatusOnce = useCallback(
    async (referenceNumber: string, manual = false) => {
      if (manual) setCheckingNow(true);
      try {
        const res = await SubscriptionService.checkMarzPayPaymentStatus(referenceNumber);
        if (res.status === 'COMPLETED') {
          setInFlight(null);
          onPaid(res.payment);
          return true;
        }
        if (res.status === 'FAILED') {
          setInFlight(null);
          setError(
            res.payment.failureReason ||
              'Payment was declined, cancelled, or timed out. Please try again.'
          );
          return true;
        }
      } catch (err) {
        if (manual) {
          setError(err instanceof Error ? err.message : 'Could not verify payment status yet.');
        }
      } finally {
        if (manual) setCheckingNow(false);
      }
      return false;
    },
    [onPaid]
  );

  useEffect(() => {
    if (!inFlight) return;
    pollCountRef.current = 0;
    let cancelled = false;

    const timer = window.setInterval(async () => {
      if (cancelled) return;
      pollCountRef.current += 1;
      // Poll for up to ~3.5 minutes (70 * 3s)
      if (pollCountRef.current > 70) {
        window.clearInterval(timer);
        setInFlight(null);
        setError(
          'Timed out waiting for Mobile Money confirmation. If you already entered your PIN, refresh this page in a moment.'
        );
        return;
      }
      const done = await checkStatusOnce(inFlight.payment.referenceNumber, false);
      if (done) {
        window.clearInterval(timer);
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [inFlight, checkStatusOnce]);

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (error) setError('');
    if (method !== 'VISA') {
      const inferred = detectNetwork(val);
      if (inferred) setMethod(inferred);
    }
  };

  const pay = async () => {
    if (method !== 'VISA') {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 9) {
        setError('Enter the Mobile Money number to charge.');
        return;
      }
    }
    setError('');
    setSubmitting(true);
    try {
      onStart?.();
      const res = await SubscriptionService.initiateMarzPayCollection({
        method,
        phoneNumber: method === 'VISA' ? undefined : phone,
      });
      setInFlight({
        payment: res.payment,
        redirectUrl: res.redirectUrl,
        message: res.message,
      });
      if (method === 'VISA' && res.redirectUrl) {
        window.open(res.redirectUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start MarzPay payment. Check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (inFlight) {
    const isCard = inFlight.payment.paymentMethod === 'VISA';
    const netLabel =
      inFlight.payment.paymentMethod === 'AIRTEL_MONEY' ? 'Airtel Money' : 'MTN MoMo';

    return (
      <Card className="items-center text-center !gap-3 !py-8">
        <span className="w-16 h-16 rounded-full bg-[#F1F9E6] text-church-forest flex items-center justify-center">
          {isCard ? (
            <CreditCard className="w-7 h-7" strokeWidth={1.8} />
          ) : (
            <Smartphone className="w-7 h-7" strokeWidth={1.8} />
          )}
        </span>
        <h2 className="oc-h2">{isCard ? 'Complete card checkout' : 'Check your phone'}</h2>
        <p className="text-[15px] text-church-muted leading-snug max-w-[320px]">
          {isCard ? (
            <>
              Complete the UGX {num(state.fee)} payment on the secure MarzPay checkout tab. This
              screen unlocks automatically as soon as payment succeeds.
            </>
          ) : (
            <>
              Approve <b>UGX {num(state.fee)}</b> on{' '}
              <b>{inFlight.payment.phoneOrAccount || phone}</b> with your {netLabel} PIN.
            </>
          )}
        </p>
        {isCard && inFlight.redirectUrl && (
          <a
            href={inFlight.redirectUrl}
            target="_blank"
            rel="noreferrer"
            className="oc-btn-primary !h-11 !px-5 !text-sm"
          >
            <ExternalLink className="w-4 h-4" /> Open MarzPay checkout
          </a>
        )}
        <span className="flex items-center gap-2 text-sm font-semibold text-church-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Waiting for MarzPay confirmation…
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          <button
            type="button"
            disabled={checkingNow}
            onClick={() => void checkStatusOnce(inFlight.payment.referenceNumber, true)}
            className="oc-btn !h-10 !px-4 !text-sm bg-church-canvas text-church-text disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${checkingNow ? 'animate-spin' : ''}`} />
            {checkingNow ? 'Checking…' : 'Check status now'}
          </button>
          <button
            type="button"
            onClick={() => setInFlight(null)}
            className="oc-btn-ghost !h-10 !px-4 !text-sm"
          >
            Cancel
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="oc-h2">Pay with Mobile Money</h2>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-church-emerald">
          <ShieldCheck className="w-3.5 h-3.5" /> MarzPay Instant
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MethodButton method="MTN_MOMO" on={method === 'MTN_MOMO'} onClick={() => setMethod('MTN_MOMO')} />
        <MethodButton method="AIRTEL_MONEY" on={method === 'AIRTEL_MONEY'} onClick={() => setMethod('AIRTEL_MONEY')} />
        <MethodButton method="VISA" on={method === 'VISA'} onClick={() => setMethod('VISA')} />
      </div>
      {method !== 'VISA' ? (
        <label className="flex flex-col gap-1.5 min-w-0">
          <span className="oc-label">Phone number to charge</span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="+256 772 000000"
            className={`oc-field tabular-nums ${error ? '!border-church-neg' : ''}`}
          />
        </label>
      ) : (
        <p className="m-0 text-[13px] leading-normal text-church-muted px-3 py-2.5 rounded-xl bg-church-canvas">
          Opens MarzPay’s secure card gateway for Visa &amp; Mastercard payments.
        </p>
      )}
      {error && (
        <div role="alert" className="flex gap-2 items-start px-3.5 py-2.5 rounded-xl bg-church-negSoft text-[13px] leading-snug text-[#8F1D14]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
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
      <button
        type="button"
        disabled={submitting}
        onClick={() => void pay()}
        className="oc-btn-primary w-full !h-14 !text-[17px] disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : method === 'VISA' ? (
          <CreditCard className="w-5 h-5" strokeWidth={1.8} />
        ) : (
          <Smartphone className="w-5 h-5" strokeWidth={1.8} />
        )}
        {submitting
          ? 'Sending payment prompt…'
          : cta ?? `Pay UGX ${num(state.fee)}`}
      </button>
      <p className="-mt-1 text-[13px] leading-normal text-church-muted text-center">
        {method === 'VISA'
          ? 'Powered by MarzPay. Unlocks all 7 departments immediately once confirmed.'
          : 'MarzPay sends a STK push prompt to this phone. Enter your Mobile Money PIN to confirm.'}
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

export const ManualPayCard: React.FC<{ tenant: Tenant }> = ({ tenant }) => {
  if (PAYMENT_DETAILS_ARE_EXAMPLES) {
    return (
      <Card>
        <div className="flex items-center gap-2.5">
          <Tile icon={ShieldCheck} tone="lime" />
          <div className="flex flex-col">
            <h2 className="oc-h2">Instant automatic unlock</h2>
            <span className="oc-sub">Powered by MarzPay · MTN MoMo, Airtel Money &amp; Card</span>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed text-church-muted m-0">
          Your monthly UGX 50,000 subscription covers all 7 departments and unlimited church leaders.
          Renewing early adds 1 full month onto your current expiry date — you never lose remaining days.
        </p>
      </Card>
    );
  }

  return (
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
      </p>
    </Card>
  );
};

/* ── Billing history ───────────────────────────────────────────────────────── */

const METHOD_LABEL: Record<SubscriptionPayment['paymentMethod'], string> = {
  MTN_MOMO: 'MTN MoMo',
  AIRTEL_MONEY: 'Airtel Money',
  BANK_TRANSFER: 'Bank transfer',
  VISA: 'Card',
};

export const BillingHistory: React.FC<{ tenant: Tenant }> = ({ tenant }) => {
  const allPayments = SubscriptionService.getPayments(tenant.id);
  const completedCount = allPayments.filter((p) => p.status === 'COMPLETED').length;
  const visiblePayments = allPayments.filter((p) => p.status === 'COMPLETED' || p.status === 'PENDING');
  const trialStart = tenant.trialEndsAt
    ? new Date(new Date(tenant.trialEndsAt).getTime() - TRIAL_DAYS * 86400000)
    : new Date(tenant.createdAt);
  return (
    <ListCard title="Billing history" aside={completedCount ? `${completedCount} paid` : undefined}>
      {visiblePayments.map((p) => {
        const isPending = p.status === 'PENDING';
        const txDisplay = p.providerReference || p.referenceNumber.slice(0, 8).toUpperCase();
        return (
          <Row
            key={p.id}
            lead={<Tile icon={Wallet} tone={isPending ? 'amber' : 'green'} />}
            title={
              isPending
                ? 'Awaiting Mobile Money PIN confirmation'
                : `${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`
            }
            sub={`${METHOD_LABEL[p.paymentMethod]} · ${formatDate(p.createdAt)} · Ref ${txDisplay}`}
            trail={
              <span className="flex flex-col items-end">
                <span className="font-display text-[15px] font-bold tabular-nums">
                  {p.currency || 'UGX'} {num(p.amount)}
                </span>
                {isPending && (
                  <span className="text-[11px] font-semibold text-church-warn">Pending</span>
                )}
              </span>
            }
          />
        );
      })}
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
  const txRef = p.providerReference
    ? `${p.providerReference} (MarzPay ${p.referenceNumber})`
    : p.referenceNumber;
  const lines = [
    'OPEN CHURCH — PAYMENT RECEIPT',
    '',
    `Church:        ${tenant.name}`,
    `Amount:        ${p.currency} ${num(p.amount)}`,
    `Paid with:     ${METHOD_LABEL[p.paymentMethod]}${p.phoneOrAccount ? ` · ${p.phoneOrAccount}` : ''}`,
    `Transaction:   ${txRef}`,
    `Period:        ${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`,
    `Paid on:       ${formatDate(p.completedAt || p.createdAt)}`,
    '',
    'Processed securely via MarzPay.',
    'Thank you.',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `open-church-receipt-${p.providerReference || p.referenceNumber}.txt`;
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
        ['Amount', `${payment.currency || 'UGX'} ${num(payment.amount)}`],
        ['Paid with', `${METHOD_LABEL[payment.paymentMethod]}${payment.phoneOrAccount ? ` · ${payment.phoneOrAccount}` : ''}`],
        ['Transaction', payment.providerReference || payment.referenceNumber],
        ['Next payment', formatDate(payment.periodEnd)],
      ].map(([k, v], i) => (
        <div key={k} className={`flex justify-between gap-3 py-2.5 ${i ? 'border-t border-church-line' : ''}`}>
          <span className="oc-sub">{k}</span>
          <span className={`text-right break-all ${i === 0 ? 'font-display font-bold text-base' : 'font-semibold'}`}>{v}</span>
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
