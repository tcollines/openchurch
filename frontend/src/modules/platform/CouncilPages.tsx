import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Download,
  Lock,
  MessageCircle,
  Phone,
  Plus,
  Power,
  RefreshCw,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import {
  CouncilService,
  ManualPaymentMethod,
  PlatformService,
  readStore,
  SubscriptionService,
} from '@/services/churchService';
import { UserRole } from '@/shared/enums';
import { SubscriptionPayment, Tenant } from '@/shared/types';
import { churchShortName, paymentReference } from '@/shared/billing';
import { formatDate, getWhatsAppLink } from '@/shared/formatters';
import { Avatar, Badge, BadgeKind, Card, Chips, EmptyState, ListCard, num, PageHeader, Row, Tile, TileTone } from '@/components/ui/kit';
import { MobileSheet } from '@/components/ui/FormControls';

/* ── shared ──────────────────────────────────────────────────────────────── */

type ChurchStatus = 'paying' | 'trial' | 'due' | 'paused';
const DAY = 24 * 60 * 60 * 1000;
const day = (d: Date | string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const wday = (d: Date | string) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const short = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 10_000) / 100}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${n}`);
const paidAt = (p: SubscriptionPayment) => p.completedAt || p.createdAt;
const METHOD: Record<string, { label: string; tone: TileTone }> = {
  MTN_MOMO: { label: 'MTN MoMo', tone: 'amber' },
  AIRTEL_MONEY: { label: 'Airtel Money', tone: 'rose' },
  BANK_TRANSFER: { label: 'Bank', tone: 'blue' },
  VISA: { label: 'Card', tone: 'indigo' },
  CASH: { label: 'Cash', tone: 'lime' },
};

export const churchInfo = (t: Tenant) => {
  const st = SubscriptionService.getState(t)!;
  const suspended = t.status === 'SUSPENDED';
  const status: ChurchStatus = suspended || st.phase === 'expired' ? 'paused' : st.phase === 'due' ? 'due' : st.isTrial ? 'trial' : 'paying';
  const daysOver = Math.max(0, Math.floor((Date.now() - st.endsAt.getTime()) / DAY));
  let badge: [string, BadgeKind];
  let line: string;
  if (status === 'paused') {
    badge = ['Paused', 'bad'];
    line = suspended ? 'Suspended by the Network Council' : `Expired ${day(st.endsAt)}`;
  } else if (status === 'due') {
    badge = [`Due in ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'}`, 'warn'];
    line = st.isTrial ? `Trial ends ${wday(st.endsAt)}` : `Renews ${wday(st.endsAt)}`;
  } else if (status === 'trial') {
    badge = [`Trial · ${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'}`, 'lime'];
    line = `Trial ends ${day(st.endsAt)}`;
  } else {
    const last = SubscriptionService.getPayments(t.id).find((p) => p.status === 'COMPLETED');
    badge = ['Paid', 'ok'];
    line = `Paid until ${day(st.endsAt)}${last ? ` · ${METHOD[last.paymentMethod]?.label ?? ''}` : ''}`;
  }
  const paidTotal = SubscriptionService.getPayments(t.id)
    .filter((p) => p.status === 'COMPLETED')
    .reduce((a, p) => a + Number(p.amount), 0);
  return { st, status, badge, line, daysOver, paidTotal, suspended, name: churchShortName(t.name, t.shortName) };
};

const ChurchLogo: React.FC<{ t: Tenant; size?: number }> = ({ t, size = 44 }) => (
  <img src={t.logoUrl || '/logo.jpg'} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
);

const Eyebrow: React.FC<{ color?: string; text: string; aside?: React.ReactNode; tone?: string }> = ({ color = '#A3E635', text, aside, tone = '#C9F08A' }) => (
  <span className="flex items-center gap-2">
    <span className="w-7 h-[3px] rounded-sm" style={{ background: color }} />
    <span className="text-[13px] font-semibold flex-1" style={{ color: tone }}>
      {text}
    </span>
    {aside && <span className="text-xs text-church-mist">{aside}</span>}
  </span>
);

const MiniStat: React.FC<{ label: string; value: React.ReactNode; color?: string; note?: string }> = ({ label, value, color = '#FFFFFF', note }) => (
  <div className="rounded-[14px] bg-white/[0.07] px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
    <span className="text-xs text-church-mist truncate">{label}</span>
    <span className="font-display text-lg font-bold truncate tabular-nums" style={{ color }}>
      {value}
    </span>
    {note && <span className="text-[11px] text-church-mist truncate">{note}</span>}
  </div>
);

export const BackRow: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <>
    <div className="md:hidden flex items-center gap-3 pt-[max(4px,env(safe-area-inset-top))]">
      <button type="button" onClick={onClick} aria-label={`Back to ${label}`} className="w-11 h-11 rounded-[14px] bg-white flex items-center justify-center oc-press">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <span className="oc-sub !text-[15px]">{label}</span>
    </div>
    <button type="button" onClick={onClick} className="hidden md:inline-flex items-center gap-1 self-start text-sm font-semibold text-church-muted hover:text-church-text -mb-2">
      <ChevronLeft className="w-4 h-4" /> {label}
    </button>
  </>
);

const Kpi: React.FC<{ label: string; value: React.ReactNode; note: string; icon: React.ElementType; tone?: TileTone; color?: string }> = ({
  label,
  value,
  note,
  icon,
  tone = 'neutral',
  color,
}) => (
  <div className="bg-white rounded-card p-[18px] flex flex-col gap-2 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-semibold text-church-muted truncate">{label}</span>
      <Tile icon={icon} tone={tone} size={34} />
    </div>
    <span className="oc-num text-[30px] leading-tight" style={color ? { color } : undefined}>
      {value}
    </span>
    <span className="oc-sub truncate">{note}</span>
  </div>
);

const adminOf = (tenantId: string) =>
  PlatformService.getUsersForTenant(tenantId)
    .filter((u) => u.role === UserRole.ADMIN && u.isActive)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

const reminderLink = (t: Tenant, status: ChurchStatus) => {
  const a = adminOf(t.id);
  if (!a?.phoneNumber) return null;
  const fee = num(t.monthlyFee || 50000);
  const msg =
    status === 'paused'
      ? `Hello ${a.fullName.split(' ')[0]}, Open Church for ${churchShortName(t.name, t.shortName)} is paused. Please pay UGX ${fee} from Administration → More → Subscription to unlock it. Thank you.`
      : `Hello ${a.fullName.split(' ')[0]}, a reminder that the Open Church subscription for ${churchShortName(t.name, t.shortName)} (UGX ${fee}) is due soon. You can pay from Administration → More → Subscription. Thank you.`;
  return getWhatsAppLink(a.phoneNumber, msg);
};

/* ── 1. Churches ─────────────────────────────────────────────────────────── */

type Filter = 'all' | ChurchStatus;

export const CouncilChurchesPage: React.FC = () => {
  useChurchStoreRefresh();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const tenants = PlatformService.getTenants();
  const rows = tenants.map((t) => ({ t, i: churchInfo(t) }));
  const count = (s: ChurchStatus) => rows.filter((r) => r.i.status === s).length;
  const paying = rows.filter((r) => r.i.status === 'paying' || (r.i.status === 'due' && !r.i.st.isTrial)).length;
  const trial = rows.filter((r) => r.i.status === 'trial' || (r.i.status === 'due' && r.i.st.isTrial)).length;
  const paused = count('paused');
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const newThisMonth = tenants.filter((t) => new Date(t.createdAt) >= monthStart).length;
  const fee = tenants[0]?.monthlyFee || 50000;
  const shown = rows
    .filter((r) => filter === 'all' || r.i.status === filter)
    .sort((a, b) => ['paused', 'due', 'trial', 'paying'].indexOf(a.i.status) - ['paused', 'due', 'trial', 'paying'].indexOf(b.i.status));
  const trials = rows.filter((r) => r.i.st.isTrial && r.i.status !== 'paused').map((r) => r.i.name);
  const pausedNames = rows.filter((r) => r.i.status === 'paused').map((r) => r.i.name);

  return (
    <>
      <PageHeader
        title="Churches"
        subtitle="Every church using Open Church and where its subscription stands."
        actions={
          <>
            <button type="button" onClick={() => navigate('/platform/tenants/new')} aria-label="Add a church" className="md:hidden w-11 h-11 rounded-[14px] bg-church-forest text-church-lime flex items-center justify-center oc-press">
              <Plus className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => navigate('/platform/tenants/new')} className="hidden md:inline-flex oc-btn-primary">
              <Plus className="w-5 h-5" /> Add a church
            </button>
          </>
        }
      />

      {/* Phone: dark summary */}
      <section className="md:hidden bg-church-forest text-[#EEF5E9] rounded-[24px] p-5 flex flex-col gap-4">
        <Eyebrow text="Churches on Open Church" />
        <span className="flex items-baseline gap-2.5">
          <span className="font-display text-[56px] leading-none font-bold text-white tracking-[-0.03em]">{tenants.length}</span>
          <span className="text-[15px] text-church-mist">
            church{tenants.length === 1 ? '' : 'es'}
            {newThisMonth ? ` · +${newThisMonth} this month` : ''}
          </span>
        </span>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Paying" value={paying} color="#A3E635" />
          <MiniStat label="On trial" value={trial} />
          <MiniStat label="Paused" value={paused} color="#FCD9A0" />
        </div>
      </section>
      {/* Desktop: KPIs */}
      <div className="hidden md:grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Kpi label="Churches on Open Church" value={tenants.length} note={newThisMonth ? `+${newThisMonth} this month` : 'All churches'} icon={Building2} />
        <Kpi label="Paying" value={paying} note={`UGX ${num(paying * fee)} a month`} icon={Wallet} tone="lime" color="#116B43" />
        <Kpi label="On free trial" value={trial} note={trials.slice(0, 2).join(' · ') || 'None'} icon={Sparkles} />
        <Kpi label="Paused" value={paused} note={pausedNames.slice(0, 2).join(' · ') || 'None'} icon={Lock} tone="amber" color="#A15C00" />
      </div>

      <button
        type="button"
        onClick={() => navigate('/platform/tenants/new')}
        className="md:hidden flex items-center gap-3.5 p-4 rounded-[22px] bg-white border-2 border-dashed border-[#CFE7AE] text-left oc-press"
      >
        <span className="w-12 h-12 shrink-0 rounded-2xl bg-church-lime text-church-forest flex items-center justify-center">
          <Plus className="w-6 h-6" />
        </span>
        <span className="flex-1 flex flex-col gap-0.5">
          <span className="font-display text-[17px] font-semibold">Add a church</span>
          <span className="oc-sub">Starts a 7-day free trial and emails the pastor</span>
        </span>
        <ChevronRight className="w-5 h-5 text-church-faint" />
      </button>

      <Chips<Filter>
        items={[
          { value: 'all', label: 'All', count: rows.length },
          { value: 'paying', label: 'Paying', count: count('paying') },
          { value: 'trial', label: 'Trial', count: count('trial') },
          { value: 'due', label: 'Due', count: count('due') },
          { value: 'paused', label: 'Paused', count: paused },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {shown.length === 0 ? (
        <EmptyState icon={Building2} title={rows.length ? 'No churches here' : 'No churches yet'} sub={rows.length ? 'Try another filter.' : 'Add the first church to start its 7-day free trial.'} />
      ) : (
        <>
          <div className="md:hidden">
            <ListCard>
              {shown.map(({ t, i }) => (
                <Row key={t.id} onClick={() => navigate(`/platform/tenants/${t.id}`)} lead={<ChurchLogo t={t} />} title={i.name} sub={i.line} trail={<Badge kind={i.badge[1]}>{i.badge[0]}</Badge>} />
              ))}
            </ListCard>
          </div>
          <Card className="hidden md:flex !gap-0">
            <div className="grid grid-cols-[2fr_1.2fr_1.4fr_1.2fr_24px] gap-3 pb-2.5 border-b border-church-line text-[13px] font-semibold text-church-muted">
              <span>Church</span>
              <span>Status</span>
              <span>Subscription</span>
              <span>Paid so far</span>
              <span />
            </div>
            {shown.map(({ t, i }) => (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate(`/platform/tenants/${t.id}`)}
                className="grid grid-cols-[2fr_1.2fr_1.4fr_1.2fr_24px] gap-3 items-center py-3 border-b border-church-line last:border-b-0 text-left hover:bg-church-canvas/50"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <ChurchLogo t={t} size={40} />
                  <span className="flex flex-col min-w-0">
                    <span className="text-[15px] font-semibold truncate">{i.name}</span>
                    <span className="oc-sub truncate">{[t.city, t.country].filter(Boolean).join(', ') || t.currency}</span>
                  </span>
                </span>
                <span>
                  <Badge kind={i.badge[1]}>{i.badge[0]}</Badge>
                </span>
                <span className="text-sm truncate">{i.line.split(' · ')[0]}</span>
                <span className="font-display text-[15px] font-semibold tabular-nums">{i.paidTotal ? `UGX ${num(i.paidTotal)}` : '—'}</span>
                <ChevronRight className="w-[18px] h-[18px] text-church-faint" />
              </button>
            ))}
          </Card>
        </>
      )}
    </>
  );
};

/* ── 2. Wallet ───────────────────────────────────────────────────────────── */

type Period = 'month' | 'last' | 'all';

export const CouncilWalletPage: React.FC = () => {
  useChurchStoreRefresh();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('month');
  const tenants = PlatformService.getTenants();
  const byId = new Map(tenants.map((t) => [t.id, t]));
  const now = new Date();
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthName = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' });

  const all = (readStore().subscriptionPayments ?? []).filter((p) => p.status === 'COMPLETED' && byId.has(p.tenantId));
  const inPeriod = all
    .filter((p) => {
      const d = new Date(paidAt(p));
      return period === 'all' ? true : period === 'month' ? d >= mStart : d >= lStart && d < mStart;
    })
    .sort((a, b) => paidAt(b).localeCompare(paidAt(a)));
  const collected = inPeriod.reduce((a, p) => a + Number(p.amount), 0);

  const info = tenants.map((t) => ({ t, i: churchInfo(t) }));
  const live = info.filter((r) => !r.i.suspended);
  const fee = (t: Tenant) => t.monthlyFee || 50000;
  const expected = live.reduce((a, r) => a + fee(r.t), 0);
  const payingRows = info.filter((r) => !r.i.st.isTrial && (r.i.status === 'paying' || r.i.status === 'due'));
  const monthly = payingRows.reduce((a, r) => a + fee(r.t), 0);
  const owing = info.filter((r) => (r.i.status === 'paused' && !r.i.suspended) || (r.i.status === 'due' && !r.i.st.isTrial));
  const outstanding = owing.reduce((a, r) => a + fee(r.t), 0);
  const pct = expected ? Math.min(100, Math.round((collected / expected) * 100)) : 0;

  const attention = info
    .filter((r) => r.i.status === 'paused' || r.i.status === 'due' || (r.i.status === 'trial' && r.i.st.daysLeft <= 3))
    .sort((a, b) => ['paused', 'due', 'trial'].indexOf(a.i.status) - ['paused', 'due', 'trial'].indexOf(b.i.status));

  const exportCsv = () => {
    const lines = [
      ['Date', 'Church', 'Method', 'Reference', 'Amount (UGX)', 'Period start', 'Period end'].join(','),
      ...inPeriod.map((p) =>
        [formatDate(paidAt(p)), `"${byId.get(p.tenantId)?.name ?? ''}"`, METHOD[p.paymentMethod]?.label ?? p.paymentMethod, p.referenceNumber, Number(p.amount), formatDate(p.periodStart), formatDate(p.periodEnd)].join(',')
      ),
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `open-church-payments-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodLabel = period === 'month' ? `Collected in ${monthName(now)}` : period === 'last' ? `Collected in ${monthName(lStart)}` : 'Collected all time';
  const card = (
    <section className="bg-church-forest text-[#EEF5E9] rounded-[24px] p-5 flex flex-col gap-3.5">
      <Eyebrow text={periodLabel} aside={`${inPeriod.length} payment${inPeriod.length === 1 ? '' : 's'}`} />
      <span className="font-display text-[40px] leading-none font-bold text-white tracking-[-0.03em] tabular-nums">
        <span className="text-lg text-church-mist tracking-normal">UGX</span> {num(collected)}
      </span>
      {period !== 'all' && (
        <div className="flex flex-col gap-1.5">
          <div className="h-2 rounded bg-white/[0.12]">
            <div className="h-2 rounded bg-church-lime" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[13px] text-church-mist">
            {pct}% of UGX {num(expected)} — what all {live.length} church{live.length === 1 ? '' : 'es'} pay each month
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <MiniStat label="Monthly income" value={`UGX ${short(monthly)}`} color="#A3E635" note={`from ${payingRows.length} paying church${payingRows.length === 1 ? '' : 'es'}`} />
        <MiniStat label="Outstanding" value={`UGX ${short(outstanding)}`} color="#FCD9A0" note={owing.map((r) => r.i.name).join(' · ') || 'Nothing owed'} />
      </div>
    </section>
  );

  const attentionCard = (
    <ListCard title="Needs attention" aside={attention.length ? String(attention.length) : undefined}>
      {attention.length === 0 ? (
        <p className="py-4 oc-sub">Every church is paid up or on trial.</p>
      ) : (
        attention.map(({ t, i }) => {
          const link = i.status === 'trial' ? null : reminderLink(t, i.status);
          const sub =
            i.status === 'paused'
              ? i.suspended
                ? 'Suspended by the Council'
                : `Paused ${i.daysOver} day${i.daysOver === 1 ? '' : 's'} · owes ${short(fee(t))}`
              : i.status === 'due'
                ? `Due ${wday(i.st.endsAt)}`
                : `Trial ends ${wday(i.st.endsAt)}`;
          return (
            <Row
              key={t.id}
              lead={<ChurchLogo t={t} size={40} />}
              title={i.name}
              sub={sub}
              onClick={link ? undefined : () => navigate(`/platform/tenants/${t.id}`)}
              trail={
                link ? (
                  <a href={link} target="_blank" rel="noreferrer" className="oc-btn !h-9 !px-3.5 !text-sm bg-church-warnSoft text-[#7A4300] shrink-0">
                    <MessageCircle className="w-4 h-4" /> Remind
                  </a>
                ) : (
                  <button type="button" onClick={() => navigate(`/platform/tenants/${t.id}`)} className="oc-btn !h-9 !px-3.5 !text-sm bg-church-canvas text-church-text shrink-0">
                    View
                  </button>
                )
              }
            />
          );
        })
      )}
    </ListCard>
  );

  const paymentsCard = (
    <ListCard
      title="Payments received"
      aside={
        inPeriod.length ? (
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 text-sm font-semibold text-church-emerald">
            Export
          </button>
        ) : undefined
      }
    >
      {inPeriod.length === 0 ? (
        <p className="py-4 oc-sub">No payments in this period yet.</p>
      ) : (
        inPeriod.map((p) => {
          const t = byId.get(p.tenantId)!;
          const m = METHOD[p.paymentMethod] ?? { label: p.paymentMethod, tone: 'neutral' as TileTone };
          return (
            <Row
              key={p.id}
              onClick={() => navigate(`/platform/tenants/${t.id}`)}
              lead={<Tile icon={Coins} tone={m.tone} />}
              title={churchShortName(t.name, t.shortName)}
              sub={`${day(paidAt(p))} · ${m.label}`}
              trail={<span className="font-display text-[15px] font-bold text-church-pos whitespace-nowrap tabular-nums">+UGX {num(Number(p.amount))}</span>}
            />
          );
        })
      )}
    </ListCard>
  );

  return (
    <>
      <PageHeader
        title={
          <>
            <span className="md:hidden">Wallet</span>
            <span className="hidden md:inline">Subscriptions wallet</span>
          </>
        }
        subtitle={`Subscription payments from every church · UGX ${num(tenants[0]?.monthlyFee || 50000)} per church a month.`}
        actions={
          <button type="button" onClick={exportCsv} aria-label="Export payments" className="oc-btn-ghost !h-11 !px-3 md:!px-4 !text-sm">
            <Download className="w-[18px] h-[18px]" /> <span className="hidden md:inline">Export</span>
          </button>
        }
      />
      <div className="md:hidden flex flex-col gap-4">
        {card}
        <Chips<Period>
          items={[
            { value: 'month', label: monthName(now) },
            { value: 'last', label: monthName(lStart) },
            { value: 'all', label: 'All time' },
          ]}
          value={period}
          onChange={setPeriod}
        />
        {attentionCard}
        {paymentsCard}
      </div>
      <div className="hidden md:flex gap-5 items-start">
        <div className="flex-[3] min-w-0 flex flex-col gap-4">
          {card}
          <Chips<Period>
            items={[
              { value: 'month', label: monthName(now) },
              { value: 'last', label: monthName(lStart) },
              { value: 'all', label: 'All time' },
            ]}
            value={period}
            onChange={setPeriod}
          />
          {paymentsCard}
        </div>
        <div className="flex-[2] min-w-0 sticky top-6">{attentionCard}</div>
      </div>
    </>
  );
};

/* ── 3. One church's subscription ────────────────────────────────────────── */

export const CouncilChurchPage: React.FC = () => {
  useChurchStoreRefresh();
  const { id } = useParams();
  const navigate = useNavigate();
  const [recordOpen, setRecordOpen] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const t = PlatformService.getTenantById(id ?? null);
  if (!t) {
    return (
      <>
        <BackRow label="Churches" onClick={() => navigate('/platform/tenants')} />
        <EmptyState icon={Building2} title="Church not found" sub="It may have been removed." />
      </>
    );
  }
  const i = churchInfo(t);
  const fee = t.monthlyFee || 50000;
  const payments = SubscriptionService.getPayments(t.id).filter((p) => p.status === 'COMPLETED');
  const admin = adminOf(t.id);
  const trialStart = t.trialEndsAt ? new Date(new Date(t.trialEndsAt).getTime() - 7 * DAY) : new Date(t.createdAt);
  const since = new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const toggle = async () => {
    const suspending = t.status !== 'SUSPENDED';
    if (suspending && !window.confirm(`Suspend ${i.name}? Nobody in the church can use Open Church until you reactivate it.`)) return;
    setBusy(true);
    try {
      await CouncilService.toggleChurch(t.id);
      setNotice({ ok: true, msg: suspending ? `${i.name} is suspended.` : `${i.name} is active again.` });
    } catch (err) {
      setNotice({ ok: false, msg: err instanceof Error ? err.message : 'Could not change the church status.' });
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    setBusy(true);
    try {
      await PlatformService.resendPastorInvite(t.id);
      setNotice({ ok: true, msg: 'Welcome email sent to the pastor again.' });
    } catch (err) {
      setNotice({ ok: false, msg: err instanceof Error ? err.message : 'Could not resend the email.' });
    } finally {
      setBusy(false);
    }
  };

  let status: React.ReactNode;
  if (i.status === 'paused') {
    status = (
      <section className="bg-church-forest text-[#EEF5E9] rounded-[24px] p-5 flex flex-col gap-3.5">
        <Eyebrow color="#F59E0B" tone="#FCD9A0" text={i.suspended ? 'Suspended by the Network Council' : 'Subscription expired'} />
        <span className="font-display text-[26px] leading-[1.15] font-bold text-white">{i.suspended ? 'Suspended' : `Paused since ${day(i.st.endsAt)}`}</span>
        <div className="flex flex-col gap-1.5">
          <div className="h-2 rounded bg-white/[0.12]">
            <div className="h-2 rounded w-full" style={{ background: '#F59E0B' }} />
          </div>
          <span className="text-[13px] text-church-mist">
            {i.suspended ? 'Reactivate the church to let it use the app again' : `${i.daysOver} day${i.daysOver === 1 ? '' : 's'} overdue · the church can’t use the app until it pays`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label={i.suspended ? 'Paid so far' : 'Owes'} value={`UGX ${num(i.suspended ? i.paidTotal : fee)}`} color={i.suspended ? '#A3E635' : '#FCD9A0'} />
          <MiniStat label="On Open Church since" value={since} />
        </div>
      </section>
    );
  } else {
    const total = i.st.isTrial ? 7 : 30;
    const left = Math.min(100, Math.max(4, Math.round((i.st.daysLeft / total) * 100)));
    status = (
      <section className="bg-church-forest text-[#EEF5E9] rounded-[24px] p-5 flex flex-col gap-3.5">
        <Eyebrow text={i.st.isTrial ? `Free trial · day ${i.st.trialDay} of 7` : i.status === 'due' ? 'Payment due soon' : 'Subscription active'} />
        <span className="font-display text-[26px] leading-[1.15] font-bold text-white">
          {i.st.isTrial ? `Trial ends ${day(i.st.endsAt)}` : `Paid until ${new Date(i.st.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </span>
        <div className="flex flex-col gap-1.5">
          <div className="h-2 rounded bg-white/[0.12]">
            <div className="h-2 rounded bg-church-lime" style={{ width: `${left}%` }} />
          </div>
          <span className="text-[13px] text-church-mist">
            {i.st.daysLeft} day{i.st.daysLeft === 1 ? '' : 's'} left · {i.st.isTrial ? 'then' : 'next payment'} UGX {num(fee)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Paid so far" value={`UGX ${num(i.paidTotal)}`} color="#A3E635" />
          <MiniStat label="On Open Church since" value={since} />
        </div>
      </section>
    );
  }

  const ident = (
    <div className="flex items-center gap-3">
      <ChurchLogo t={t} size={52} />
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="font-display text-[22px] md:text-[28px] leading-[1.15] font-bold tracking-[-0.015em]">{i.name}</span>
        <span className="oc-sub">
          {[t.city, t.country].filter(Boolean).join(', ') || t.currency} · Ref {paymentReference(t.slug)}
        </span>
      </span>
      <span className="hidden md:block">
        <Badge kind={i.badge[1]}>{i.badge[0]}</Badge>
      </span>
    </div>
  );
  const actions = (
    <div className="flex flex-col gap-2.5">
      <button type="button" onClick={() => setRecordOpen(true)} className="oc-btn-primary w-full">
        <Plus className="w-5 h-5" /> Record a payment
      </button>
      <button type="button" onClick={toggle} disabled={busy} className={`oc-btn w-full ${i.suspended ? 'bg-church-posSoft text-[#0E5A37]' : 'bg-church-negSoft text-[#8F1D14]'}`}>
        <Power className="w-5 h-5" /> {i.suspended ? 'Reactivate church' : 'Suspend church'}
      </button>
      {i.st.isTrial && (
        <button type="button" onClick={resend} disabled={busy} className="oc-btn-ghost w-full">
          <RefreshCw className={`w-[18px] h-[18px] ${busy ? 'animate-spin' : ''}`} /> Resend pastor email
        </button>
      )}
    </div>
  );
  const contact = (
    <Card>
      <span className="oc-sub">Who to contact about payment</span>
      {admin ? (
        <>
          <div className="flex items-center gap-3">
            <Avatar name={admin.fullName} size={44} />
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-[15px] font-semibold truncate">{admin.fullName}</span>
              <span className="oc-sub truncate">
                Church administrator · {admin.phoneNumber || admin.email}
              </span>
            </span>
          </div>
          {admin.phoneNumber ? (
            <div className="grid grid-cols-2 gap-2.5">
              <a href={`tel:${admin.phoneNumber}`} className="oc-btn !h-[46px] bg-church-canvas text-church-text">
                <Phone className="w-[18px] h-[18px]" /> Call
              </a>
              <a href={reminderLink(t, i.status) ?? getWhatsAppLink(admin.phoneNumber)} target="_blank" rel="noreferrer" className="oc-btn !h-[46px] bg-[#DDF1E4] text-[#0E5A37]">
                <MessageCircle className="w-[18px] h-[18px]" /> WhatsApp
              </a>
            </div>
          ) : (
            <a href={`mailto:${admin.email}`} className="oc-btn !h-[46px] bg-church-canvas text-church-text">
              Email {admin.email}
            </a>
          )}
        </>
      ) : (
        <span className="text-sm text-church-muted">No church administrator login yet.</span>
      )}
    </Card>
  );
  const history = (
    <ListCard title="Payment history">
      {i.status === 'paused' && !i.suspended && (
        <Row
          lead={<Tile icon={AlertTriangle} tone="amber" />}
          title={`${day(i.st.endsAt)} – ${day(new Date(i.st.endsAt.getTime() + 30 * DAY))}`}
          sub="Not paid yet"
          trail={<span className="font-display text-[15px] font-bold text-church-warn whitespace-nowrap">UGX {num(fee)}</span>}
        />
      )}
      {payments.map((p) => (
        <Row
          key={p.id}
          lead={<Tile icon={Coins} tone={METHOD[p.paymentMethod]?.tone ?? 'neutral'} />}
          title={`${day(p.periodStart)} – ${day(p.periodEnd)}`}
          sub={`Paid ${day(paidAt(p))} · ${METHOD[p.paymentMethod]?.label ?? p.paymentMethod}`}
          trail={<span className="font-display text-[15px] font-bold text-church-pos whitespace-nowrap tabular-nums">+UGX {num(Number(p.amount))}</span>}
        />
      ))}
      <Row lead={<Tile icon={Sparkles} tone="lime" />} title="Free trial" sub={`${day(trialStart)} – ${day(new Date(trialStart.getTime() + 7 * DAY))} · 7 days`} trail={<span className="font-display text-[15px] font-bold">UGX 0</span>} />
    </ListCard>
  );

  return (
    <>
      <BackRow label="Churches" onClick={() => navigate('/platform/tenants')} />
      {ident}
      {notice && (
        <p role="status" className={`m-0 px-3.5 py-3 rounded-[14px] text-sm font-medium ${notice.ok ? 'bg-church-posSoft text-[#0E5A37]' : 'bg-church-negSoft text-[#8F1D14]'}`}>
          {notice.msg}
        </p>
      )}
      <div className="md:hidden flex flex-col gap-4">
        {status}
        {actions}
        {contact}
        {history}
      </div>
      <div className="hidden md:flex gap-5 items-start">
        <div className="flex-[3] min-w-0 flex flex-col gap-4">
          {status}
          {history}
        </div>
        <div className="flex-[2] min-w-0 flex flex-col gap-4 sticky top-6">
          {actions}
          {contact}
        </div>
      </div>
      <RecordPaymentSheet
        tenant={t}
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        onDone={(p) => {
          setRecordOpen(false);
          setNotice({ ok: true, msg: `Payment recorded. ${i.name} is paid until ${new Date(p.periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.` });
        }}
      />
    </>
  );
};

/* ── 4. Record a manual payment ──────────────────────────────────────────── */

const RecordPaymentSheet: React.FC<{ tenant: Tenant; open: boolean; onClose: () => void; onDone: (p: SubscriptionPayment) => void }> = ({
  tenant,
  open,
  onClose,
  onDone,
}) => {
  const i = churchInfo(tenant);
  const fee = tenant.monthlyFee || 50000;
  const [method, setMethod] = useState<ManualPaymentMethod>('BANK_TRANSFER');
  const [months, setMonths] = useState(1);
  const [ref, setRef] = useState('');
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const until = useMemo(() => {
    const now = new Date();
    let d = i.status !== 'paused' && i.st.endsAt > now ? new Date(i.st.endsAt) : now;
    for (let k = 0; k < months; k++) {
      const dd = d.getDate();
      d = new Date(d);
      d.setMonth(d.getMonth() + 1);
      if (d.getDate() < dd) d.setDate(0);
    }
    return d;
  }, [i.status, i.st.endsAt, months]);

  const save = async () => {
    if (method !== 'CASH' && !ref.trim()) {
      setError('Enter the bank or transaction reference.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const p = await CouncilService.recordManualPayment(tenant.id, { months, method, referenceNumber: ref.trim(), paidOn });
      setRef('');
      setMonths(1);
      onDone(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the payment.');
    } finally {
      setBusy(false);
    }
  };

  const METHODS: [ManualPaymentMethod, string][] = [
    ['MTN_MOMO', 'MTN'],
    ['AIRTEL_MONEY', 'Airtel'],
    ['BANK_TRANSFER', 'Bank'],
    ['CASH', 'Cash'],
  ];
  return (
    <MobileSheet open={open} onClose={onClose} title="Record a payment" subtitle="For bank transfers, MoMo Pay codes or cash">
      <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[#F6F7F3]">
        <ChurchLogo t={tenant} size={40} />
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[15px] font-semibold truncate">{i.name}</span>
          <span className="oc-sub truncate">
            {i.line} · ref {paymentReference(tenant.slug)}
          </span>
        </span>
        <Badge kind={i.badge[1]}>{i.badge[0]}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Paid with</span>
        <div className="grid grid-cols-4 gap-2">
          {METHODS.map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMethod(v)}
              aria-pressed={method === v}
              className={`h-[46px] rounded-[14px] text-sm font-semibold ${method === v ? 'border-2 border-church-lime bg-[#F1F9E6]' : 'border-[1.5px] border-[#E2E5DF] bg-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Months</span>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="oc-field">
            {Array.from({ length: 12 }, (_, k) => k + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Amount</span>
          <span className="oc-field flex items-center gap-2 bg-church-canvas">
            <span className="text-church-muted text-sm">UGX</span>
            <span className="font-semibold tabular-nums">{num(fee * months)}</span>
          </span>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{method === 'CASH' ? 'Receipt number (optional)' : 'Bank / transaction reference'}</span>
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={method === 'BANK_TRANSFER' ? 'e.g. FT2611200193' : 'e.g. MP261120.1432.A41'} className="oc-field" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Date paid</span>
        <input type="date" value={paidOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaidOn(e.target.value)} className="oc-field" />
      </label>
      <div className="flex justify-between items-center gap-3 px-3.5 py-3 rounded-[14px] bg-[#F1F9E6]">
        <span className="oc-sub !text-[#3E5B2A]">{i.status === 'paused' ? `${i.name} unlocks right away` : 'Adds to the current period'}</span>
        <span className="text-sm font-semibold">Paid until {day(until)}</span>
      </div>
      {error && (
        <p role="alert" className="m-0 px-3.5 py-3 rounded-[14px] bg-church-negSoft text-sm text-[#8F1D14]">
          {error}
        </p>
      )}
      <button type="button" onClick={save} disabled={busy} className="oc-btn-primary w-full disabled:opacity-60">
        {busy ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Record payment &amp; unlock
      </button>
      <button type="button" onClick={onClose} className="self-center text-sm font-semibold text-church-muted pb-1">
        Cancel
      </button>
    </MobileSheet>
  );
};
