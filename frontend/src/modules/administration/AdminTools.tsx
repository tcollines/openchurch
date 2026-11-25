import React, { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  Baby,
  Check,
  ClipboardList,
  Coins,
  FileText,
  GraduationCap,
  HeartPulse,
  Home,
  Phone,
  Plane,
  Send,
  UserPlus,
  Users,
  Wallet,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import { readStore, requisitionAsk } from '@/services/churchService';
import { DepartmentCode, RequisitionStatus, WorkflowStatus } from '@/shared/enums';
import { Avatar, Badge, BadgeKind, Card, Chips, EmptyState, ListCard, MiniBar, num, PageHeader, Row, Stats, Tile, TileTone } from '@/components/ui/kit';
import { BackRow } from '@/modules/platform/CouncilPages';
import { EditStep } from '@/modules/setup/SetupPage';
import { Activity, DEPT_DASHBOARD, INSPECT_KEYS, inspectDepartment } from './insights';

const short = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 10_000) / 100}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${Math.round(n)}`);
const day = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const monthStart = (offset = 0) => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth() + offset, 1);
};
const monthName = (d = new Date()) => d.toLocaleDateString('en-GB', { month: 'long' });

export const DEPT_LOOK: Record<string, { icon: React.ElementType; tone: TileTone; label: string }> = {
  [DepartmentCode.FINANCE]: { icon: Wallet, tone: 'amber', label: 'Finance' },
  [DepartmentCode.BACENTA]: { icon: Home, tone: 'lime', label: 'Bacentas' },
  [DepartmentCode.AIRPORT_STARS]: { icon: Plane, tone: 'blue', label: 'Airport Stars' },
  [DepartmentCode.TELE_PASTORING]: { icon: HeartPulse, tone: 'violet', label: 'Tele Pastoring' },
  [DepartmentCode.CHILDRENS_CHURCH]: { icon: Baby, tone: 'rose', label: 'Children’s Church' },
  [DepartmentCode.CAMPUSES]: { icon: GraduationCap, tone: 'indigo', label: 'Campuses' },
  [DepartmentCode.DISCIPLESHIP]: { icon: BookOpen, tone: 'violet', label: 'Discipleship' },
  [DepartmentCode.ADMIN]: { icon: Users, tone: 'neutral', label: 'Administration' },
};

const Eyebrow: React.FC<{ text: string; aside?: React.ReactNode }> = ({ text, aside }) => (
  <span className="flex items-center gap-2">
    <span className="w-7 h-[3px] rounded-sm bg-church-lime" />
    <span className="text-[13px] font-semibold text-[#C9F08A] flex-1">{text}</span>
    {aside && <span className="text-xs text-church-mist truncate max-w-[50%]">{aside}</span>}
  </span>
);
const DarkStat: React.FC<{ label: string; value: React.ReactNode; color?: string }> = ({ label, value, color = '#FFFFFF' }) => (
  <div className="rounded-[14px] bg-white/[0.07] px-3 py-2.5 flex flex-col gap-0.5 min-w-0">
    <span className="text-xs text-church-mist truncate">{label}</span>
    <span className="font-display text-[19px] font-bold truncate tabular-nums" style={{ color }}>
      {value}
    </span>
  </div>
);
const Dark: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="bg-church-forest text-[#EEF5E9] rounded-[24px] p-5 flex flex-col gap-3.5">{children}</section>
);

/* ── Inspect a department ────────────────────────────────────────────────── */

const ACT_ICON: Record<Activity['kind'], React.ElementType> = {
  money: Coins,
  meeting: Home,
  outreach: Send,
  checkin: Plane,
  call: Phone,
  request: FileText,
  kids: Baby,
  class: BookOpen,
};

/** Progress along the discipleship track: early stages aren't "bad", so no red. */
const TrackBar: React.FC<{ pct: number }> = ({ pct }) => (
  <span className="flex items-center gap-2 w-24 shrink-0">
    <span className="flex-1 h-1.5 rounded-full bg-church-line overflow-hidden">
      <span className={`block h-full ${pct >= 100 ? 'bg-church-pos' : 'bg-church-emerald'}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </span>
    <span className="w-9 text-right font-display text-[13px] font-bold tabular-nums">{pct}%</span>
  </span>
);

export const InspectDepartmentPage: React.FC = () => {
  useChurchStoreRefresh();
  const { key = '' } = useParams();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const code = INSPECT_KEYS[key];
  if (!code) return <Navigate to="/admin/overview" replace />;
  const d = tenant ? inspectDepartment(tenant.id, code) : null;
  const look = DEPT_LOOK[code];
  const back = <BackRow label="Overview" onClick={() => navigate('/admin/overview')} />;
  if (!d) {
    return (
      <>
        {back}
        <EmptyState icon={look.icon} title={`${look.label} isn’t set up yet`} />
      </>
    );
  }
  const balance = d.contributed - d.spent;
  const spentPct = d.contributed ? Math.min(100, Math.round((d.spent / d.contributed) * 100)) : d.spent ? 100 : 0;
  const open = () => navigate(DEPT_DASHBOARD[code]);

  const summary = (
    <Dark>
      <Eyebrow text={`This month · ${monthName()}`} aside={d.head ? `Head: ${d.head}` : 'No head yet'} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <DarkStat label={d.activityLabel} value={d.activityCount} />
        <DarkStat label={d.attendanceLabel} value={d.attendance === null ? '—' : `${d.attendance}%`} color="#A3E635" />
        {d.track ? (
          <>
            <DarkStat label="Enrolled" value={d.track.enrolled + d.track.inProgress + d.track.completed} />
            <DarkStat label="Completed" value={d.track.completed} color="#A3E635" />
          </>
        ) : (
          <>
            <DarkStat label="Contributed" value={`UGX ${short(d.contributed)}`} color="#A3E635" />
            <DarkStat label="Spent" value={`UGX ${short(d.spent)}`} color="#FCD9A0" />
          </>
        )}
      </div>
    </Dark>
  );
  const attendance = (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <span className="oc-h2">Attendance</span>
        <span className="oc-sub">{d.attendanceLabel}</span>
      </div>
      <div className="flex items-baseline gap-2 -mt-1">
        <span className="oc-num text-[24px]">{d.attendance === null ? '—' : `${d.attendance}%`}</span>
        <span className="oc-sub">average</span>
      </div>
      {d.bars.length ? (
        <div role="img" aria-label={`Attendance for the last ${d.bars.length} weeks`} className="flex items-end gap-2.5 h-[116px]">
          {d.bars.map((b, i) => (
            <div key={b.label + i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <span className="font-display text-[11px] font-semibold text-church-muted">{b.pct}%</span>
              <span
                className={`w-full rounded-t-lg rounded-b ${i === d.bars.length - 1 ? 'bg-church-lime' : 'bg-church-forest'}`}
                style={{ height: Math.max(8, Math.round(b.pct * 0.8)) }}
              />
              <span className="oc-sub !text-xs truncate max-w-full">{b.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <span className="oc-sub">No attendance recorded yet.</span>
      )}
      <span className="oc-sub pt-2.5 border-t border-church-line">{d.attendanceNote}</span>
    </Card>
  );
  const t = d.track;
  const total = t ? t.enrolled + t.inProgress + t.completed : 0;
  const share = (n: number) => (total ? `${(n / total) * 100}%` : '0%');
  const money = t ? (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <span className="oc-h2">Discipleship track</span>
        <span className="oc-sub">{t.target} classes to complete</span>
      </div>
      <Stats
        items={[
          { label: 'Enrolled', value: t.enrolled },
          { label: 'In progress', value: t.inProgress, color: '#2F6B0A' },
          { label: 'Completed', value: t.completed, color: '#116B43' },
        ]}
      />
      <div className="flex flex-col gap-1.5">
        <div role="img" aria-label={`${t.completed} completed, ${t.inProgress} in progress, ${t.enrolled} not started`} className="flex h-2.5 rounded-[5px] overflow-hidden bg-church-line">
          <div className="bg-church-pos" style={{ width: share(t.completed) }} />
          <div className="bg-church-lime" style={{ width: share(t.inProgress) }} />
        </div>
        <span className="oc-sub">{total ? `${t.completed} of ${total} enrolled have finished the track` : 'No one enrolled yet'}</span>
      </div>
    </Card>
  ) : (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <span className="oc-h2">Money</span>
        <span className="oc-sub">UGX · {monthName()}</span>
      </div>
      <Stats
        items={[
          { label: 'Contributed', value: short(d.contributed), color: '#116B43' },
          { label: 'Spent', value: short(d.spent) },
          { label: 'Balance', value: `${balance < 0 ? '−' : ''}${short(Math.abs(balance))}`, color: balance < 0 ? '#B42318' : '#116B43' },
        ]}
      />
      <div className="flex flex-col gap-1.5">
        <div role="img" aria-label={`${spentPct} percent of contributions spent`} className="h-2.5 rounded-[5px] bg-church-line">
          <div className="h-2.5 rounded-[5px] bg-church-forest" style={{ width: `${spentPct}%` }} />
        </div>
        <span className="oc-sub">
          {d.contributed ? `${spentPct}% of what the team contributed has been spent` : d.spent ? 'Spending this month with no team contributions yet' : 'Nothing contributed or spent this month'}
        </span>
      </div>
    </Card>
  );
  const activity = (
    <ListCard title="Recent activity">
      {d.activity.length ? (
        d.activity.map((a, i) => {
          const Icon = ACT_ICON[a.kind];
          return (
            <Row
              key={a.title + i}
              lead={<Tile icon={Icon} />}
              title={a.title}
              sub={a.sub}
              trail={a.amount ? <span className="font-display text-[15px] font-bold whitespace-nowrap tabular-nums">{short(a.amount)}</span> : undefined}
            />
          );
        })
      ) : (
        <p className="py-4 oc-sub">Nothing recorded yet.</p>
      )}
    </ListCard>
  );
  const people = (
    <ListCard title={d.peopleTitle} aside={d.peopleAside ?? 'Attendance'}>
      {d.people.length ? (
        d.people.slice(0, 8).map((p, i) => (
          <Row key={p.name + i} lead={<Avatar name={p.name} />} title={p.name} sub={p.sub} trail={t ? <TrackBar pct={p.pct} /> : <MiniBar pct={p.pct} />} />
        ))
      ) : (
        <p className="py-4 oc-sub">{t ? 'No one enrolled yet.' : 'No team members yet.'}</p>
      )}
    </ListCard>
  );

  return (
    <>
      {back}
      <div className="flex items-center gap-3">
        <Tile icon={look.icon} tone={look.tone} size={52} />
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="font-display text-2xl md:text-[30px] leading-[1.15] font-bold tracking-[-0.015em]">{look.label}</span>
          <span className="oc-sub">
            {d.team} serving{d.head ? ` · head: ${d.head}` : ''} · inspect only
          </span>
        </span>
        <button type="button" onClick={open} className="hidden md:inline-flex oc-btn-ghost">
          <ArrowRight className="w-5 h-5" /> Open dashboard
        </button>
      </div>
      {summary}
      <div className="md:hidden flex flex-col gap-4">
        {attendance}
        {money}
        {activity}
        {people}
        <button type="button" onClick={open} className="oc-btn-ghost w-full">
          <ArrowRight className="w-5 h-5" /> Open {look.label} dashboard
        </button>
      </div>
      <div className="hidden md:flex gap-5 items-start">
        <div className="flex-[3] min-w-0 flex flex-col gap-4">
          {attendance}
          {activity}
        </div>
        <div className="flex-[2] min-w-0 flex flex-col gap-4">
          {money}
          {people}
        </div>
      </div>
    </>
  );
};

/* ── Shared: request & contribution data for the More tab ────────────────── */

type ReqRow = { id: string; title: string; sub: string; kind: 'Requisition' | 'Workplan'; amount: number; status: 'Pending' | 'Approved' | 'Paid' | 'Rejected'; at: string };

export const churchRequests = (tenantId: string): ReqRow[] => {
  const db = readStore();
  const dept = new Map(db.departments.filter((d) => d.tenantId === tenantId).map((d) => [d.id, d]));
  const dname = (id: string) => DEPT_LOOK[dept.get(id)?.code ?? '']?.label ?? dept.get(id)?.name ?? 'Department';
  const reqs: ReqRow[] = db.requisitions
    .filter((r) => r.tenantId === tenantId && r.status !== RequisitionStatus.DRAFT)
    .map((r) => ({
      id: r.id,
      title: r.title,
      sub: `${dname(r.departmentId)} · ${r.requisitionNumber}`,
      kind: 'Requisition',
      amount: requisitionAsk(r),
      status:
        r.status === RequisitionStatus.PENDING_ADMIN ? 'Pending' : r.status === RequisitionStatus.PAID ? 'Paid' : r.status === RequisitionStatus.APPROVED ? 'Approved' : 'Rejected',
      at: r.requestedAt || r.createdAt,
    }));
  const wps: ReqRow[] = db.workplans
    .filter((w) => w.tenantId === tenantId && w.status !== WorkflowStatus.DRAFT)
    .map((w) => ({
      id: w.id,
      title: w.title || `${w.monthLabel} workplan`,
      sub: `${dname(w.departmentId)} · ${w.monthLabel}`,
      kind: 'Workplan',
      amount: Number(w.status === WorkflowStatus.APPROVED && w.totalApproved ? w.totalApproved : w.totalRequested),
      status: w.status === WorkflowStatus.SUBMITTED ? 'Pending' : w.status === WorkflowStatus.APPROVED ? 'Approved' : 'Rejected',
      at: w.createdAt,
    }));
  return [...reqs, ...wps].sort((a, b) => (a.status === 'Pending' ? -1 : 0) - (b.status === 'Pending' ? -1 : 0) || b.at.localeCompare(a.at));
};

export const churchContributions = (tenantId: string, from: Date, to?: Date) =>
  readStore().deptContributions.filter((c) => {
    if (c.tenantId !== tenantId) return false;
    const d = new Date(c.contributionDate);
    return d >= from && (!to || d < to);
  });

export const teamAttendance = (tenantId: string) => {
  const db = readStore();
  const services = db.services
    .filter((s) => s.tenantId === tenantId && new Date(s.serviceDate) <= new Date())
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
  const last = services.slice(0, 5);
  const prev = services.slice(5, 10);
  const team = db.servingMembers.filter((s) => s.tenantId === tenantId);
  const members = new Map(db.members.filter((m) => m.tenantId === tenantId).map((m) => [m.id, m]));
  const depts = new Map(db.departments.filter((d) => d.tenantId === tenantId).map((d) => [d.id, d]));
  const served = (memberId: string, deptId: string, list: typeof services) =>
    list.filter((s) => db.serviceAttendance.some((a) => a.serviceId === s.id && a.memberId === memberId && a.isServingCheckin && a.servingDepartmentId === deptId)).length;
  const people = team.map((t) => {
    const n = served(t.memberId, t.departmentId, last);
    return {
      id: t.id,
      name: members.get(t.memberId)?.fullName ?? 'Team member',
      deptCode: depts.get(t.departmentId)?.code ?? '',
      role: t.servingRole,
      served: n,
      of: last.length,
      pct: last.length ? Math.round((n / last.length) * 100) : 0,
    };
  });
  const slots = team.length * last.length;
  const filled = people.reduce((a, p) => a + p.served, 0);
  const prevSlots = team.length * prev.length;
  const prevFilled = team.reduce((a, t) => a + served(t.memberId, t.departmentId, prev), 0);
  const pctNow = slots ? Math.round((filled / slots) * 100) : 0;
  const pctPrev = prevSlots ? Math.round((prevFilled / prevSlots) * 100) : null;
  const latest = last[0];
  const onDuty = latest
    ? new Set(db.serviceAttendance.filter((a) => a.serviceId === latest.id && a.isServingCheckin).map((a) => a.memberId)).size
    : 0;
  return {
    people: people.sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name)),
    pct: pctNow,
    change: pctPrev === null ? null : pctNow - pctPrev,
    slots,
    filled,
    services: last.length,
    latest,
    onDuty,
    missed: people.filter((p) => p.of - p.served >= 2).length,
  };
};

/* ── More → Requisitions & workplans ─────────────────────────────────────── */

const STATUS_KIND: Record<ReqRow['status'], BadgeKind> = { Pending: 'warn', Approved: 'ok', Paid: 'ok', Rejected: 'bad' };
type ReqFilter = 'all' | 'Pending' | 'Approved' | 'Rejected';

export const RequestsPage: React.FC = () => {
  useChurchStoreRefresh();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const [filter, setFilter] = useState<ReqFilter>('all');
  const rows = tenant ? churchRequests(tenant.id) : [];
  const m0 = monthStart();
  const thisMonth = rows.filter((r) => new Date(r.at) >= m0);
  const sum = (rs: ReqRow[]) => rs.reduce((a, r) => a + r.amount, 0);
  const pending = rows.filter((r) => r.status === 'Pending');
  const approved = thisMonth.filter((r) => r.status === 'Approved' || r.status === 'Paid');
  const paid = thisMonth.filter((r) => r.status === 'Paid');
  const rejected = thisMonth.filter((r) => r.status === 'Rejected');
  const shown = rows.filter((r) => filter === 'all' || (filter === 'Approved' ? r.status === 'Approved' || r.status === 'Paid' : r.status === filter));
  const row = (r: ReqRow) => (
    <Row
      key={r.kind + r.id}
      onClick={r.status === 'Pending' ? () => navigate('/admin/approvals') : undefined}
      lead={<Tile icon={r.kind === 'Requisition' ? FileText : ClipboardList} />}
      title={r.title}
      sub={r.sub}
      trail={
        <span className="flex flex-col items-end gap-1">
          <span className="font-display text-[15px] font-bold whitespace-nowrap tabular-nums">{short(r.amount)}</span>
          <Badge kind={STATUS_KIND[r.status]}>{r.status}</Badge>
        </span>
      }
    />
  );

  return (
    <>
      <BackRow label="More" onClick={() => navigate('/admin/more')} />
      <PageHeader
        title="Requisitions & workplans"
        subtitle="What departments asked for, and where each request stands."
        actions={
          pending.length ? (
            <button type="button" onClick={() => navigate('/admin/approvals')} className="hidden md:inline-flex oc-btn-primary">
              <Check className="w-5 h-5" /> Review {pending.length} pending
            </button>
          ) : undefined
        }
      />
      <Dark>
        <Eyebrow text={`${monthName()} · all departments`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <DarkStat label="Pending" value={`${pending.length} · UGX ${short(sum(pending))}`} color="#FCD9A0" />
          <DarkStat label="Approved" value={`${approved.length} · UGX ${short(sum(approved))}`} color="#A3E635" />
          <DarkStat label="Paid out" value={`${paid.length} · UGX ${short(sum(paid))}`} />
          <DarkStat label="Rejected" value={`${rejected.length} · UGX ${short(sum(rejected))}`} color="#A9B8AC" />
        </div>
        {pending.length > 0 && (
          <button type="button" onClick={() => navigate('/admin/approvals')} className="md:hidden self-start oc-btn !h-11 !px-4 !text-[15px] bg-church-lime text-church-forest">
            Review {pending.length} pending <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </Dark>
      <Chips<ReqFilter>
        items={[
          { value: 'all', label: 'All', count: rows.length },
          { value: 'Pending', label: 'Pending', count: pending.length },
          { value: 'Approved', label: 'Approved', count: rows.filter((r) => r.status === 'Approved' || r.status === 'Paid').length },
          { value: 'Rejected', label: 'Rejected', count: rows.filter((r) => r.status === 'Rejected').length },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {shown.length ? <ListCard>{shown.map(row)}</ListCard> : <EmptyState icon={FileText} title="Nothing here" sub="Requests from departments appear here." />}
    </>
  );
};

/* ── More → Contributions ────────────────────────────────────────────────── */

type Period = 'month' | 'last' | 'year';

export const ContributionsPage: React.FC = () => {
  useChurchStoreRefresh();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  if (!tenant) return null;
  const db = readStore();
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const [from, to, pFrom, pTo] =
    period === 'month'
      ? [monthStart(), undefined, monthStart(-1), monthStart()]
      : period === 'last'
        ? [monthStart(-1), monthStart(), monthStart(-2), monthStart(-1)]
        : [yearStart, undefined, new Date(yearStart.getFullYear() - 1, 0, 1), yearStart];
  const list = churchContributions(tenant.id, from, to).sort((a, b) => b.contributionDate.localeCompare(a.contributionDate));
  const prevTotal = churchContributions(tenant.id, pFrom, pTo).reduce((a, c) => a + Number(c.amount), 0);
  const total = list.reduce((a, c) => a + Number(c.amount), 0);
  const change = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
  const team = db.servingMembers.filter((s) => s.tenantId === tenant.id);
  const givers = new Set(list.map((c) => c.memberId));
  const teamIds = new Set(team.map((t) => t.memberId));
  const members = new Map(db.members.filter((m) => m.tenantId === tenant.id).map((m) => [m.id, m]));
  const depts = db.departments.filter((d) => d.tenantId === tenant.id);
  const byDept = depts
    .map((d) => {
      const cs = list.filter((c) => c.departmentId === d.id);
      const size = team.filter((t) => t.departmentId === d.id).length;
      return { d, total: cs.reduce((a, c) => a + Number(c.amount), 0), gave: new Set(cs.map((c) => c.memberId)).size, size };
    })
    .filter((x) => x.total > 0 || x.size > 0)
    .sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...byDept.map((x) => x.total));
  const label = period === 'month' ? monthName() : period === 'last' ? monthName(monthStart(-1)) : String(new Date().getFullYear());
  const deptName = (id: string) => DEPT_LOOK[depts.find((d) => d.id === id)?.code ?? '']?.label ?? 'Department';

  const card = (
    <Dark>
      <Eyebrow text={`Team contributions · ${label}`} />
      <span className="font-display text-[40px] leading-none font-bold text-white tracking-[-0.03em] tabular-nums">
        <span className="text-lg text-church-mist tracking-normal">UGX</span> {short(total)}
      </span>
      <div className="grid grid-cols-2 gap-2">
        <DarkStat label="People who gave" value={`${[...givers].filter((g) => teamIds.has(g)).length || givers.size} of ${team.length}`} color="#A3E635" />
        <DarkStat label={period === 'year' ? 'vs last year' : 'vs month before'} value={change === null ? '—' : `${change >= 0 ? '+' : ''}${change}%`} />
      </div>
    </Dark>
  );
  const deptCard = (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <span className="oc-h2">By department</span>
        <span className="oc-sub">UGX</span>
      </div>
      <div className="divide-y divide-church-line">
        {byDept.map(({ d, total: t, gave, size }) => {
          const look = DEPT_LOOK[d.code] ?? DEPT_LOOK[DepartmentCode.ADMIN];
          return (
            <div key={d.id} className="flex items-center gap-3 py-3">
              <Tile icon={look.icon} tone={look.tone} />
              <span className="flex-1 min-w-0 flex flex-col gap-1.5">
                <span className="flex justify-between gap-2">
                  <span className="text-[15px] font-semibold truncate">{look.label}</span>
                  <span className="font-display text-[15px] font-bold tabular-nums">{short(t)}</span>
                </span>
                <span className="h-1.5 rounded bg-church-line">
                  <span className="block h-1.5 rounded bg-church-forest" style={{ width: `${Math.round((t / max) * 100)}%` }} />
                </span>
                <span className="oc-sub">
                  {gave} of {size} gave
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
  const recent = (
    <ListCard title="Latest contributions">
      {list.length ? (
        list.slice(0, 8).map((c) => (
          <Row
            key={c.id}
            lead={<Avatar name={members.get(c.memberId)?.fullName ?? '?'} />}
            title={members.get(c.memberId)?.fullName ?? 'Member'}
            sub={`${deptName(c.departmentId)} · ${day(c.contributionDate)}`}
            trail={<span className="font-display text-[15px] font-bold text-church-pos whitespace-nowrap tabular-nums">+{short(Number(c.amount))}</span>}
          />
        ))
      ) : (
        <p className="py-4 oc-sub">No contributions in this period.</p>
      )}
    </ListCard>
  );
  const chips = (
    <Chips<Period>
      items={[
        { value: 'month', label: monthName() },
        { value: 'last', label: monthName(monthStart(-1)) },
        { value: 'year', label: 'This year' },
      ]}
      value={period}
      onChange={setPeriod}
    />
  );
  return (
    <>
      <BackRow label="More" onClick={() => navigate('/admin/more')} />
      <PageHeader title="Contributions" subtitle="What each department’s team has given." />
      <div className="md:hidden flex flex-col gap-4">
        {card}
        {chips}
        {deptCard}
        {recent}
      </div>
      <div className="hidden md:flex gap-5 items-start">
        <div className="flex-[3] min-w-0 flex flex-col gap-4">
          {card}
          {chips}
          {deptCard}
        </div>
        <div className="flex-[2] min-w-0">{recent}</div>
      </div>
    </>
  );
};

/* ── More → Team & duty ──────────────────────────────────────────────────── */

export const TeamAttendancePage: React.FC = () => {
  useChurchStoreRefresh();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const [dept, setDept] = useState<string>('all');
  if (!tenant) return null;
  const a = teamAttendance(tenant.id);
  const codes = [...new Set(a.people.map((p) => p.deptCode))].filter(Boolean);
  const shown = a.people.filter((p) => dept === 'all' || p.deptCode === dept);
  const card = (
    <Dark>
      <Eyebrow text={`Whole team · last ${a.services} service${a.services === 1 ? '' : 's'}`} aside={`${a.people.length} serving`} />
      <span className="flex items-baseline gap-2.5">
        <span className="font-display text-[48px] leading-none font-bold text-white tracking-[-0.03em]">{a.pct}%</span>
        <span className="text-[15px] text-church-mist">team attendance</span>
      </span>
      <div className="flex flex-col gap-1.5">
        <div className="h-2 rounded bg-white/[0.12]">
          <div className="h-2 rounded bg-church-lime" style={{ width: `${a.pct}%` }} />
        </div>
        <span className="text-[13px] text-church-mist">
          {a.filled} of {a.slots} duty slots served
          {a.change !== null ? ` · ${a.change >= 0 ? 'up' : 'down'} ${Math.abs(a.change)} pts on the 5 before` : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DarkStat label={a.latest ? `On duty · ${day(a.latest.serviceDate)}` : 'On duty'} value={`${a.onDuty} of ${a.people.length}`} color="#A3E635" />
        <DarkStat label="Missed 2+ times" value={`${a.missed} ${a.missed === 1 ? 'person' : 'people'}`} color="#FCD9A0" />
      </div>
    </Dark>
  );
  const list = (
    <>
      <Chips<string>
        items={[{ value: 'all', label: 'All', count: a.people.length }, ...codes.map((c) => ({ value: c, label: DEPT_LOOK[c]?.label ?? c, count: a.people.filter((p) => p.deptCode === c).length }))]}
        value={dept}
        onChange={setDept}
      />
      <ListCard title="Each person" aside={`Last ${a.services} services`}>
        {shown.length ? (
          shown.map((p) => (
            <Row key={p.id} lead={<Avatar name={p.name} />} title={p.name} sub={`${DEPT_LOOK[p.deptCode]?.label ?? 'Team'} · ${p.served} of ${p.of}`} trail={<MiniBar pct={p.pct} />} />
          ))
        ) : (
          <p className="py-4 oc-sub">No one serving here yet.</p>
        )}
      </ListCard>
    </>
  );
  const add = (
    <button type="button" onClick={() => navigate('/admin/tools?view=team')} aria-label="Add a member" className="w-11 h-11 md:w-auto md:px-4 rounded-[14px] bg-church-forest text-church-lime md:bg-church-lime md:text-church-forest flex items-center justify-center gap-2 font-semibold oc-press">
      <UserPlus className="w-5 h-5" /> <span className="hidden md:inline">Add a member</span>
    </button>
  );
  return (
    <>
      <BackRow label="More" onClick={() => navigate('/admin/more')} />
      <PageHeader title="Team & duty" subtitle="Attendance for everyone serving." actions={add} />
      <div className="md:hidden flex flex-col gap-4">
        {card}
        {list}
      </div>
      <div className="hidden md:flex gap-5 items-start">
        <div className="flex-[2] min-w-0 sticky top-6">{card}</div>
        <div className="flex-[3] min-w-0 flex flex-col gap-4">{list}</div>
      </div>
    </>
  );
};

/* ── More → Church profile ───────────────────────────────────────────────── */

export const ChurchProfilePage: React.FC = () => {
  useChurchStoreRefresh();
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const [saved, setSaved] = useState(false);
  if (!tenant) return null;
  return (
    <>
      <BackRow label="More" onClick={() => navigate('/admin/more')} />
      <PageHeader title="Church profile" subtitle="Shown to members, on receipts and to the Network Council." />
      {saved && (
        <p role="status" className="m-0 px-3.5 py-3 rounded-[14px] bg-church-posSoft text-sm font-medium text-[#0E5A37]">
          Church profile saved.
        </p>
      )}
      <EditStep
        key={tenant.id + (saved ? '1' : '0')}
        tenant={tenant}
        hideTitle
        saveLabel="Save changes"
        onSaved={() => {
          setSaved(true);
          window.scrollTo({ top: 0 });
        }}
      />
    </>
  );
};
