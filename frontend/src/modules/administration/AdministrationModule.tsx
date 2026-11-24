import React, { useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  ArrowRight,
  Baby,
  Building2,
  Check,
  ChevronLeft,
  ClipboardList,
  Coins,
  Download,
  FileText,
  Footprints,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Home,
  KeyRound,
  LogOut,
  MessageCircle,
  Phone,
  Plane,
  Receipt,
  RefreshCw,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  Chips,
  DarkCard,
  DarkRow,
  DarkStats,
  EmptyState,
  ListCard,
  MiniBar,
  PageHeader,
  Row,
  SearchField,
  SectionTitle,
  Segment,
  Stats,
  Tile,
  TileTone,
  num,
} from '@/components/ui/kit';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import {
  AttendanceAndMemberService,
  DepartmentService,
  FinanceService,
  PlatformService,
  requisitionAsk,
} from '@/services/churchService';
import {
  DepartmentCode,
  FinanceCategory,
  FinanceType,
  RequisitionStatus,
  UserRole,
  WorkflowStatus,
} from '@/shared/enums';
import { formatDate, getWhatsAppLink, ROLE_LABELS } from '@/shared/formatters';
import { MobileSheet, SelectInput, TextInput } from '@/components/ui/FormControls';
import { HodMoreTab } from '@/components/hod-more/HodMoreTab';
import { SubscriptionPage } from '@/modules/billing/SubscriptionPage';
import { DueBanner } from '@/modules/billing/BillingParts';
import { SubscriptionService } from '@/services/churchService';
import { INSPECT_KEY_BY_CODE } from './insights';
import { SoulsSummaryCard } from '@/modules/tele-pastoring/SoulsWon';
import { churchContributions, churchRequests, ChurchProfilePage, ContributionsPage, InspectDepartmentPage, RequestsPage, teamAttendance, TeamAttendancePage } from './AdminTools';

/* ── shared bits ─────────────────────────────────────────────── */

const short = (n: number) =>
  n >= 1_000_000 ? `${Math.round(n / 10_000) / 100}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${n}`;

const DEPT_META: Record<string, { icon: React.ElementType; tone: TileTone; to: string; dot: string }> = {
  [DepartmentCode.FINANCE]: { icon: Wallet, tone: 'amber', to: '/finance/collections', dot: '#A15C00' },
  [DepartmentCode.BACENTA]: { icon: Home, tone: 'lime', to: '/bacentas/hod', dot: '#2F5D10' },
  [DepartmentCode.AIRPORT_STARS]: { icon: Plane, tone: 'blue', to: '/airport-stars/checkin', dot: '#1D4E7A' },
  [DepartmentCode.TELE_PASTORING]: { icon: HeartPulse, tone: 'violet', to: '/tele-pastoring/absentees', dot: '#55307F' },
  [DepartmentCode.CHILDRENS_CHURCH]: { icon: Baby, tone: 'rose', to: '/children/checkin', dot: '#8A2B33' },
  [DepartmentCode.CAMPUSES]: { icon: GraduationCap, tone: 'indigo', to: '/campuses/hod', dot: '#33397F' },
  [DepartmentCode.ADMIN]: { icon: Users, tone: 'neutral', to: '/admin/overview', dot: '#18231C' },
};
const DEPT_SHORT: Record<string, string> = {
  [DepartmentCode.FINANCE]: 'Finance',
  [DepartmentCode.BACENTA]: 'Bacentas',
  [DepartmentCode.AIRPORT_STARS]: 'Airport Stars',
  [DepartmentCode.TELE_PASTORING]: 'Tele Pastoring',
  [DepartmentCode.CHILDRENS_CHURCH]: 'Children’s Church',
  [DepartmentCode.CAMPUSES]: 'Campuses',
  [DepartmentCode.ADMIN]: 'Administration',
};
const DEPT_ORDER = [
  DepartmentCode.FINANCE,
  DepartmentCode.BACENTA,
  DepartmentCode.AIRPORT_STARS,
  DepartmentCode.TELE_PASTORING,
  DepartmentCode.CHILDRENS_CHURCH,
  DepartmentCode.CAMPUSES,
];

/* ── 1. Overview ─────────────────────────────────────────────── */

const AdminOverviewTab: React.FC = () => {
  useChurchStoreRefresh();
  const { user, tenant, activeTenantId } = useAuth();
  const navigate = useNavigate();
  const currency = tenant?.currency || 'UGX';
  const subState = SubscriptionService.getState(tenant);

  const trend = AttendanceAndMemberService.getAttendancePercentageTrend(activeTenantId, 5);
  const members = AttendanceAndMemberService.getMembers(activeTenantId);
  const departments = DepartmentService.getDepartments(activeTenantId);
  const requisitions = DepartmentService.getRequisitions(activeTenantId);
  const workplans = DepartmentService.getWorkplans(activeTenantId);
  const txs = FinanceService.getTransactions(activeTenantId);

  const latest = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const delta = latest && prev ? Math.round(latest.percentage - prev.percentage) : 0;
  const avg = trend.length ? Math.round(trend.reduce((t, x) => t + x.percentage, 0) / trend.length) : 0;

  const pendingReqs = requisitions.filter((r) => r.status === RequisitionStatus.PENDING_ADMIN);
  const pendingWps = workplans.filter((w) => w.status === WorkflowStatus.SUBMITTED);
  const waiting = pendingReqs.length + pendingWps.length;
  const deptName = (id: string) => {
    const d = departments.find((x) => x.id === id);
    return d ? DEPT_SHORT[d.code] ?? d.name : '';
  };

  const collected = txs.filter((t) => t.type === FinanceType.INCOME).reduce((s, t) => s + t.amount, 0);
  const spent = txs.filter((t) => t.type === FinanceType.EXPENSE).reduce((s, t) => s + t.amount, 0);
  const spentPct = collected ? Math.round((spent / collected) * 100) : 0;

  const attendanceCard = (
    <Card>
      <SectionTitle title="Service attendance" aside={`Last ${trend.length} services`} />
      {latest && (
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="oc-num text-[28px]">
            {latest.checkedIn} of {latest.eligibleMembers}
          </span>
          {prev && (
            <span className={`text-[13px] font-semibold ${delta >= 0 ? 'text-church-pos' : 'text-church-neg'}`}>
              {delta >= 0 ? 'Up' : 'Down'} {Math.abs(delta)} pts on {formatDate(prev.date).replace(/\s\d{4}$/, '')}
            </span>
          )}
        </div>
      )}
      <div className="flex items-end gap-2 h-[120px]">
        {trend.map((t, i) => {
          const last = i === trend.length - 1;
          return (
            <div key={t.serviceId} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1.5" title={t.title}>
              <span className="text-xs font-bold text-church-muted tabular-nums">{Math.round(t.percentage)}%</span>
              <span
                className={`w-full rounded-[10px] ${last ? 'bg-church-lime' : 'bg-church-forest'}`}
                style={{ height: `${Math.max(8, t.percentage * 0.85)}%` }}
              />
              <span className="text-xs text-church-muted whitespace-nowrap">{formatDate(t.date).replace(/\s\d{4}$/, '')}</span>
            </div>
          );
        })}
      </div>
      <div className="pt-3 border-t border-church-line">
        <Stats
          items={[
            { label: 'Members', value: members.length },
            { label: 'Avg attendance', value: `${avg}%` },
            { label: 'Children', value: latest?.childrenCount ?? 0 },
          ]}
        />
      </div>
    </Card>
  );

  const approvalsCard = (
    <DarkCard
      eyebrow="Waiting on you"
      title={waiting ? `${waiting} request${waiting === 1 ? '' : 's'} need${waiting === 1 ? 's' : ''} your approval` : 'You’re all caught up'}
      onClick={() => navigate('/admin/approvals')}
    >
      {pendingReqs.slice(0, 2).map((r) => (
        <div key={r.id} className="flex items-center gap-3 p-3 rounded-[14px] bg-white/[0.07]">
          <FileText className="w-[18px] h-[18px] text-church-lime shrink-0" />
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-sm font-semibold text-white truncate">{r.title}</span>
            <span className="text-xs text-church-mist truncate">
              {deptName(r.departmentId)} · {r.requisitionNumber}
            </span>
          </span>
          <span className="oc-num text-[15px] text-white">{short(requisitionAsk(r))}</span>
        </div>
      ))}
      {pendingWps.slice(0, 2).map((w) => (
        <div key={w.id} className="flex items-center gap-3 p-3 rounded-[14px] bg-white/[0.07]">
          <ClipboardList className="w-[18px] h-[18px] text-church-lime shrink-0" />
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-sm font-semibold text-white truncate">{w.title}</span>
            <span className="text-xs text-church-mist truncate">
              {deptName(w.departmentId)} · {w.monthLabel}
            </span>
          </span>
          <span className="oc-num text-[15px] text-white">{short(w.totalRequested - w.deptContributionAmount)}</span>
        </div>
      ))}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          navigate('/admin/approvals');
        }}
        className="oc-btn-primary self-start !h-12"
      >
        Review approvals
      </button>
    </DarkCard>
  );

  const moneyCard = (
    <Card>
      <div className="flex items-baseline justify-between">
        <h2 className="oc-h2">Money this month</h2>
        <button type="button" onClick={() => navigate('/admin/finance')} className="text-sm font-semibold text-church-emerald">
          Finance ›
        </button>
      </div>
      <Stats
        items={[
          { label: 'Collected', value: short(collected), color: '#116B43' },
          { label: 'Spent', value: short(spent) },
          { label: 'Net', value: short(collected - spent) },
        ]}
      />
      <div className="flex flex-col gap-1.5">
        <div className="h-2 rounded bg-church-line">
          <div className="h-2 rounded bg-church-forest" style={{ width: `${Math.min(100, spentPct)}%` }} />
        </div>
        <span className="text-xs text-church-muted">
          {spentPct}% of this month’s income spent · {currency}
        </span>
      </div>
    </Card>
  );

  const deptGrid = (
    <div className="flex flex-col gap-3">
      <SectionTitle title="Departments" aside="Tap to inspect" />
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5 md:gap-3">
        {DEPT_ORDER.map((code) => {
          const m = DEPT_META[code];
          return (
            <button
              key={code}
              type="button"
              onClick={() => navigate(`/admin/inspect/${INSPECT_KEY_BY_CODE[code]}`)}
              className="oc-press text-left flex flex-col gap-3 p-4 rounded-[20px] bg-white"
            >
              <Tile icon={m.icon} tone={m.tone} size={36} />
              <span className="text-[15px] font-semibold">{DEPT_SHORT[code]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Church overview"
        subtitle={`${(tenant?.name ?? '').replace(/^1000 Micro Church\s*[—-]\s*/, '')} · services, money and approvals at a glance.`}
      />
      {user?.role === UserRole.ADMIN && tenant && !tenant.setupCompletedAt && (
        <button
          type="button"
          onClick={() => navigate('/setup')}
          className="oc-press w-full text-left flex items-center gap-3.5 px-4 py-3.5 rounded-[20px] bg-church-limeSoft text-[#1F4A08]"
        >
          <span className="w-10 h-10 rounded-[14px] bg-church-lime text-church-forest flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[15px] font-bold">Finish setting up {tenant.shortName || tenant.name}</span>
            <span className="text-[13px] opacity-85">Check church details, add department heads &amp; activate your 7-day free trial</span>
          </span>
          <ArrowRight className="w-5 h-5 shrink-0" />
        </button>
      )}
      {subState?.phase === 'due' && <DueBanner state={subState} onClick={() => navigate('/admin/subscription')} />}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 items-start">
        <div className="lg:col-span-3 flex flex-col gap-4">
          {attendanceCard}
          <div className="hidden lg:block">{deptGrid}</div>
        </div>
        <div className="lg:col-span-2 flex flex-col gap-4">
          {approvalsCard}
          {moneyCard}
          <SoulsSummaryCard tenantId={activeTenantId} />
        </div>
        <div className="lg:hidden">{deptGrid}</div>
      </div>
    </>
  );
};

/* ── 1b. Approvals ───────────────────────────────────────────── */

const AdminApprovalsView: React.FC = () => {
  useChurchStoreRefresh();
  const { tenant, activeTenantId } = useAuth();
  const navigate = useNavigate();
  const currency = tenant?.currency || 'UGX';
  const departments = DepartmentService.getDepartments(activeTenantId);
  const requisitions = DepartmentService.getRequisitions(activeTenantId);
  const workplans = DepartmentService.getWorkplans(activeTenantId);
  const [tab, setTab] = useState<'reqs' | 'wps' | 'done'>('reqs');

  const pendingReqs = requisitions.filter((r) => r.status === RequisitionStatus.PENDING_ADMIN);
  const pendingWps = workplans.filter((w) => w.status === WorkflowStatus.SUBMITTED);
  const doneReqs = requisitions.filter((r) => r.status !== RequisitionStatus.PENDING_ADMIN && r.status !== RequisitionStatus.DRAFT);
  const doneWps = workplans.filter((w) => w.status !== WorkflowStatus.SUBMITTED && w.status !== WorkflowStatus.DRAFT);
  const deptName = (id: string) => {
    const d = departments.find((x) => x.id === id);
    return d ? DEPT_SHORT[d.code] ?? d.name : '';
  };
  const statusBadge = (st: string) =>
    st === 'APPROVED' ? (
      <Badge kind="ok">Approved</Badge>
    ) : st === 'PAID' ? (
      <Badge kind="ok">Paid</Badge>
    ) : st === 'REJECTED' ? (
      <Badge kind="bad">Rejected</Badge>
    ) : (
      <Badge kind="warn">Pending</Badge>
    );

  const line = (left: string, right: string, key: React.Key) => (
    <div key={key} className="flex justify-between gap-3 py-2 border-t border-church-line text-sm">
      <span className="text-church-muted">{left}</span>
      <span className="font-display font-semibold tabular-nums whitespace-nowrap">{right}</span>
    </div>
  );

  const reqCard = (r: (typeof requisitions)[number], actions: boolean) => (
    <Card key={r.id}>
      <div className="flex justify-between gap-2.5">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="oc-sub">
            {deptName(r.departmentId)} · {r.requisitionNumber}
          </span>
          <span className="font-display text-[17px] font-semibold leading-snug">{r.title}</span>
        </div>
        {statusBadge(r.status)}
      </div>
      <div>{r.items.map((it, i) => line(`${it.quantity}× ${it.description}`, `${currency} ${num(it.quantity * it.unitCost)}`, i))}</div>
      {Number(r.deptContributionAmount || 0) > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-church-muted">Requisition total</span>
            <span className="font-display font-semibold tabular-nums">
              {currency} {short(r.totalAmount)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-church-muted">{deptName(r.departmentId)} contributes</span>
            <span className="font-display font-semibold tabular-nums text-church-pos">
              − {currency} {short(Number(r.deptContributionAmount))}
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t border-church-line">
            <span className="oc-sub">Asking Administration for</span>
            <span className="oc-num text-[22px]">
              {currency} {short(requisitionAsk(r))}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-baseline">
          <span className="oc-sub">Requisition total</span>
          <span className="oc-num text-[22px]">
            {currency} {short(r.totalAmount)}
          </span>
        </div>
      )}
      {r.rejectionReason && <p className="m-0 px-3 py-2.5 rounded-xl bg-church-negSoft text-sm text-[#8F1D14]">{r.rejectionReason}</p>}
      {actions && (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => DepartmentService.reviewRequisition(r.id, RequisitionStatus.REJECTED, 'Please revise quantities and resubmit.')}
            className="oc-btn !h-12 bg-church-canvas text-church-text"
          >
            Reject
          </button>
          <button type="button" onClick={() => DepartmentService.reviewRequisition(r.id, RequisitionStatus.APPROVED)} className="oc-btn-primary !h-12">
            <Check className="w-[18px] h-[18px]" /> Approve
          </button>
        </div>
      )}
    </Card>
  );

  const wpCard = (w: (typeof workplans)[number], actions: boolean) => {
    const net = w.totalRequested - w.deptContributionAmount;
    return (
      <Card key={w.id}>
        <div className="flex justify-between gap-2.5">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="oc-sub">
              {deptName(w.departmentId)} · {w.monthLabel}
            </span>
            <span className="font-display text-[17px] font-semibold leading-snug">{w.title}</span>
          </div>
          {statusBadge(w.status)}
        </div>
        <div>{w.items.map((it, i) => line(`${it.quantity}× ${it.itemName}`, `${currency} ${num(it.totalCost)}`, i))}</div>
        {w.deptContributionAmount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-church-muted">Team contribution</span>
            <span className="font-semibold text-church-pos">−{num(w.deptContributionAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline">
          <span className="oc-sub">Workplan total</span>
          <span className="oc-num text-[22px]">
            {currency} {short(net)}
          </span>
        </div>
        {actions && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => DepartmentService.reviewWorkplan(w.id, WorkflowStatus.REJECTED, 0, 'Please revise and resubmit.')}
              className="oc-btn !h-12 bg-church-canvas text-church-text"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => DepartmentService.reviewWorkplan(w.id, WorkflowStatus.APPROVED, net, 'Approved by Administration.')}
              className="oc-btn-primary !h-12"
            >
              <Check className="w-[18px] h-[18px]" /> Approve
            </button>
          </div>
        )}
      </Card>
    );
  };

  const list =
    tab === 'reqs'
      ? pendingReqs.map((r) => reqCard(r, true))
      : tab === 'wps'
        ? pendingWps.map((w) => wpCard(w, true))
        : [...doneReqs.map((r) => reqCard(r, false)), ...doneWps.map((w) => wpCard(w, false))];

  return (
    <>
      <PageHeader
        eyebrow={
          <button type="button" onClick={() => navigate('/admin/overview')} className="inline-flex items-center gap-1 font-semibold text-church-emerald">
            <ChevronLeft className="w-4 h-4" /> Overview
          </button>
        }
        title="Approvals"
        subtitle="Department requests waiting on Administration."
      />
      <Chips
        items={[
          { value: 'reqs', label: 'Requisitions', count: pendingReqs.length },
          { value: 'wps', label: 'Workplans', count: pendingWps.length },
          { value: 'done', label: 'Done' },
        ]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />
      {list.length === 0 ? (
        <EmptyState icon={Check} title={tab === 'done' ? 'Nothing decided yet' : 'Nothing waiting'} sub={tab === 'done' ? undefined : 'You’re all caught up.'} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 items-start">{list}</div>
      )}
    </>
  );
};

/* ── 2. Members ──────────────────────────────────────────────── */

const AdminMembersAndServicesTab: React.FC = () => {
  useChurchStoreRefresh();
  const { activeTenantId } = useAuth();

  const [mode, setMode] = useState<'members' | 'by-service'>('members');
  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const members = AttendanceAndMemberService.getMembers(activeTenantId);
  const allAtt = AttendanceAndMemberService.getServiceAttendance(activeTenantId);
  const allKidsAtt = AttendanceAndMemberService.getChildAttendance(activeTenantId);

  const [pickedServiceId, setPickedServiceId] = useState(services[0]?.id || '');
  const activeServiceId = pickedServiceId || services[0]?.id || '';
  const pickedService = services.find((s) => s.id === activeServiceId) ?? null;

  const q = search.trim().toLowerCase();
  const filteredMembers = members.filter(
    (m) => !q || m.fullName.toLowerCase().includes(q) || m.phoneNumber.includes(q) || m.residence.toLowerCase().includes(q)
  );
  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;

  const serviceAttList = allAtt.filter((a) => a.serviceId === activeServiceId);
  const serviceCheckedSet = new Set(serviceAttList.map((a) => a.memberId));
  const serviceKidsCount = allKidsAtt.filter((ca) => ca.serviceId === activeServiceId).length;
  const pctFor = (mid: string) =>
    services.length ? Math.round((allAtt.filter((a) => a.memberId === mid).length / services.length) * 100) : 0;
  const prettyPhone = (p: string) => p.replace(/^\+?256(\d{3})(\d{3})(\d{3})$/, '+256 $1 $2 $3');

  const exportServiceAttendance = () => {
    if (!pickedService) return;
    const rows = members.map((m) => ({
      'Member Name': m.fullName,
      Phone: m.phoneNumber,
      Gender: m.gender,
      Residence: m.residence,
      Status: serviceCheckedSet.has(m.id) ? 'PRESENT' : 'ABSENT',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Service Attendance');
    XLSX.writeFile(wb, `${pickedService.title}-${pickedService.serviceDate}.xlsx`);
  };

  /* Member detail page */
  if (selectedMember) {
    const attendedCount = allAtt.filter((a) => a.memberId === selectedMember.id).length;
    const pct = pctFor(selectedMember.id);
    return (
      <>
        <div>
          <button type="button" onClick={() => setSelectedMemberId(null)} className="inline-flex items-center gap-2.5 text-sm text-church-muted">
            <span className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-church-text">
              <ChevronLeft className="w-5 h-5" />
            </span>
            Members
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 items-start">
          <Card className="lg:col-span-2 !gap-4">
            <div className="flex items-center gap-3.5">
              <Avatar name={selectedMember.fullName} size={56} />
              <span className="min-w-0 flex flex-col gap-0.5">
                <span className="font-display text-2xl font-bold leading-tight">{selectedMember.fullName}</span>
                <span className="oc-sub">
                  {prettyPhone(selectedMember.phoneNumber)} · {selectedMember.residence}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <a href={`tel:${selectedMember.phoneNumber}`} className="oc-btn !h-12 bg-church-canvas text-church-text no-underline">
                <Phone className="w-[18px] h-[18px]" /> Call
              </a>
              <a
                href={getWhatsAppLink(selectedMember.phoneNumber)}
                target="_blank"
                rel="noreferrer"
                className="oc-btn !h-12 bg-church-posSoft text-[#0E5A37] no-underline"
              >
                <MessageCircle className="w-[18px] h-[18px]" /> WhatsApp
              </a>
            </div>
            <div className="pt-3 border-t border-church-line">
              <Stats
                items={[
                  { label: 'Attendance', value: `${pct}%`, color: pct >= 75 ? '#116B43' : pct >= 50 ? '#A15C00' : '#B42318' },
                  { label: 'Services', value: `${attendedCount} of ${services.length}` },
                  { label: 'Area', value: selectedMember.residence },
                ]}
              />
            </div>
          </Card>
          <section className="lg:col-span-3 bg-white rounded-card px-4">
            <div className="pt-3.5 pb-1 flex items-baseline justify-between">
              <h2 className="oc-h2">Service history</h2>
              <span className="oc-sub">Newest first</span>
            </div>
            <div className="divide-y divide-church-line">
              {services.map((srv) => {
                const attended = allAtt.some((a) => a.serviceId === srv.id && a.memberId === selectedMember.id);
                return (
                  <div key={srv.id} className="flex items-center gap-3 py-3">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${attended ? 'bg-church-pos' : 'bg-church-border'}`} />
                    <span className="flex-1 min-w-0 flex flex-col">
                      <span className="text-[15px] font-semibold truncate">{srv.title}</span>
                      <span className="oc-sub">{formatDate(srv.serviceDate)}</span>
                    </span>
                    {attended ? <Badge kind="ok">Present</Badge> : <Badge kind="bad">Absent</Badge>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Members"
        subtitle={`${members.length} members · attendance across the last ${services.length} services.`}
        actions={
          mode === 'by-service' ? (
            <button type="button" onClick={exportServiceAttendance} className="oc-btn-ghost">
              <Download className="w-[18px] h-[18px]" /> Export
            </button>
          ) : undefined
        }
      />
      <div className="max-w-md w-full">
        <Segment
          options={[
            { value: 'members', label: 'History' },
            { value: 'by-service', label: 'By service' },
          ]}
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
        />
      </div>

      {mode === 'members' ? (
        <>
          <SearchField value={search} onChange={setSearch} placeholder="Search name, phone or area" />
          {filteredMembers.length === 0 ? (
            <EmptyState icon={Users} title={`No one called “${search}”`} />
          ) : (
            <ListCard>
              {filteredMembers.map((m) => (
                <Row
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  lead={<Avatar name={m.fullName} />}
                  title={m.fullName}
                  sub={`${prettyPhone(m.phoneNumber)} · ${m.residence}`}
                  trail={
                    <span className="w-[92px] sm:w-40 shrink-0">
                      <MiniBar pct={pctFor(m.id)} />
                    </span>
                  }
                />
              ))}
            </ListCard>
          )}
        </>
      ) : (
        <>
          <Chips
            items={services.map((s) => ({ value: s.id, label: `${s.title.replace(/^Sunday\s/, 'Sun ')} · ${formatDate(s.serviceDate).replace(/\s\d{4}$/, '')}` }))}
            value={activeServiceId}
            onChange={setPickedServiceId}
          />
          <Card>
            <Stats
              items={[
                { label: 'Adults', value: `${serviceAttList.length} of ${members.length}` },
                { label: 'Attendance', value: `${members.length ? Math.round((serviceAttList.length / members.length) * 100) : 0}%`, color: '#116B43' },
                { label: 'Children', value: serviceKidsCount },
              ]}
            />
          </Card>
          <ListCard>
            {members.map((m) => (
              <Row
                key={m.id}
                lead={<Avatar name={m.fullName} />}
                title={m.fullName}
                sub={`${prettyPhone(m.phoneNumber)} · ${m.residence}`}
                trail={serviceCheckedSet.has(m.id) ? <Badge kind="ok">Present</Badge> : <Badge kind="bad">Absent</Badge>}
              />
            ))}
          </ListCard>
        </>
      )}
    </>
  );
};

/* ── 3. Finance ──────────────────────────────────────────────── */

const AdminFinanceOversightTab: React.FC = () => {
  useChurchStoreRefresh();
  const { tenant, activeTenantId } = useAuth();
  const currency = tenant?.currency || 'UGX';

  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const departments = DepartmentService.getDepartments(activeTenantId);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('ALL');

  const txs = FinanceService.getTransactions(activeTenantId, selectedServiceId === 'ALL' ? null : selectedServiceId);
  const collected = txs.filter((t) => t.type === FinanceType.INCOME).reduce((s, t) => s + t.amount, 0);
  const spent = txs.filter((t) => t.type === FinanceType.EXPENSE).reduce((s, t) => s + t.amount, 0);

  const iconFor = (c: FinanceCategory): [React.ElementType, TileTone] => {
    switch (c) {
      case FinanceCategory.OFFERTORY:
        return [Coins, 'green'];
      case FinanceCategory.TITHE:
        return [HeartHandshake, 'green'];
      case FinanceCategory.PARTNERSHIP:
        return [HeartHandshake, 'green'];
      case FinanceCategory.TELE_REACHOUT_EXPENSE:
        return [Footprints, 'red'];
      default:
        return [Receipt, 'red'];
    }
  };
  const catLabel = (c: string) => c.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (x) => x.toUpperCase());
  const monthName = new Date().toLocaleDateString('en-GB', { month: 'long' });

  return (
    <>
      <PageHeader title="Finance" subtitle="Money in and out, across the church or one service." />
      <Chips
        items={[
          { value: 'ALL', label: 'All services' },
          ...services.map((s) => ({ value: s.id, label: `${s.title.replace(/Micro-Church\s/, '')} · ${formatDate(s.serviceDate).replace(/\s\d{4}$/, '')}` })),
        ]}
        value={selectedServiceId}
        onChange={setSelectedServiceId}
      />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5 items-start">
        <div className="lg:col-span-2 lg:order-last">
          <DarkCard eyebrow={`${selectedServiceId === 'ALL' ? monthName : 'This service'} · ${currency}`} title={`${num(collected - spent)} net balance`}>
            <DarkStats
              items={[
                { label: 'Collected', value: num(collected), accent: true },
                { label: 'Spent', value: num(spent) },
              ]}
            />
          </DarkCard>
        </div>
        <div className="lg:col-span-3">
          {txs.length === 0 ? (
            <EmptyState icon={Receipt} title="No money recorded" />
          ) : (
            <ListCard title="Transactions" aside={currency}>
              {txs.map((tx) => {
                const [I, tone] = iconFor(tx.category);
                const income = tx.type === FinanceType.INCOME;
                const dept = departments.find((d) => d.id === tx.departmentId);
                return (
                  <Row
                    key={tx.id}
                    lead={<Tile icon={I} tone={tone} />}
                    title={tx.description || catLabel(tx.category)}
                    sub={`${dept ? DEPT_SHORT[dept.code] : catLabel(tx.category)} · ${tx.paymentMethod} · ${formatDate(tx.transactionDate).replace(/\s\d{4}$/, '')}`}
                    trail={
                      <span className={`oc-num text-[15px] whitespace-nowrap ${income ? 'text-church-pos' : 'text-church-neg'}`}>
                        {income ? '+' : '−'}
                        {num(tx.amount)}
                      </span>
                    }
                  />
                );
              })}
            </ListCard>
          )}
        </div>
      </div>
    </>
  );
};

/* ── 4. Serving team ─────────────────────────────────────────── */

const AdminServingMembersTab: React.FC = () => {
  useChurchStoreRefresh();
  const { activeTenantId } = useAuth();

  const serving = DepartmentService.getServingMembers(activeTenantId);
  const departments = DepartmentService.getDepartments(activeTenantId);
  const members = AttendanceAndMemberService.getMembers(activeTenantId);
  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const allAtt = AttendanceAndMemberService.getServiceAttendance(activeTenantId);
  const tenantUsers = PlatformService.getUsersForTenant(activeTenantId);
  const [deptFilter, setDeptFilter] = useState('ALL');

  const [assignOpen, setAssignOpen] = useState(false);
  const [memberId, setMemberId] = useState(members[0]?.id || '');
  const [deptId, setDeptId] = useState(departments[0]?.id || '');
  const [servingRole, setServingRole] = useState<'HOD' | 'Coordinator' | 'Member'>('Member');
  const [createLogin, setCreateLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [systemRole, setSystemRole] = useState<UserRole>(UserRole.AIRPORT_MEMBER);

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !deptId) return;
    const m = members.find((x) => x.id === memberId);
    let createdUserId: string | null = null;

    if (createLogin && email.trim() && m) {
      const u = PlatformService.createUser({
        tenantId: activeTenantId,
        fullName: m.fullName,
        email,
        phoneNumber: m.phoneNumber,
        role: systemRole,
        departmentId: deptId,
      });
      createdUserId = u.id;
    }

    DepartmentService.addServingMember({
      tenantId: activeTenantId,
      departmentId: deptId,
      memberId,
      servingRole,
      userId: createdUserId,
    });
    setEmail('');
    setCreateLogin(false);
    setAssignOpen(false);
  };


  const shown = serving.filter((sm) => deptFilter === 'ALL' || sm.departmentId === deptFilter);
  const deptsWithPeople = departments.filter((d) => serving.some((sm) => sm.departmentId === d.id));

  return (
    <>
      <PageHeader
        title="Serving team"
        subtitle={`${serving.length} people serving · ${tenantUsers.length} dashboard logins.`}
        actions={
          <button type="button" onClick={() => setAssignOpen(true)} className="oc-btn-dark">
            <UserPlus className="w-[18px] h-[18px] text-church-lime" /> Add to a team
          </button>
        }
      />
      <Chips
        items={[
          { value: 'ALL', label: 'All', count: serving.length },
          ...deptsWithPeople.map((d) => ({
            value: d.id,
            label: DEPT_SHORT[d.code] ?? d.name,
            count: serving.filter((sm) => sm.departmentId === d.id).length,
          })),
        ]}
        value={deptFilter}
        onChange={setDeptFilter}
      />
      {shown.length === 0 ? (
        <EmptyState icon={Users} title="No one serving here yet" />
      ) : (
        <ListCard>
          {shown.map((sm) => {
            const m = members.find((x) => x.id === sm.memberId);
            if (!m) return null;
            const d = departments.find((x) => x.id === sm.departmentId);
            const meta = d ? DEPT_META[d.code] : undefined;
            const login = tenantUsers.find((u) => u.id === sm.userId);
            const attended = allAtt.filter((a) => a.memberId === m.id).length;
            return (
              <Row
                key={sm.id}
                lead={<Avatar name={m.fullName} />}
                title={m.fullName}
                sub={
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta?.dot ?? '#5C655E' }} />
                    <span className="truncate">
                      {d ? DEPT_SHORT[d.code] ?? d.name : ''}
                      <span className="hidden sm:inline">
                        {' '}
                        · {attended} of {services.length} services{login ? ` · ${login.email}` : ''}
                      </span>
                    </span>
                  </span>
                }
                trail={
                  sm.servingRole === 'HOD' ? (
                    <Badge kind="ink">
                      <span className="text-church-lime">HOD</span>
                    </Badge>
                  ) : sm.servingRole === 'Coordinator' ? (
                    <Badge>Coordinator</Badge>
                  ) : login ? (
                    <span title={`Signs in as ${login.email}`} className="text-church-muted">
                      <KeyRound className="w-[18px] h-[18px]" aria-label="Has a login" />
                    </span>
                  ) : undefined
                }
              />
            );
          })}
        </ListCard>
      )}

      <MobileSheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Add someone to a team"
        subtitle="Link church member to a department & optional dashboard login"
      >
        <form onSubmit={handleAssign} className="space-y-4">
          <SelectInput
            label="Church Member"
            value={memberId}
            onChange={setMemberId}
            options={members.map((m) => ({
              value: m.id,
              label: `${m.fullName} (${m.phoneNumber})`,
            }))}
            required
          />
          <SelectInput
            label="Department"
            value={deptId}
            onChange={setDeptId}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            required
          />
          <SelectInput
            label="Serving Role"
            value={servingRole}
            onChange={(v) => setServingRole(v as 'HOD' | 'Coordinator' | 'Member')}
            options={[
              { value: 'Member', label: 'Department Member' },
              { value: 'Coordinator', label: 'Coordinator / Leader' },
              { value: 'HOD', label: 'Head of Department (HOD)' },
            ]}
          />

          <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-church-soft border border-church-line cursor-pointer">
            <input
              type="checkbox"
              checked={createLogin}
              onChange={(e) => setCreateLogin(e.target.checked)}
              className="w-4 h-4 accent-church-emerald"
            />
            <span className="text-xs font-bold text-church-text">
              Also grant System Dashboard Login
            </span>
          </label>

          {createLogin && (
            <div className="space-y-3 p-3 rounded-2xl bg-church-limeSoft border border-church-limeLine">
              <TextInput
                label="Login Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="worker@openchurch.org"
                required
              />
              <SelectInput
                label="System Role"
                value={systemRole}
                onChange={(v) => setSystemRole(v as UserRole)}
                options={Object.entries(ROLE_LABELS)
                  .filter(([k]) => k !== UserRole.PLATFORM_ADMIN)
                  .map(([value, label]) => ({ value, label }))}
              />
            </div>
          )}

          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Save
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

/* ── 5. More ─────────────────────────────────────────────────── */

const subscriptionSub = (tenant: ReturnType<typeof useAuth>['tenant']): string => {
  const st = SubscriptionService.getState(tenant);
  if (!st) return 'UGX 50,000 a month';
  const d = `${st.daysLeft} day${st.daysLeft === 1 ? '' : 's'}`;
  if (st.isTrial) return `Trial ends in ${d} · UGX ${st.fee.toLocaleString('en-US')}/mo`;
  if (st.phase === 'due') return `Payment due in ${d}`;
  return `Paid until ${formatDate(st.endsAt.toISOString())}`;
};

const AdminMoreView: React.FC = () => {
  useChurchStoreRefresh();
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const tid = tenant?.id ?? '';
  const reqs = tid ? churchRequests(tid) : [];
  const m0 = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const pending = reqs.filter((r) => r.status === 'Pending').length;
  const approved = reqs.filter((r) => (r.status === 'Approved' || r.status === 'Paid') && new Date(r.at) >= m0).length;
  const given = tid ? churchContributions(tid, m0).reduce((a, c) => a + Number(c.amount), 0) : 0;
  const team = tid ? teamAttendance(tid) : null;
  const short = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 10_000) / 100}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${n}`);
  const tools: { label: string; sub: string; icon: React.ElementType; to: string }[] = [
    { label: 'Requisitions & workplans', sub: `${pending} pending · ${approved} approved this month`, icon: FileText, to: '/admin/requests' },
    { label: 'Contributions', sub: `UGX ${short(given)} from all teams this month`, icon: Coins, to: '/admin/contributions' },
    { label: 'Team & duty', sub: team ? `${team.pct}% team attendance · ${team.people.length} serving` : 'Who serves, who’s on duty', icon: Users, to: '/admin/team' },
    ...(user?.role === UserRole.ADMIN ? [{ label: 'Church profile', sub: 'Name, logo, contact & location', icon: Building2, to: '/admin/profile' }] : []),
    { label: 'Subscription', sub: subscriptionSub(tenant), icon: Wallet, to: '/admin/subscription' },
  ];
  const toolList = (
    <div className="flex flex-col gap-3">
      <SectionTitle title="Administration tools" />
      <ListCard>
        {tools.map((t) => (
          <Row key={t.label} onClick={() => navigate(t.to)} lead={<Tile icon={t.icon} />} title={t.label} sub={t.sub} chevron />
        ))}
      </ListCard>
    </div>
  );
  const account = (
    <div className="flex flex-col gap-3">
      <SectionTitle title="Account" />
      <ListCard>
        <Row
          onClick={() => {
            logout();
            navigate('/login');
          }}
          lead={<Tile icon={LogOut} tone="red" />}
          title="Sign out"
          sub={user?.email}
        />
      </ListCard>
    </div>
  );
  return (
    <>
      <PageHeader title="More" subtitle="Administration tools. Departments are on Overview." />
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 lg:gap-5 items-start">
        {toolList}
        {account}
      </div>
    </>
  );
};

export const AdministrationModule: React.FC = () => {
  return (
    <Routes>
      <Route path="overview" element={<AdminOverviewTab />} />
      <Route path="approvals" element={<AdminApprovalsView />} />
      <Route path="members" element={<AdminMembersAndServicesTab />} />
      <Route path="finance" element={<AdminFinanceOversightTab />} />
      <Route path="serving" element={<AdminServingMembersTab />} />
      <Route path="more" element={<AdminMoreView />} />
      <Route path="subscription" element={<SubscriptionPage />} />
      <Route path="inspect/:key" element={<InspectDepartmentPage />} />
      <Route path="requests" element={<RequestsPage />} />
      <Route path="contributions" element={<ContributionsPage />} />
      <Route path="team" element={<TeamAttendancePage />} />
      <Route path="profile" element={<ChurchProfilePage />} />
      <Route path="tools" element={<HodMoreTab departmentCode={DepartmentCode.ADMIN} />} />
      <Route path="*" element={<Navigate to="overview" replace />} />
    </Routes>
  );
};
