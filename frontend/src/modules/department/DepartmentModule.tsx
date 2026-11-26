import React from 'react';
import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { BookOpen, ChevronRight, FileText, Receipt } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import { AttendanceAndMemberService, DepartmentService, DiscipleshipService, FinanceService } from '@/services/churchService';
import { DepartmentCode, FinanceType, UserRole, WorkflowStatus } from '@/shared/enums';
import { formatDate } from '@/shared/formatters';
import { customDeptLook } from '@/shared/deptLook';
import { Avatar, Badge, Card, Columns, DarkCard, DarkStats, EmptyState, ListCard, PageHeader, Row, Stats, Tile } from '@/components/ui/kit';
import { HodMoreTab } from '@/components/hod-more/HodMoreTab';
import { DepartmentTeamView } from '@/components/hod-more/DepartmentTeamView';

/* A church's own department (Choir, Ushering, Media…): Overview · Team · More. */

const DAY = 864e5;
const short = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 10_000) / 100}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${Math.round(n)}`);
const monthKey = () => new Date().toISOString().slice(0, 7);
const monthName = () => new Date().toLocaleDateString('en-GB', { month: 'long' });
const nextMonthKey = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return d.toISOString().slice(0, 7);
};

const Steps: React.FC<{ n: number; total: number }> = ({ n, total }) => {
  const segs = Math.min(total, 12);
  const filled = Math.round((Math.min(n, total) / total) * segs);
  const done = n >= total;
  return (
    <span role="img" aria-label={`${n} of ${total} classes`} className="flex items-center gap-2 w-[108px] shrink-0">
      <span className="flex-1 flex gap-[3px]">
        {Array.from({ length: segs }, (_, i) => (
          <span key={i} className={`flex-1 h-1.5 rounded-full ${i < filled ? (done ? 'bg-church-pos' : 'bg-church-lime') : 'bg-church-line'}`} />
        ))}
      </span>
      <span className={`w-8 text-right font-display text-[13px] font-bold tabular-nums ${done ? 'text-church-pos' : 'text-church-emerald'}`}>
        {Math.min(n, total)}/{total}
      </span>
    </span>
  );
};

const useDept = () => {
  useChurchStoreRefresh();
  const { deptId = '' } = useParams();
  const { user, tenant, activeTenantId } = useAuth();
  const dept = DepartmentService.getDepartmentById(deptId);
  return { deptId, dept, user, tenant, tenantId: activeTenantId };
};

/* ── Overview ───────────────────────────────────────────────────────────── */

const OverviewView: React.FC = () => {
  const { deptId, dept, tenant, tenantId } = useDept();
  if (!dept || dept.tenantId !== tenantId) return <EmptyState icon={FileText} title="This department isn’t set up" sub="Ask the church Administrator to check it." />;
  const currency = tenant?.currency || 'UGX';
  const look = customDeptLook(dept);
  const base = `/dept/${deptId}`;
  const mk = monthKey();
  const today = new Date().toISOString().slice(0, 10);

  // Team and their service attendance
  const team = DepartmentService.getServingMembers(tenantId, deptId);
  const teamIds = new Set(team.map((t) => t.memberId));
  const members = new Map(AttendanceAndMemberService.getMembers(tenantId).map((m) => [m.id, m]));
  const services = AttendanceAndMemberService.getServices(tenantId)
    .filter((s) => s.serviceDate.slice(0, 10) <= today)
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
  const att = AttendanceAndMemberService.getServiceAttendance(tenantId).filter((a) => teamIds.has(a.memberId));
  const presentAt = (serviceId: string) => new Set(att.filter((a) => a.serviceId === serviceId).map((a) => a.memberId)).size;
  const last5 = services.slice(0, 5).reverse();
  const bars = last5.map((s) => ({ s, n: presentAt(s.id), pct: team.length ? Math.round((presentAt(s.id) / team.length) * 100) : 0 }));
  const avg = bars.length ? Math.round(bars.reduce((a, b) => a + b.pct, 0) / bars.length) : null;
  const servicesThisMonth = services.filter((s) => s.serviceDate.startsWith(mk)).length;
  const lastSeen = (memberId: string) => {
    const dates = att.filter((a) => a.memberId === memberId).map((a) => services.find((s) => s.id === a.serviceId)?.serviceDate ?? '').filter(Boolean).sort();
    return dates[dates.length - 1] ?? null;
  };
  const away = team.filter((t) => {
    const ls = lastSeen(t.memberId);
    return !ls || Date.now() - new Date(ls).getTime() > 21 * DAY;
  }).length;
  const latest = bars[bars.length - 1];

  // Money
  const contributed = DepartmentService.getDeptContributions(tenantId, deptId)
    .filter((c) => c.contributionDate.startsWith(mk))
    .reduce((a, c) => a + c.amount, 0);
  const expenses = FinanceService.getTransactions(tenantId)
    .filter((t) => t.type === FinanceType.EXPENSE && t.departmentId === deptId && t.transactionDate.startsWith(mk))
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  const spent = expenses.reduce((a, t) => a + t.amount, 0);
  const balance = contributed - spent;
  const spentPct = contributed ? Math.min(100, Math.round((spent / contributed) * 100)) : spent ? 100 : 0;

  // Workplans: this month and next
  const workplans = DepartmentService.getWorkplans(tenantId, deptId);
  const thisWp = workplans.find((w) => w.monthLabel === mk) ?? null;
  const nextWp = workplans.find((w) => w.monthLabel === nextMonthKey()) ?? null;
  const used = DepartmentService.getRequisitions(tenantId, deptId)
    .filter((r) => thisWp && r.workplanId === thisWp.id)
    .reduce((a, r) => a + Number(r.amountPaid || 0), 0);
  const budget = thisWp ? thisWp.totalApproved || thisWp.totalRequested : 0;
  const statusBadge = (s: WorkflowStatus) =>
    s === WorkflowStatus.APPROVED ? <Badge kind="ok">Approved</Badge> : s === WorkflowStatus.REJECTED ? <Badge kind="bad">Rejected</Badge> : s === WorkflowStatus.SUBMITTED ? <Badge kind="warn">With Admin</Badge> : <Badge>Draft</Badge>;

  // Team members in discipleship
  const disc = DiscipleshipService.progress(tenantId).filter((p) => teamIds.has(p.enrollment.memberId) && p.member);
  const discDone = disc.filter((p) => p.stage === 'COMPLETED').length;

  const summary = (
    <DarkCard eyebrow={`This month · ${monthName()}`} action={<span className="text-xs text-[#A9B8AC]">{team.length} serving</span>}>
      <DarkStats
        cols={2}
        items={[
          { label: 'Team attendance', value: avg === null ? '—' : `${avg}%`, accent: true },
          { label: 'Services', value: servicesThisMonth },
          { label: 'Contributed', value: `${currency} ${short(contributed)}`, accent: true },
          { label: 'Spent', value: `${currency} ${short(spent)}` },
        ]}
      />
    </DarkCard>
  );

  const attendance = (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="oc-h2">Team attendance</h2>
        <span className="oc-sub">Last {bars.length} services</span>
      </div>
      {bars.length === 0 || team.length === 0 ? (
        <p className="m-0 oc-sub">{team.length ? 'Shows here after the first service.' : 'Add your team first, from the Team tab.'}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 -mt-1.5">
            <span className="oc-num text-[26px]">{avg}%</span>
            <span className="oc-sub">average</span>
          </div>
          <div role="img" aria-label={`Team attendance for the last ${bars.length} services, average ${avg} percent`} className="flex items-end gap-2.5 h-[116px]">
            {bars.map((b, i) => (
              <div key={b.s.id} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                <span className="font-display text-[11px] font-semibold text-church-muted">{b.pct}%</span>
                <span className={`w-full rounded-t-lg rounded-b ${i === bars.length - 1 ? 'bg-church-lime' : 'bg-church-forest'}`} style={{ height: Math.max(6, Math.round(b.pct * 0.8)) }} title={b.s.title} />
                <span className="oc-sub !text-xs truncate max-w-full">{formatDate(b.s.serviceDate).replace(/,? \d{4}$/, '')}</span>
              </div>
            ))}
          </div>
          <span className="oc-sub pt-2.5 border-t border-church-line">
            {latest ? `${latest.n} of ${team.length} served at ${latest.s.title}` : ''}
            {away ? ` · ${away} not seen in 3 weeks` : ''}
          </span>
        </>
      )}
    </Card>
  );

  const money = (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="oc-h2">Money this month</h2>
        <Link to={`${base}/more?section=contributions`} className="text-sm font-semibold text-church-emerald inline-flex items-center gap-0.5">
          Contributions <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <Stats
        items={[
          { label: 'Contributed', value: short(contributed), color: '#116B43' },
          { label: 'Spent', value: short(spent) },
          { label: 'Balance', value: `${balance < 0 ? '−' : ''}${short(Math.abs(balance))}`, color: balance < 0 ? '#B42318' : '#116B43' },
        ]}
      />
      <div className="flex flex-col gap-1.5">
        <div role="img" aria-label={`${spentPct} percent of contributions spent`} className="h-2.5 rounded-[5px] bg-church-line">
          <div className="h-2.5 rounded-[5px] bg-church-forest" style={{ width: `${spentPct}%` }} />
        </div>
        <span className="oc-sub">
          {contributed ? `${spentPct}% of what the team contributed has been spent · ${currency}` : spent ? 'Spending this month with no team contributions yet' : 'Nothing contributed or spent this month'}
        </span>
      </div>
    </Card>
  );

  const workplanCard = (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="oc-h2">Workplans</h2>
        <Link to={`${base}/more?section=workplans`} className="text-sm font-semibold text-church-emerald inline-flex items-center gap-0.5">
          All <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      {thisWp ? (
        <div className="flex flex-col gap-2 -mt-1">
          <div className="flex items-center gap-2.5">
            <span className="flex-1 text-[15px] font-semibold truncate">{thisWp.title || `${monthName()} workplan`}</span>
            {statusBadge(thisWp.status)}
          </div>
          {budget > 0 && (
            <>
              <div className="flex justify-between oc-sub">
                <span>
                  {currency} {used.toLocaleString('en-US')} used
                </span>
                <span>of {budget.toLocaleString('en-US')} budget</span>
              </div>
              <div role="img" aria-label={`${Math.round((used / budget) * 100)} percent of budget used`} className="h-2 rounded-full bg-church-line overflow-hidden">
                <div className="h-full rounded-full bg-church-emerald" style={{ width: `${Math.min(100, Math.round((used / budget) * 100))}%` }} />
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="m-0 oc-sub -mt-1">No workplan for {monthName()} yet. Plan the month so Administration can approve funds.</p>
      )}
      {nextWp && (
        <Link to={`${base}/more?section=workplans`} className="flex items-center gap-2.5 min-h-[52px] pt-2 border-t border-church-line">
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[15px] font-semibold truncate">{nextWp.title || 'Next month'}</span>
            <span className="oc-sub">{nextWp.items.length} items</span>
          </span>
          {statusBadge(nextWp.status)}
          <ChevronRight className="w-[18px] h-[18px] text-church-faint" />
        </Link>
      )}
    </Card>
  );

  const discCard = (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="oc-h2">In discipleship classes</h2>
        <span className="oc-sub">Team members</span>
      </div>
      <div className="flex items-center gap-3 -mt-1">
        <Tile icon={BookOpen} tone="violet" />
        <span className="flex-1 flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">
            {disc.length} of {team.length} {disc.length === 1 ? 'is' : 'are'} in discipleship
          </span>
          <span className="oc-sub">{disc.length ? `${discDone} completed · ${disc.length - discDone} in progress` : 'No one from the team is enrolled yet'}</span>
        </span>
      </div>
      {disc.length > 0 && (
        <div className="divide-y divide-church-line border-t border-church-line">
          {disc
            .sort((a, b) => b.attended - a.attended)
            .slice(0, 6)
            .map((p) => (
              <div key={p.enrollment.id} className="flex items-center gap-3 min-h-[56px]">
                <Avatar name={p.member!.fullName} size={36} />
                <span className="flex-1 min-w-0 text-[15px] font-semibold truncate">{p.member!.fullName}</span>
                <Steps n={p.attended} total={p.target} />
              </div>
            ))}
        </div>
      )}
    </Card>
  );

  const spentList = (
    <ListCard
      title="Spent this month"
      aside={
        <Link to={`${base}/more?section=requisitions`} className="text-sm font-semibold text-church-emerald inline-flex items-center gap-0.5">
          Requisitions <ChevronRight className="w-4 h-4" />
        </Link>
      }
    >
      {expenses.length ? (
        expenses.slice(0, 6).map((t) => (
          <Row
            key={t.id}
            lead={<Tile icon={Receipt} tone="amber" />}
            title={t.description || 'Payout'}
            sub={`${formatDate(t.transactionDate)} · ${t.paymentMethod}`}
            trail={<span className="oc-num text-base">{short(t.amount)}</span>}
          />
        ))
      ) : (
        <p className="py-4 oc-sub">No payouts this month.</p>
      )}
    </ListCard>
  );

  const who = (
    <ListCard title="Who’s serving" aside={<span className="oc-sub">Last 5 services</span>}>
      {team.length ? (
        team
          .map((t) => {
            const m = members.get(t.memberId);
            const n = last5.filter((s) => att.some((a) => a.serviceId === s.id && a.memberId === t.memberId)).length;
            return { t, m, pct: last5.length ? Math.round((n / last5.length) * 100) : 0 };
          })
          .filter((x) => x.m)
          .sort((a, b) => b.pct - a.pct)
          .slice(0, 6)
          .map(({ t, m, pct }) => (
            <Row
              key={t.id}
              lead={<Avatar name={m!.fullName} />}
              title={m!.fullName}
              sub={t.servingRole}
              trail={
                <span className="flex items-center gap-2 w-[96px] shrink-0">
                  <span className="flex-1 h-1.5 rounded-full bg-church-line overflow-hidden">
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 75 ? '#116B43' : pct >= 50 ? '#A15C00' : '#B42318' }} />
                  </span>
                  <span className="w-9 text-right font-display text-[13px] font-bold tabular-nums">{pct}%</span>
                </span>
              }
            />
          ))
      ) : (
        <p className="py-4 oc-sub">No one on the team yet.</p>
      )}
    </ListCard>
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <span className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center shrink-0" style={{ background: look.bg, color: look.fg }}>
          <look.icon className="w-6 h-6" />
        </span>
        <PageHeader title={dept.name} subtitle={dept.description || 'How your department is doing this month.'} />
      </div>
      <Columns
        sideFirst
        side={
          <>
            {summary}
            {discCard}
          </>
        }
        main={
          <>
            {attendance}
            {money}
            {workplanCard}
            {spentList}
            {who}
          </>
        }
      />
    </>
  );
};

/* ── Module ─────────────────────────────────────────────────────────────── */

const DeptTeam: React.FC = () => {
  const { deptId } = useDept();
  return <DepartmentTeamView departmentCode={DepartmentCode.CUSTOM} departmentId={deptId} />;
};
const DeptMore: React.FC = () => {
  const { deptId } = useDept();
  return <HodMoreTab departmentCode={DepartmentCode.CUSTOM} departmentId={deptId} />;
};

export const DepartmentModule: React.FC = () => {
  const { user } = useAuth();
  const { deptId = '' } = useParams();
  // Heads and team members only ever open their own department.
  const own = user?.role === UserRole.DEPT_HOD || user?.role === UserRole.DEPT_MEMBER;
  if (own && user?.departmentId && deptId !== user.departmentId) return <Navigate to={`/dept/${user.departmentId}/overview`} replace />;
  const hodOnly = (el: React.ReactElement) => (user?.role === UserRole.DEPT_MEMBER ? <Navigate to="overview" replace /> : el);
  return (
    <Routes>
      <Route path="overview" element={<OverviewView />} />
      <Route path="team" element={hodOnly(<DeptTeam />)} />
      <Route path="more" element={hodOnly(<DeptMore />)} />
      <Route path="*" element={<Navigate to="overview" replace />} />
    </Routes>
  );
};
