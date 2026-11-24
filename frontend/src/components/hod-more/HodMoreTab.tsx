import { useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Coins,
  FileText,
  GraduationCap,
  HeartHandshake,
  Home,
  Lock,
  LogOut,
  Megaphone,
  MessageCircle,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  Receipt,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  Chips,
  Columns,
  ContactButtons,
  DarkCard,
  DarkRow,
  DarkStats,
  EmptyState,
  KpiGrid,
  ListCard,
  MiniBar,
  PageHeader,
  PickerRow,
  Row,
  SearchField,
  SectionTitle,
  Segment,
  Stats,
  Tile,
  num,
} from '@/components/ui/kit';
import { DepartmentTeamView } from './DepartmentTeamView';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import {
  AttendanceAndMemberService,
  DepartmentService,
  FinanceService,
  AccountabilityService,
  requisitionAsk,
} from '@/services/churchService';
import { Requisition } from '@/shared/types';
import { AccountabilitySection, AccountabilitySheet, BlockedSheet } from './RequisitionFlow';
import { DepartmentCode, FinanceType, UserRole } from '@/shared/enums';
import {
  formatCurrency,
  formatDate,
  getWhatsAppLink,
  isHodUser,
} from '@/shared/formatters';
import {
  DateInput,
  KpiCard,
  MobileSheet,
  NumberInput,
  SelectInput,
  StatusBadge,
  TextInput,
} from '@/components/ui/FormControls';

type MoreSection = 'requisitions' | 'workplans' | 'contributions' | 'members' | 'accountability';

const DEPT_SHORT: Record<string, string> = {
  [DepartmentCode.ADMIN]: 'Administration',
  [DepartmentCode.FINANCE]: 'Finance',
  [DepartmentCode.BACENTA]: 'Bacentas',
  [DepartmentCode.AIRPORT_STARS]: 'Airport Stars',
  [DepartmentCode.TELE_PASTORING]: 'Tele Pastoring',
  [DepartmentCode.CHILDRENS_CHURCH]: 'Children’s Church',
  [DepartmentCode.CAMPUSES]: 'Campuses',
};

type Extra = { label: string; sub: string; icon: React.ElementType; tone: 'amber' | 'blue' | 'lime' | 'violet' | 'green' | 'rose' | 'indigo' | 'red'; to: string };
const DEPT_EXTRAS: Partial<Record<DepartmentCode, Extra[]>> = {
  [DepartmentCode.FINANCE]: [
    { label: 'Service collections', sub: 'Offertory, tithe and partnership', icon: Coins, tone: 'amber', to: '/finance/collections' },
    { label: 'Partners', sub: 'Pledges and giving history', icon: HeartHandshake, tone: 'lime', to: '/finance/partners' },
    { label: 'Pay-out queue', sub: 'Approved requisitions waiting', icon: Receipt, tone: 'red', to: '/finance/outflows' },
  ],
  [DepartmentCode.BACENTA]: [
    { label: 'Bacentas & leaders', sub: 'Each leader sees only their bacenta', icon: Home, tone: 'lime', to: '/bacentas/hod' },
    { label: 'All reports', sub: 'Meetings and outreaches, newest first', icon: Megaphone, tone: 'violet', to: '/bacentas/hod' },
  ],
  [DepartmentCode.CAMPUSES]: [
    { label: 'Campuses & leaders', sub: 'Institutions, leaders, meeting days', icon: GraduationCap, tone: 'indigo', to: '/campuses/hod' },
    { label: 'Outreach reports', sub: 'Hostels, lecture halls, fellowships', icon: Megaphone, tone: 'violet', to: '/campuses/hod' },
  ],
  [DepartmentCode.AIRPORT_STARS]: [
    { label: 'Services', sub: 'Create services and see past ones', icon: CalendarDays, tone: 'blue', to: '/airport-stars/checkin' },
    { label: 'Team & duty', sub: 'Who’s on duty at the door', icon: Users, tone: 'lime', to: '/airport-stars/attendance' },
  ],
  [DepartmentCode.TELE_PASTORING]: [
    { label: 'Absentees', sub: 'Members who missed 3 in a row', icon: PhoneCall, tone: 'violet', to: '/tele-pastoring/absentees' },
    { label: 'Souls pipeline', sub: 'Who’s in week 1, 2, 3, 4', icon: Sparkles, tone: 'lime', to: '/tele-pastoring/souls' },
  ],
  [DepartmentCode.CHILDRENS_CHURCH]: [
    { label: 'Child safety', sub: 'Guardian check-out and alerts', icon: ShieldCheck, tone: 'green', to: '/children/checkin' },
    { label: 'Follow-up', sub: 'Children who missed 3 services', icon: PhoneCall, tone: 'rose', to: '/children/followup' },
  ],
};

export const HodMoreTab: React.FC<{ departmentCode: DepartmentCode }> = ({
  departmentCode,
}) => {
  useChurchStoreRefresh();
  const { user, tenant, activeTenantId, logout } = useAuth();
  const navigate = useNavigate();
  const currency = tenant?.currency || 'UGX';

  const [section, setSection] = useState<MoreSection | null>(null);
  const [teamView, setTeamView] = useState(() => new URLSearchParams(window.location.search).get('view') === 'team');
  const [reqSheetOpen, setReqSheetOpen] = useState(false);
  const [wpSheetOpen, setWpSheetOpen] = useState(false);
  const [contrSheetOpen, setContrSheetOpen] = useState(false);
  const [memberSheetOpen, setMemberSheetOpen] = useState(false);

  // Guard: strictly accessible only to HODs and Admins
  if (!user || (!isHodUser(user) && user.role !== UserRole.PLATFORM_ADMIN)) {
    return (
      <div className="p-6 bg-white rounded-card border-transparent text-center">
        <p className="text-sm font-bold text-church-neg">
          Restricted: Only Heads of Department (HODs) and Church Administrators can access this tab.
        </p>
      </div>
    );
  }

  const department = DepartmentService.getDepartmentByCode(activeTenantId, departmentCode);
  const deptId = department?.id || '';

  const requisitions = DepartmentService.getRequisitions(activeTenantId, deptId);
  const workplans = DepartmentService.getWorkplans(activeTenantId, deptId);
  const contributions = DepartmentService.getDeptContributions(activeTenantId, deptId);
  const servingMembers = DepartmentService.getServingMembers(activeTenantId, deptId);
  const allMembers = AttendanceAndMemberService.getMembers(activeTenantId);
  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const allAttendance = AttendanceAndMemberService.getServiceAttendance(activeTenantId);

  const totalContributed = contributions.reduce((s, c) => s + c.amount, 0);
  const totalBudgetApproved = workplans.reduce((s, w) => s + w.totalApproved, 0);
  const totalReqPaid = requisitions.reduce((s, r) => s + r.amountPaid, 0);

  // ── Form States ──
  // 1. Requisition Form
  const [reqTitle, setReqTitle] = useState('');
  const [reqWorkplanId, setReqWorkplanId] = useState('');
  const [reqServiceId, setReqServiceId] = useState('');
  const [reqItems, setReqItems] = useState([
    { description: '', quantity: 1, unitCost: 0 },
  ]);
  const [reqContribution, setReqContribution] = useState(0);
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [blockedBy, setBlockedBy] = useState<Requisition | null>(null);
  const [accountFor, setAccountFor] = useState<Requisition | null>(null);
  const dueAccountability = deptId ? AccountabilityService.dueFor(activeTenantId, deptId) : [];
  const openNewRequisition = () => {
    if (dueAccountability.length) {
      setBlockedBy(dueAccountability[0]);
      return;
    }
    setEditingReqId(null);
    setReqTitle('');
    setReqItems([{ description: '', quantity: 1, unitCost: 0 }]);
    setReqContribution(0);
    setReqSheetOpen(true);
  };
  const openEditRequisition = (r: Requisition) => {
    setEditingReqId(r.id);
    setReqTitle(r.title);
    setReqWorkplanId(r.workplanId || '');
    setReqServiceId(r.serviceId || '');
    setReqItems(r.items.map((i) => ({ ...i })));
    setReqContribution(Number(r.deptContributionAmount || 0));
    setReqSheetOpen(true);
  };
  const editingReq = editingReqId ? requisitions.find((r) => r.id === editingReqId) ?? null : null;
  const reqTotal = reqItems.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  const reqGive = Math.min(reqTotal, Math.max(0, reqContribution || 0));
  const monthKey = new Date().toISOString().slice(0, 7);
  const contributedThisMonth = contributions.filter((c) => c.contributionDate.startsWith(monthKey)).reduce((s, c) => s + c.amount, 0);
  const deptLabel =
    ({ FINANCE: 'Finance', BACENTA: 'Bacentas', AIRPORT_STARS: 'Airport Stars', TELE_PASTORING: 'Tele Pastoring', CHILDRENS_CHURCH: 'Children’s Church', CAMPUSES: 'Campuses', ADMIN: 'Administration' } as Record<string, string>)[departmentCode] ||
    department?.name ||
    'The department';

  // 2. Workplan / Budget Form
  const [wpMonth, setWpMonth] = useState('2026-11');
  const [wpTitle, setWpTitle] = useState('');
  const [wpDeptOffset, setWpDeptOffset] = useState(0);
  const [wpItems, setWpItems] = useState([
    { activity: '', itemName: '', quantity: 1, unitCost: 0 },
  ]);

  // 3. Contribution Form
  const [contrMemberId, setContrMemberId] = useState('');
  const [contrAmount, setContrAmount] = useState(0);
  const [contrPurpose, setContrPurpose] = useState('');
  const [contrMethod, setContrMethod] = useState<'Cash' | 'Mobile Money' | 'Bank Transfer'>('Mobile Money');
  const [contrDate, setContrDate] = useState(() => new Date().toISOString().slice(0, 10));

  // 4. Add Dept Member Form
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [servingRole, setServingRole] = useState<'HOD' | 'Coordinator' | 'Member'>('Member');
  const [dutyServiceId, setDutyServiceId] = useState(services[0]?.id || '');

  const handleCreateRequisition = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = reqItems.filter(
      (i) => i.description.trim() && i.quantity > 0 && i.unitCost > 0
    );
    if (!reqTitle.trim() || validItems.length === 0 || !deptId) return;

    if (editingReqId) {
      DepartmentService.resubmitRequisition(editingReqId, {
        title: reqTitle,
        items: validItems,
        workplanId: reqWorkplanId || null,
        serviceId: reqServiceId || null,
        deptContributionAmount: reqGive,
      });
      setEditingReqId(null);
      setReqTitle('');
      setReqItems([{ description: '', quantity: 1, unitCost: 0 }]);
      setReqContribution(0);
      setReqSheetOpen(false);
      return;
    }
    if (AccountabilityService.dueFor(activeTenantId, deptId).length) {
      setReqSheetOpen(false);
      setBlockedBy(AccountabilityService.dueFor(activeTenantId, deptId)[0]);
      return;
    }
    DepartmentService.createRequisition({
      tenantId: activeTenantId,
      departmentId: deptId,
      workplanId: reqWorkplanId || null,
      serviceId: reqServiceId || null,
      title: reqTitle,
      items: validItems,
      requestedBy: user.id,
      deptContributionAmount: reqGive,
    });
    setReqTitle('');
    setReqItems([{ description: '', quantity: 1, unitCost: 0 }]);
    setReqContribution(0);
    setReqSheetOpen(false);
  };

  const handleCreateWorkplan = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = wpItems.filter(
      (i) => i.activity.trim() && i.itemName.trim() && i.quantity > 0
    );
    if (!wpTitle.trim() || validItems.length === 0 || !deptId) return;

    DepartmentService.createWorkplan({
      tenantId: activeTenantId,
      departmentId: deptId,
      monthLabel: wpMonth,
      title: wpTitle,
      items: validItems,
      deptContributionAmount: wpDeptOffset,
      submittedBy: user.id,
    });
    setWpTitle('');
    setWpDeptOffset(0);
    setWpItems([{ activity: '', itemName: '', quantity: 1, unitCost: 0 }]);
    setWpSheetOpen(false);
  };

  const handleAddContribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contrMemberId || contrAmount <= 0 || !contrPurpose.trim() || !deptId) return;
    DepartmentService.addDeptContribution({
      tenantId: activeTenantId,
      departmentId: deptId,
      memberId: contrMemberId,
      amount: contrAmount,
      purpose: contrPurpose,
      paymentMethod: contrMethod,
      contributionDate: contrDate,
      recordedBy: user.id,
    });
    setContrAmount(0);
    setContrPurpose('');
    setContrSheetOpen(false);
  };

  const handleAssignServingMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId || !deptId) return;
    DepartmentService.addServingMember({
      tenantId: activeTenantId,
      departmentId: deptId,
      memberId: selectedMemberId,
      servingRole,
    });
    setSelectedMemberId('');
    setMemberSheetOpen(false);
  };

  const pendingReqs = requisitions.filter((r) => String(r.status).startsWith('PENDING')).length;
  const latestWp = workplans[0];
  const budgetPct = totalBudgetApproved ? Math.min(100, (totalReqPaid / totalBudgetApproved) * 100) : 0;
  const deptName = DEPT_SHORT[departmentCode] ?? department?.name ?? departmentCode;
  const extras = DEPT_EXTRAS[departmentCode] ?? [];
  const allTx = departmentCode === DepartmentCode.FINANCE ? FinanceService.getTransactions(activeTenantId) : [];
  const finIn = allTx.filter((t) => t.type === FinanceType.INCOME).reduce((a, t) => a + t.amount, 0);
  const finOut = allTx.filter((t) => t.type === FinanceType.EXPENSE).reduce((a, t) => a + t.amount, 0);
  const shortM = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 100_000) / 10}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : `${n}`);
  const tiles: { id: MoreSection; label: string; sub: string; n: number; icon: React.ElementType; tone: 'amber' | 'blue' | 'lime' | 'violet' }[] = [
    { id: 'requisitions', label: 'Requisitions', sub: pendingReqs ? `${pendingReqs} waiting` : 'Ask for funds', n: requisitions.length, icon: FileText, tone: 'amber' },
    { id: 'workplans', label: 'Workplans', sub: 'Monthly budget', n: workplans.length, icon: ClipboardList, tone: 'blue' },
    { id: 'contributions', label: 'Contributions', sub: totalContributed ? `${currency} ${num(totalContributed)}` : 'Team giving', n: contributions.length, icon: Coins, tone: 'lime' },
    { id: 'members', label: 'Team', sub: 'Roster & duty', n: servingMembers.length, icon: Users, tone: 'violet' },
  ];
  const teamNames = servingMembers
    .map((sm) => allMembers.find((m) => m.id === sm.memberId)?.fullName)
    .filter(Boolean) as string[];

  if (teamView) {
    return <DepartmentTeamView departmentCode={departmentCode} onBack={() => setTeamView(false)} />;
  }

  return (
    <>
      <PageHeader title="More" subtitle={`${deptName} tools, team and settings.`} />

      <Card className="!gap-3.5">
        <div className="flex flex-wrap items-center gap-3.5">
          <Tile icon={FileText} tone="amber" size={46} />
          <span className="flex-1 min-w-[200px] flex flex-col gap-0.5">
            <span className="font-display text-lg font-semibold">Need funds for {deptName}?</span>
            <span className="oc-sub">Administration approves, then Finance pays you out.</span>
          </span>
          <span className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
            <button type="button" onClick={openNewRequisition} className="oc-btn-primary w-full sm:w-auto">
              <Plus className="w-[18px] h-[18px]" /> Submit a requisition
            </button>
            <button
              type="button"
              onClick={() => {
                setSection('requisitions');
                setTimeout(() => document.getElementById('more-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
              }}
              className="max-sm:self-center max-sm:h-9 max-sm:text-sm max-sm:font-semibold max-sm:text-church-emerald sm:oc-btn-ghost inline-flex items-center justify-center gap-1"
            >
              Track my requisitions <ChevronRight className="w-4 h-4 sm:hidden" />
            </button>
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-5">
        <div className="lg:col-span-3 flex flex-col gap-4">
          {departmentCode === DepartmentCode.FINANCE ? (
            <DarkCard
              eyebrow={`Church money · ${new Date().toLocaleDateString('en-GB', { month: 'long' })}`}
              title={`${currency} ${shortM(finIn - finOut)} net this month`}
              onClick={() => navigate('/finance/outflows')}
            >
              <div className="flex flex-col gap-1.5">
                <div className="h-2 rounded bg-white/[0.12]">
                  <div className="h-2 rounded bg-church-lime" style={{ width: `${finIn ? Math.min(100, (finOut / finIn) * 100) : 0}%` }} />
                </div>
                <span className="text-[13px] text-church-mist">
                  {num(finOut)} spent of {num(finIn)} collected
                </span>
              </div>
            </DarkCard>
          ) : (
          <DarkCard
            eyebrow={latestWp ? `${latestWp.monthLabel} budget · ${currency}` : 'Monthly budget'}
            title={latestWp ? `${num(totalBudgetApproved)} approved` : 'No workplan yet'}
            onClick={() => setSection('workplans')}
          >
            {latestWp ? (
              <div className="flex flex-col gap-1.5">
                <div className="h-2 rounded bg-white/[0.12]">
                  <div className="h-2 rounded bg-church-lime" style={{ width: `${budgetPct}%` }} />
                </div>
                <span className="text-[13px] text-church-mist">
                  {num(totalReqPaid)} paid out · {num(Math.max(0, totalBudgetApproved - totalReqPaid))} left
                </span>
              </div>
            ) : (
              <span className="text-sm text-church-mist">Plan this month’s activities so Administration can approve funds.</span>
            )}
          </DarkCard>
          )}
          <button
            type="button"
            onClick={() => {
              setSection('accountability');
              setTimeout(() => document.getElementById('more-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
            }}
            className={`oc-press flex items-center gap-3 px-4 py-3.5 rounded-[20px] bg-white text-left ${section === 'accountability' ? 'ring-2 ring-church-lime' : ''}`}
          >
            <Tile icon={ClipboardCheck} tone="amber" />
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-[15px] font-semibold">Accountability</span>
              <span className="oc-sub truncate">Show what you bought with each payout</span>
            </span>
            {dueAccountability.length > 0 ? <Badge kind="warn">{dueAccountability.length} due</Badge> : <Badge kind="ok">Up to date</Badge>}
            <ChevronRight className="w-[18px] h-[18px] text-church-faint shrink-0" />
          </button>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 md:gap-3">
            {tiles.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.id === 'members') {
                    setTeamView(true);
                    window.scrollTo({ top: 0 });
                    return;
                  }
                  setSection(section === t.id ? null : t.id);
                  setTimeout(() => document.getElementById('more-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                }}
                aria-pressed={section === t.id}
                className={`oc-press text-left flex flex-col gap-3 p-4 rounded-[20px] bg-white transition ${
                  section === t.id ? 'ring-2 ring-church-lime' : ''
                }`}
              >
                <span className="flex items-start justify-between">
                  <Tile icon={t.icon} tone={t.tone} />
                  <span className="oc-num text-[22px]">{t.n}</span>
                </span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[15px] font-semibold">{t.label}</span>
                  <span className="oc-sub truncate">{t.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setTeamView(true)}
            className="oc-press flex items-center gap-3 px-4 py-3.5 rounded-[20px] bg-white text-left whitespace-nowrap"
          >
            <span className="flex">
              {teamNames.slice(0, 4).map((n, i) => (
                <span key={n} className="rounded-full ring-[3px] ring-white flex" style={{ marginLeft: i ? -10 : 0 }}>
                  <Avatar name={n} size={36} />
                </span>
              ))}
            </span>
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-[15px] font-semibold">
                {servingMembers.length} serving in {deptName}
              </span>
              <span className="oc-sub">Mark who’s on duty this service</span>
            </span>
            <ChevronRight className="w-[18px] h-[18px] text-church-faint" />
          </button>
          {extras.length > 0 && (
            <ListCard title={deptName}>
              {extras.map((x) => (
                <Row key={x.label} onClick={() => navigate(x.to)} lead={<Tile icon={x.icon} tone={x.tone} />} title={x.label} sub={x.sub} chevron />
              ))}
            </ListCard>
          )}
          <ListCard title="Account">
            <Row lead={<Tile icon={Bell} />} title="Notifications" sub="Approvals, payouts and reminders" chevron />
            <Row
              lead={<Tile icon={LogOut} tone="red" />}
              title="Sign out"
              sub={user.email}
              onClick={() => {
                logout();
                navigate('/login');
              }}
            />
          </ListCard>
        </div>
      </div>

      {section && (
        <div id="more-section" className="flex items-center justify-between gap-3 pt-2 scroll-mt-24">
          <h2 className="oc-h2 !text-xl">{section === 'accountability' ? 'Accountability' : tiles.find((t) => t.id === section)?.label}</h2>
          <button type="button" onClick={() => setSection(null)} className="text-sm font-semibold text-church-muted">
            Close
          </button>
        </div>
      )}

      {section === 'accountability' && deptId && (
        <AccountabilitySection tenantId={activeTenantId} departmentId={deptId} currency={currency} requisitions={requisitions} onAccount={setAccountFor} />
      )}

      {/* 1. REQUISITIONS SUB-VIEW */}
      {section === 'requisitions' && (
        <div className="space-y-4">
          {dueAccountability.length > 0 && (
            <div className="flex items-start gap-3 px-3.5 py-3 rounded-2xl bg-church-warnSoft">
              <Lock className="w-5 h-5 text-[#A15C00] shrink-0 mt-px" />
              <span className="flex-1 text-sm leading-[1.45] text-[#5A3500]">
                Account for <b>{dueAccountability[0].requisitionNumber}</b> ({formatCurrency(dueAccountability[0].amountPaid, currency)}) before you can send a new requisition.
              </span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-church-text">
                Department Requisitions
              </h3>
              <p className="text-xs text-church-muted">
                Total Disbursed: {formatCurrency(totalReqPaid, currency)}
              </p>
            </div>
            <button
              type="button"
              onClick={openNewRequisition}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-church-lime text-church-forest text-sm font-bold hover:bg-church-limeHover oc-press whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Submit Requisition
            </button>
          </div>

          {requisitions.length === 0 ? (
            <div className="bg-white rounded-card p-8 text-center text-sm text-church-muted">
              No requisitions submitted yet for this department.
            </div>
          ) : (
            <div className="space-y-3">
              {requisitions.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-card p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[13px] font-bold text-church-faint">
                        {req.requisitionNumber} • {formatDate(req.requestedAt)}
                      </span>
                      <h4 className="text-sm font-semibold text-church-text">{req.title}</h4>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="bg-church-soft rounded-2xl p-2.5 space-y-1">
                    {req.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-church-muted">
                        <span>
                          {it.quantity}× {it.description}
                        </span>
                        <span className="font-mono font-semibold">
                          {formatCurrency(it.quantity * it.unitCost, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {Number(req.deptContributionAmount || 0) > 0 && (
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-church-muted">{deptLabel} gave</span>
                      <span className="font-display font-semibold text-church-pos">
                        {formatCurrency(Number(req.deptContributionAmount), currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-church-muted">
                      Paid: {formatCurrency(req.amountPaid, currency)}
                    </span>
                    <span className="font-mono font-display font-bold text-church-text">
                      Asked: {formatCurrency(requisitionAsk(req), currency)}
                    </span>
                  </div>
                  {req.status === 'REJECTED' && (
                    <>
                      <div className="flex gap-2.5 p-3 rounded-[14px] bg-church-negSoft">
                        <MessageCircle className="w-[18px] h-[18px] text-[#8F1D14] shrink-0" />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-bold text-[#8F1D14]">Administration</span>
                          <span className="text-sm leading-[1.45] text-[#5C1A14]">{req.rejectionReason || 'Sent back without a comment.'}</span>
                        </span>
                      </div>
                      <button type="button" onClick={() => openEditRequisition(req)} className="oc-btn-dark w-full">
                        <Pencil className="w-[18px] h-[18px]" /> Edit &amp; resubmit
                      </button>
                    </>
                  )}
                  {req.status === 'PAID' && dueAccountability.some((d) => d.id === req.id) && (
                    <button type="button" onClick={() => setAccountFor(req)} className="oc-btn-primary w-full">
                      <ClipboardCheck className="w-[18px] h-[18px]" /> Submit accountability
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. WORKPLANS / BUDGETS SUB-VIEW */}
      {section === 'workplans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-church-text">
                Workplans & Budgets
              </h3>
              <p className="text-xs text-church-muted">
                Submit monthly activity budgets to Administration
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWpSheetOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-church-lime text-church-forest text-sm font-bold hover:bg-church-limeHover oc-press whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> New Workplan
            </button>
          </div>

          {workplans.length === 0 ? (
            <div className="bg-white rounded-card p-8 text-center text-sm text-church-muted">
              No workplans or budgets submitted yet.
            </div>
          ) : (
            <div className="space-y-3">
              {workplans.map((wp) => (
                <div
                  key={wp.id}
                  className="bg-white rounded-card p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[13px] font-bold text-church-emerald">
                        Month: {wp.monthLabel}
                      </span>
                      <h4 className="text-sm font-semibold text-church-text">{wp.title}</h4>
                    </div>
                    <StatusBadge status={wp.status} />
                  </div>
                  <div className="space-y-1.5 bg-church-soft rounded-2xl p-3">
                    {wp.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span className="text-church-muted">
                          <strong>{item.activity}:</strong> {item.quantity}× {item.itemName}
                        </span>
                        <span className="font-mono font-semibold text-church-text">
                          {formatCurrency(item.totalCost, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-church-faint block text-xs font-bold">
                        Gross Budget
                      </span>
                      <span className="font-mono font-bold text-church-text">
                        {formatCurrency(wp.totalRequested, currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-church-faint block text-xs font-bold">
                        Dept Contr.
                      </span>
                      <span className="font-mono font-bold text-church-pos">
                        {formatCurrency(wp.deptContributionAmount, currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-church-faint block text-xs font-bold">
                        Approved
                      </span>
                      <span className="font-mono font-display font-bold text-church-forest">
                        {formatCurrency(wp.totalApproved, currency)}
                      </span>
                    </div>
                  </div>
                  {wp.reviewNotes && (
                    <p className="text-xs text-church-muted bg-church-limeSoft border border-church-limeLine px-3 py-2 rounded-2xl">
                      {wp.reviewNotes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. DEPT CONTRIBUTIONS SUB-VIEW */}
      {section === 'contributions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard
              label="Total Dept Contributions"
              value={formatCurrency(totalContributed, currency)}
              subtitle={`${contributions.length} recorded contributions`}
              tone="emerald"
            />
            <KpiCard
              label="Contributing Members"
              value={new Set(contributions.map((c) => c.memberId)).size}
              subtitle="Internal dept support"
            />
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-church-text">
              Contributions Ledger
            </h3>
            <button
              type="button"
              onClick={() => {
                setContrMemberId(servingMembers[0]?.memberId || allMembers[0]?.id || '');
                setContrSheetOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-church-lime text-church-forest text-sm font-bold hover:bg-church-limeHover oc-press whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Record Contribution
            </button>
          </div>

          {contributions.length === 0 ? (
            <div className="bg-white rounded-card p-8 text-center text-sm text-church-muted">
              No department member contributions recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {contributions.map((c) => {
                const member = allMembers.find((m) => m.id === c.memberId);
                return (
                  <div
                    key={c.id}
                    className="bg-white rounded-card p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-church-text truncate">
                        {member?.fullName ?? 'Department Member'}
                      </p>
                      <p className="text-xs text-church-muted truncate">{c.purpose}</p>
                      <p className="text-[13px] text-church-faint font-mono mt-0.5">
                        {formatDate(c.contributionDate)} • {c.paymentMethod} ({c.referenceCode})
                      </p>
                    </div>
                    <span className="font-mono text-sm font-display font-bold text-church-pos shrink-0">
                      +{formatCurrency(c.amount, currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. DEPT MEMBERS INFO & DUTY ATTENDANCE SUB-VIEW */}
      {section === 'members' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-church-text">
                Department Members Info ({servingMembers.length})
              </h3>
              <p className="text-xs text-church-muted">
                Member contacts, roles, attendance % & duty check-in
              </p>
            </div>
            <div className="flex items-center gap-2">
              {services.length > 0 && (
                <select
                  value={dutyServiceId}
                  onChange={(e) => setDutyServiceId(e.target.value)}
                  className="text-xs font-semibold bg-white border border-church-line rounded-2xl px-3 py-2.5 outline-none"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      Duty: {s.title} ({s.serviceDate})
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedMemberId(allMembers[0]?.id || '');
                  setMemberSheetOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-church-lime text-church-forest text-sm font-bold shrink-0 oc-press whitespace-nowrap"
              >
                <UserPlus className="w-4 h-4" /> Add Member
              </button>
            </div>
          </div>

          {servingMembers.length === 0 ? (
            <div className="bg-white rounded-card p-8 text-center text-sm text-church-muted">
              No serving members assigned to this department yet. Tap "+ Add Member".
            </div>
          ) : (
            <div className="space-y-2.5">
              {servingMembers.map((sm) => {
                const member = allMembers.find((m) => m.id === sm.memberId);
                if (!member) return null;
                const attendedCount = allAttendance.filter(
                  (a) => a.memberId === member.id
                ).length;
                const pct =
                  services.length > 0
                    ? Math.round((attendedCount / services.length) * 100)
                    : 0;
                const checkedInDuty = Boolean(
                  dutyServiceId &&
                    allAttendance.some(
                      (a) =>
                        a.serviceId === dutyServiceId &&
                        a.memberId === member.id &&
                        a.isServingCheckin
                    )
                );

                return (
                  <div
                    key={sm.id}
                    className="bg-white rounded-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-church-text truncate">
                          {member.fullName}
                        </p>
                        <StatusBadge status={sm.servingRole} />
                      </div>
                      <p className="text-xs text-church-muted font-mono mt-0.5">
                        {member.phoneNumber} • {member.residence}
                      </p>
                      <p className="text-[13px] font-semibold text-church-pos mt-1">
                        Service Attendance: {attendedCount}/{services.length} ({pct}%)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={`tel:${member.phoneNumber}`}
                        className="p-2.5 rounded-2xl bg-church-canvas text-church-muted hover:bg-church-line"
                        title="Call"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                      <a
                        href={getWhatsAppLink(member.phoneNumber)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-2xl bg-church-limeSoft text-church-pos hover:bg-church-posSoft"
                        title="WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </a>
                      {dutyServiceId && (
                        <button
                          type="button"
                          onClick={() =>
                            AttendanceAndMemberService.checkInMember({
                              tenantId: activeTenantId,
                              serviceId: dutyServiceId,
                              memberId: member.id,
                              checkedInBy: user.id,
                              isServingCheckin: true,
                              servingDepartmentId: deptId,
                            })
                          }
                          className={`px-3 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1 ${
                            checkedInDuty
                              ? 'bg-church-posSoft text-church-pos'
                              : 'bg-church-forest text-church-lime'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {checkedInDuty ? 'On Duty' : 'Mark Duty'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => DepartmentService.removeServingMember(sm.id)}
                        className="p-2 rounded-2xl text-rose-500 hover:bg-church-negSoft"
                        title="Remove from department"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <BlockedSheet
        requisition={blockedBy}
        currency={currency}
        onClose={() => setBlockedBy(null)}
        onAccount={(r) => {
          setBlockedBy(null);
          setAccountFor(r);
        }}
      />
      <AccountabilitySheet requisition={accountFor} tenantId={activeTenantId} userId={user.id} currency={currency} onClose={() => setAccountFor(null)} />

      {/* Modal 1: Submit Requisition */}
      <MobileSheet
        open={reqSheetOpen}
        onClose={() => setReqSheetOpen(false)}
        title={editingReq ? 'Edit & resubmit' : 'Submit Department Requisition'}
        subtitle={editingReq ? `${editingReq.requisitionNumber} · fix what Administration asked, then send it back` : 'Sent directly to Administration for approval'}
      >
        <form onSubmit={handleCreateRequisition} className="space-y-4">
          {editingReq?.rejectionReason && (
            <div className="flex gap-2.5 p-3 rounded-[14px] bg-church-negSoft">
              <MessageCircle className="w-[18px] h-[18px] text-[#8F1D14] shrink-0" />
              <span className="text-sm leading-[1.45] text-[#5C1A14]">
                <b className="text-[#8F1D14]">Administration:</b> {editingReq.rejectionReason}
              </span>
            </div>
          )}
          <TextInput
            label="Requisition Title"
            value={reqTitle}
            onChange={setReqTitle}
            placeholder="e.g. Sunday Outreach Sound & Refreshments"
            required
          />
          <SelectInput
            label="Link to Workplan (Optional)"
            value={reqWorkplanId}
            onChange={setReqWorkplanId}
            options={[
              { value: '', label: 'Ad-hoc / Special Request' },
              ...workplans.map((w) => ({
                value: w.id,
                label: `${w.monthLabel} — ${w.title}`,
              })),
            ]}
          />
          <SelectInput
            label="Link to Specific Service (Optional)"
            value={reqServiceId}
            onChange={setReqServiceId}
            options={[
              { value: '', label: 'General Departmental' },
              ...services.map((s) => ({
                value: s.id,
                label: `${s.title} (${s.serviceDate})`,
              })),
            ]}
          />

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-church-muted">
                Line Items
              </span>
              <button
                type="button"
                onClick={() =>
                  setReqItems([...reqItems, { description: '', quantity: 1, unitCost: 0 }])
                }
                className="text-xs font-bold text-church-emerald"
              >
                + Add Line
              </button>
            </div>
            {reqItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-church-soft rounded-2xl border border-church-line space-y-2"
              >
                <TextInput
                  label={`Item ${idx + 1}`}
                  value={item.description}
                  onChange={(val) => {
                    const copy = [...reqItems];
                    copy[idx].description = val;
                    setReqItems(copy);
                  }}
                  placeholder="Item description"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput
                    label="Qty"
                    value={item.quantity}
                    min={1}
                    onChange={(val) => {
                      const copy = [...reqItems];
                      copy[idx].quantity = val;
                      setReqItems(copy);
                    }}
                  />
                  <NumberInput
                    label="Unit Cost"
                    value={item.unitCost}
                    prefix={currency}
                    onChange={(val) => {
                      const copy = [...reqItems];
                      copy[idx].unitCost = val;
                      setReqItems(copy);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <NumberInput
              label={`How much is ${deptLabel} contributing?`}
              value={reqContribution}
              min={0}
              prefix={currency}
              onChange={setReqContribution}
            />
            <span className="flex items-center gap-2 text-[13px] text-church-muted">
              <Coins className="w-4 h-4 text-[#2F6B0A] shrink-0" />
              {formatCurrency(contributedThisMonth, currency)} given by the {deptLabel} team this month
            </span>
          </div>
          <div className="rounded-2xl bg-[#F6F7F3] px-3.5 py-1">
            <div className="flex justify-between py-2.5 text-[15px]">
              <span className="text-church-muted">Total cost</span>
              <span className="font-display font-semibold tabular-nums whitespace-nowrap">{formatCurrency(reqTotal, currency)}</span>
            </div>
            <div className="flex justify-between py-2.5 border-t border-church-line text-[15px]">
              <span className="text-church-muted">{deptLabel} contributes</span>
              <span className="font-display font-semibold tabular-nums whitespace-nowrap text-church-pos">− {formatCurrency(reqGive, currency)}</span>
            </div>
            <div className="flex justify-between items-baseline gap-2.5 py-3 border-t border-church-line">
              <span className="text-[15px] font-semibold">Asking Admin for</span>
              <span className="font-display text-[22px] font-bold tabular-nums whitespace-nowrap">{formatCurrency(reqTotal - reqGive, currency)}</span>
            </div>
          </div>
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            {editingReq ? 'Resubmit to Administration' : 'Send to Administration'}
          </button>
        </form>
      </MobileSheet>

      {/* Modal 2: Submit Workplan / Budget */}
      <MobileSheet
        open={wpSheetOpen}
        onClose={() => setWpSheetOpen(false)}
        title="Submit Workplan / Budget"
        subtitle="Itemized departmental budget for Administration sign-off"
      >
        <form onSubmit={handleCreateWorkplan} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Month (YYYY-MM)"
              value={wpMonth}
              onChange={setWpMonth}
              placeholder="2026-12"
              required
            />
            <NumberInput
              label="Dept Contribution Offset"
              value={wpDeptOffset}
              onChange={setWpDeptOffset}
              prefix={currency}
            />
          </div>
          <TextInput
            label="Workplan Title"
            value={wpTitle}
            onChange={setWpTitle}
            placeholder="e.g. December Evangelism & Hospitality Budget"
            required
          />

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-church-muted">
                Budget Activities
              </span>
              <button
                type="button"
                onClick={() =>
                  setWpItems([
                    ...wpItems,
                    { activity: '', itemName: '', quantity: 1, unitCost: 0 },
                  ])
                }
                className="text-xs font-bold text-church-emerald"
              >
                + Add Activity
              </button>
            </div>
            {wpItems.map((it, idx) => (
              <div
                key={idx}
                className="p-3 bg-church-soft rounded-2xl border border-church-line space-y-2"
              >
                <TextInput
                  label="Activity"
                  value={it.activity}
                  onChange={(v) => {
                    const copy = [...wpItems];
                    copy[idx].activity = v;
                    setWpItems(copy);
                  }}
                  placeholder="e.g. Home Visits"
                  required
                />
                <TextInput
                  label="Item Needed"
                  value={it.itemName}
                  onChange={(v) => {
                    const copy = [...wpItems];
                    copy[idx].itemName = v;
                    setWpItems(copy);
                  }}
                  placeholder="e.g. Fuel / Packs"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <NumberInput
                    label="Qty"
                    value={it.quantity}
                    min={1}
                    onChange={(v) => {
                      const copy = [...wpItems];
                      copy[idx].quantity = v;
                      setWpItems(copy);
                    }}
                  />
                  <NumberInput
                    label="Unit Cost"
                    value={it.unitCost}
                    prefix={currency}
                    onChange={(v) => {
                      const copy = [...wpItems];
                      copy[idx].unitCost = v;
                      setWpItems(copy);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Submit Workplan (
            {formatCurrency(
              wpItems.reduce((s, i) => s + i.quantity * i.unitCost, 0),
              currency
            )}
            )
          </button>
        </form>
      </MobileSheet>

      {/* Modal 3: Record Dept Contribution */}
      <MobileSheet
        open={contrSheetOpen}
        onClose={() => setContrSheetOpen(false)}
        title="Record Dept Contribution"
        subtitle="Track giving by members toward department needs"
      >
        <form onSubmit={handleAddContribution} className="space-y-4">
          <SelectInput
            label="Contributing Member"
            value={contrMemberId}
            onChange={setContrMemberId}
            options={allMembers.map((m) => ({
              value: m.id,
              label: `${m.fullName} (${m.phoneNumber})`,
            }))}
            required
          />
          <NumberInput
            label="Contribution Amount"
            value={contrAmount}
            onChange={setContrAmount}
            prefix={currency}
            min={1}
            required
          />
          <TextInput
            label="Purpose / Project"
            value={contrPurpose}
            onChange={setContrPurpose}
            placeholder="e.g. Uniforms / Welfare Pool / Equipment"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectInput
              label="Payment Method"
              value={contrMethod}
              onChange={(v) =>
                setContrMethod(v as 'Cash' | 'Mobile Money' | 'Bank Transfer')
              }
              options={[
                { value: 'Mobile Money', label: 'Mobile Money' },
                { value: 'Cash', label: 'Cash' },
                { value: 'Bank Transfer', label: 'Bank Transfer' },
              ]}
            />
            <DateInput
              label="Date"
              value={contrDate}
              onChange={setContrDate}
              required
            />
          </div>
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Save Contribution
          </button>
        </form>
      </MobileSheet>

      {/* Modal 4: Add Member to Department */}
      <MobileSheet
        open={memberSheetOpen}
        onClose={() => setMemberSheetOpen(false)}
        title="Assign Member to Department"
        subtitle="Select from the central Church Member database"
      >
        <form onSubmit={handleAssignServingMember} className="space-y-4">
          <SelectInput
            label="Select Church Member"
            value={selectedMemberId}
            onChange={setSelectedMemberId}
            options={allMembers.map((m) => ({
              value: m.id,
              label: `${m.fullName} (${m.phoneNumber})`,
            }))}
            required
          />
          <SelectInput
            label="Department Role"
            value={servingRole}
            onChange={(v) => setServingRole(v as 'HOD' | 'Coordinator' | 'Member')}
            options={[
              { value: 'Member', label: 'Serving Member' },
              { value: 'Coordinator', label: 'Coordinator / Lead' },
              { value: 'HOD', label: 'Head of Department (HOD)' },
            ]}
          />
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Assign to Department
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

