import React, { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  Coins,
  GraduationCap,
  Home,
  MapPin,
  Megaphone,
  Plus,
  Send,
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
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import {
  AttendanceAndMemberService,
  FellowshipService,
  FinanceService,
} from '@/services/churchService';
import {
  DepartmentCode,
  FellowshipUnitType,
  FinanceCategory,
  FinanceScope,
  UserRole,
} from '@/shared/enums';
import { formatCurrency, formatDate } from '@/shared/formatters';
import {
  DateInput,
  HeroAmountInput,
  KpiCard,
  MobileSheet,
  NumberInput,
  PhoneInput,
  SelectInput,
  StatusBadge,
  TextAreaInput,
  TextInput,
} from '@/components/ui/FormControls';
import { HodMoreTab } from '@/components/hod-more/HodMoreTab';

interface FellowshipProps {
  unitType: FellowshipUnitType;
}

// ─── DASHBOARD A: HEAD OF BACENTAS / HEAD OF CAMPUSES ─────────────────────────

const HodUnitsAndReportsView: React.FC<FellowshipProps> = ({ unitType }) => {
  useChurchStoreRefresh();
  const { activeTenantId } = useAuth();
  const isBacenta = unitType === FellowshipUnitType.BACENTA;
  const labelSingular = isBacenta ? 'Bacenta' : 'Campus';
  const labelPlural = isBacenta ? 'Bacentas' : 'Campuses';

  const units = FellowshipService.getUnits(activeTenantId, unitType);
  const unitIds = units.map((u) => u.id);
  const meetings = FellowshipService.getMeetings(activeTenantId, unitIds);
  const outreaches = FellowshipService.getOutreaches(activeTenantId, unitIds);
  const allMembers = AttendanceAndMemberService.getMembers(activeTenantId);

  const [reportFilter, setReportFilter] = useState<'all' | 'meetings' | 'outreaches'>('all');
  const [addUnitOpen, setAddUnitOpen] = useState(false);

  // Add Unit Form
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [meetingDay, setMeetingDay] = useState(
    isBacenta ? 'Wednesday 6:00 PM' : 'Friday 5:00 PM'
  );
  const [leaderName, setLeaderName] = useState('');
  const [leaderPhone, setLeaderPhone] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [leaderLogin, setLeaderLogin] = useState('');
  const [unitError, setUnitError] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const freeLeaders = FellowshipService.getUnassignedLeaders(activeTenantId, unitType);
  const pickedLeader = freeLeaders.find((u) => u.id === leaderLogin) ?? null;

  const totalSoulsWon =
    meetings.reduce((s, m) => s + m.soulsWonCount, 0) +
    outreaches.reduce((s, o) => s + o.soulsWonCount, 0);

  const handleCreateUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !(pickedLeader || leaderName.trim())) return;
    try {
      FellowshipService.createUnit({
        tenantId: activeTenantId,
        unitType,
        name,
        locationOrInstitution: location,
        meetingDay,
        leaderName: pickedLeader?.fullName ?? leaderName,
        leaderPhone: pickedLeader?.phoneNumber ?? leaderPhone,
        leaderEmail: pickedLeader ? '' : leaderEmail,
        leaderUserId: pickedLeader?.id ?? null,
        assignedMemberIds: selectedMembers,
      });
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : `Could not create the ${labelSingular}`);
      return;
    }
    setUnitError('');
    setLeaderLogin('');
    setName('');
    setLocation('');
    setLeaderName('');
    setLeaderPhone('');
    setLeaderEmail('');
    setSelectedMembers([]);
    setAddUnitOpen(false);
  };

  const UnitIcon = isBacenta ? Home : GraduationCap;
  const unitTone = isBacenta ? 'lime' : 'indigo';
  const totalLabourers =
    meetings.reduce((t, m) => t + m.labourersCount, 0) + outreaches.reduce((t, o) => t + o.labourersCount, 0);
  const reports = [
    ...((reportFilter === 'all' || reportFilter === 'outreaches')
      ? outreaches.map((o) => ({
          id: o.id,
          kind: 'Outreach' as const,
          unitId: o.unitId,
          title: o.location || 'Outreach',
          date: o.outreachDate,
          labourers: o.labourersCount,
          souls: o.soulsWonCount,
          testimony: o.testimony,
        }))
      : []),
    ...((reportFilter === 'all' || reportFilter === 'meetings')
      ? meetings.map((m) => ({
          id: m.id,
          kind: 'Meeting' as const,
          unitId: m.unitId,
          title: m.title,
          date: m.meetingDate,
          labourers: m.labourersCount,
          souls: m.soulsWonCount,
          testimony: m.testimony,
        }))
      : []),
  ].sort((x, y) => (x.date < y.date ? 1 : -1));

  return (
    <>
      <PageHeader
        title={`${labelPlural} & reports`}
        subtitle={`Every ${labelSingular.toLowerCase()}, its leader and the reports they send in.`}
        actions={
          <button type="button" onClick={() => setAddUnitOpen(true)} className="oc-btn-dark">
            <Plus className="w-[18px] h-[18px] text-church-lime" /> Add {labelSingular.toLowerCase()}
          </button>
        }
      />
      <KpiGrid>
        <KpiCard label={labelPlural} value={units.length} subtitle="Active" icon={<UnitIcon className="w-[18px] h-[18px]" />} />
        <KpiCard label="Reports" value={meetings.length + outreaches.length} subtitle={`${meetings.length} meetings · ${outreaches.length} outreaches`} />
        <KpiCard label="Souls won" value={totalSoulsWon} subtitle="From all reports" tone="emerald" />
        <KpiCard label="Labourers" value={totalLabourers} subtitle="Total turn-out" />
      </KpiGrid>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
        {units.length === 0 ? (
          <EmptyState icon={UnitIcon} title={`No ${labelPlural.toLowerCase()} yet`} sub={`Add the first ${labelSingular.toLowerCase()} and its leader.`} />
        ) : (
          <ListCard title={`Your ${labelPlural.toLowerCase()}`}>
            {units.map((u) => {
              const uMembers = FellowshipService.getUnitMembers(activeTenantId, u.id, unitType);
              return (
                <Row
                  key={u.id}
                  lead={<Tile icon={UnitIcon} tone={unitTone} />}
                  title={u.name}
                  sub={`${u.leaderName} · ${u.meetingDay}`}
                  trail={
                    <span className="flex items-baseline gap-1.5 shrink-0">
                      <span className="oc-num text-[15px]">{uMembers.length}</span>
                      <span className="oc-sub">members</span>
                    </span>
                  }
                />
              );
            })}
          </ListCard>
        )}
        <div className="flex flex-col gap-3">
          <SectionTitle title="Latest reports" aside="Newest first" />
          <Chips
            items={[
              { value: 'all', label: 'All', count: meetings.length + outreaches.length },
              { value: 'meetings', label: 'Meetings', count: meetings.length },
              { value: 'outreaches', label: 'Outreaches', count: outreaches.length },
            ]}
            value={reportFilter}
            onChange={(v) => setReportFilter(v as typeof reportFilter)}
          />
          {reports.length === 0 ? (
            <EmptyState icon={Megaphone} title="No reports yet" />
          ) : (
            reports.map((r) => {
              const unit = units.find((u) => u.id === r.unitId);
              return (
                <Card key={r.id}>
                  <div className="flex justify-between gap-2.5">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <Badge kind={r.kind === 'Outreach' ? 'lime' : 'neutral'}>{r.kind}</Badge>
                        <span className="oc-sub truncate">{unit?.name}</span>
                      </span>
                      <span className="font-display text-lg font-semibold leading-snug">{r.title}</span>
                    </div>
                    <span className="oc-sub whitespace-nowrap">{formatDate(r.date)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{r.labourers} labourers</Badge>
                    <Badge kind="ok">{r.souls} souls won</Badge>
                  </div>
                  {r.testimony && (
                    <p className="m-0 px-3.5 py-3 rounded-[14px] bg-church-soft text-sm leading-relaxed text-[#3E4741]">“{r.testimony}”</p>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Add Unit Sheet */}
      <MobileSheet
        open={addUnitOpen}
        onClose={() => setAddUnitOpen(false)}
        title={`Add New ${labelSingular}`}
        subtitle={`Creates ${labelSingular.toLowerCase()}, assigns members & optional leader login`}
      >
        <form onSubmit={handleCreateUnit} className="space-y-4">
          <TextInput
            label={`${labelSingular} Name`}
            value={name}
            onChange={setName}
            placeholder={isBacenta ? 'e.g. Bukoto Heights Bacenta' : 'e.g. MUBS Nakawa Campus'}
            required
          />
          <TextInput
            label={isBacenta ? 'Residential Zone / Area' : 'University / Institution'}
            value={location}
            onChange={setLocation}
            placeholder={isBacenta ? 'Bukoto' : 'Makerere Business School'}
            required
          />
          <TextInput
            label="Meeting Schedule"
            value={meetingDay}
            onChange={setMeetingDay}
            required
          />
          {freeLeaders.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="oc-label">Leader</span>
              <select value={leaderLogin} onChange={(e) => setLeaderLogin(e.target.value)} className="oc-field">
                <option value="">Someone new (enter their details below)</option>
                {freeLeaders.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} · {u.email}
                  </option>
                ))}
              </select>
              <span className="oc-sub">These {labelSingular} leaders already have a login but no {labelSingular} yet.</span>
            </label>
          )}
          {!pickedLeader && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  label="Leader Full Name"
                  value={leaderName}
                  onChange={setLeaderName}
                  required
                />
                <PhoneInput
                  label="Leader Phone"
                  value={leaderPhone}
                  onChange={setLeaderPhone}
                  required
                />
              </div>
              <TextInput
                label="Leader Login Email (Optional — creates their leader login and emails an invite)"
                type="email"
                value={leaderEmail}
                onChange={setLeaderEmail}
                placeholder="leader@gmail.com"
              />
            </>
          )}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-church-muted">
              Assign Members (Optional)
            </label>
            <div className="max-h-36 overflow-y-auto bg-church-soft rounded-2xl border border-church-line p-2 space-y-1">
              {allMembers.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 text-xs p-1.5 rounded-xl hover:bg-white cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(m.id)}
                    onChange={(e) =>
                      setSelectedMembers((prev) =>
                        e.target.checked
                          ? [...prev, m.id]
                          : prev.filter((id) => id !== m.id)
                      )
                    }
                  />
                  <span className="font-semibold text-church-text">{m.fullName}</span>
                  <span className="text-church-faint">({m.residence})</span>
                </label>
              ))}
            </div>
          </div>
          {unitError && (
            <p role="alert" className="m-0 px-3.5 py-2.5 rounded-xl bg-church-negSoft text-sm text-[#8F1D14]">
              {unitError}
            </p>
          )}
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Create {labelSingular}
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

const HodDualAttendanceView: React.FC<FellowshipProps> = ({ unitType }) => {
  useChurchStoreRefresh();
  const { activeTenantId } = useAuth();
  const isBacenta = unitType === FellowshipUnitType.BACENTA;
  const labelSingular = isBacenta ? 'Bacenta' : 'Campus';

  const units = FellowshipService.getUnits(activeTenantId, unitType);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('ALL');

  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const serviceAtt = AttendanceAndMemberService.getServiceAttendance(activeTenantId);
  const meetings = FellowshipService.getMeetings(
    activeTenantId,
    units.map((u) => u.id)
  );
  const meetingAtt = FellowshipService.getMeetingAttendance(activeTenantId);
  const allMembers = AttendanceAndMemberService.getMembers(activeTenantId);

  const scopedMembers = allMembers.filter((m) => {
    const uId = isBacenta ? m.bacentaId : m.campusId;
    if (!uId) return false;
    return selectedUnitId === 'ALL' || uId === selectedUnitId;
  });

  const rowsData = scopedMembers.map((m) => {
    const unitId = isBacenta ? m.bacentaId : m.campusId;
    const unit = units.find((u) => u.id === unitId);
    const unitMeetings = meetings.filter((mt) => mt.unitId === unitId);
    const myMeetingCount = meetingAtt.filter(
      (ma) => ma.memberId === m.id && unitMeetings.some((um) => um.id === ma.meetingId)
    ).length;
    const myServiceCount = serviceAtt.filter((sa) => sa.memberId === m.id).length;
    const mtgPct = unitMeetings.length > 0 ? Math.round((myMeetingCount / unitMeetings.length) * 100) : 0;
    const srvPct = services.length > 0 ? Math.round((myServiceCount / services.length) * 100) : 0;
    return { m, unit, mtgPct, srvPct };
  });
  const avg = (k: 'mtgPct' | 'srvPct') =>
    rowsData.length ? Math.round(rowsData.reduce((t, r) => t + r[k], 0) / rowsData.length) : 0;
  const plural = isBacenta ? 'Bacentas' : 'Campuses';

  return (
    <>
      <PageHeader title="Attendance" subtitle={`${labelSingular} meetings next to main church services, per member.`} />
      <Chips
        items={[{ value: 'ALL', label: `All ${plural.toLowerCase()}` }, ...units.map((u) => ({ value: u.id, label: u.name }))]}
        value={selectedUnitId}
        onChange={setSelectedUnitId}
      />
      <KpiGrid>
        <KpiCard label="Members" value={rowsData.length} />
        <KpiCard label={`${labelSingular} meetings`} value={`${avg('mtgPct')}%`} subtitle="Average" />
        <KpiCard label="Church services" value={`${avg('srvPct')}%`} subtitle="Average" />
      </KpiGrid>
      {rowsData.length === 0 ? (
        <EmptyState icon={Users} title="No members assigned yet" />
      ) : (
        <section className="bg-white rounded-card px-4">
          <div className="hidden sm:flex gap-3 pt-3.5 pb-1.5 text-xs font-semibold text-church-muted uppercase tracking-[0.05em]">
            <span className="flex-1">Member</span>
            <span className="w-32">{labelSingular} meetings</span>
            <span className="w-32">Church services</span>
          </div>
          <div className="divide-y divide-church-line">
            {rowsData.map(({ m, unit, mtgPct, srvPct }) => (
              <div key={m.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3">
                <Avatar name={m.fullName} />
                <span className="flex-1 min-w-[140px] flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold truncate">{m.fullName}</span>
                  <span className="oc-sub truncate">{unit?.name}</span>
                </span>
                <span className="w-full sm:w-auto flex gap-4 sm:gap-3 pl-[52px] sm:pl-0">
                  <span className="flex-1 sm:flex-none sm:w-32 flex flex-col gap-1">
                    <span className="sm:hidden text-xs text-church-muted">{labelSingular}</span>
                    <MiniBar pct={mtgPct} />
                  </span>
                  <span className="flex-1 sm:flex-none sm:w-32 flex flex-col gap-1">
                    <span className="sm:hidden text-xs text-church-muted">Services</span>
                    <MiniBar pct={srvPct} />
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
};

const HodUnitFinanceView: React.FC<FellowshipProps> = ({ unitType }) => {
  useChurchStoreRefresh();
  const { tenant, activeTenantId } = useAuth();
  const currency = tenant?.currency || 'UGX';
  const isBacenta = unitType === FellowshipUnitType.BACENTA;
  const scope = isBacenta ? FinanceScope.BACENTA_MEETING : FinanceScope.CAMPUS_MEETING;

  const units = FellowshipService.getUnits(activeTenantId, unitType);
  const txs = FinanceService.getTransactions(activeTenantId).filter(
    (t) => t.sourceScope === scope
  );

  const totalCollected = txs.reduce((s, t) => s + t.amount, 0);

  const sumCat = (list: typeof txs, c: FinanceCategory) => list.filter((t) => t.category === c).reduce((x, t) => x + t.amount, 0);
  const perUnit = units.map((u) => {
    const uTxs = txs.filter((t) => t.fellowshipUnitId === u.id);
    return { u, tithes: sumCat(uTxs, FinanceCategory.TITHE), off: sumCat(uTxs, FinanceCategory.OFFERTORY) };
  });
  const maxUnit = Math.max(1, ...perUnit.map((x) => x.tithes + x.off));
  const unitWord = isBacenta ? 'bacenta' : 'campus';
  return (
    <>
      <PageHeader title="Finance" subtitle={`Tithe and offertory remitted from ${unitWord} meetings.`} />
      <KpiGrid>
        <KpiCard label="Remitted" value={num(totalCollected)} subtitle={currency} tone="emerald" />
        <KpiCard label="Tithe" value={num(sumCat(txs, FinanceCategory.TITHE))} subtitle={currency} />
        <KpiCard label="Offertory" value={num(sumCat(txs, FinanceCategory.OFFERTORY))} subtitle={currency} />
      </KpiGrid>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
        <Card>
          <SectionTitle title={`By ${unitWord}`} aside="Tithe · Offertory" />
          <div className="divide-y divide-church-line">
            {perUnit.map(({ u, tithes, off }) => (
              <div key={u.id} className="flex flex-col gap-1.5 py-3">
                <div className="flex justify-between gap-3">
                  <span className="text-[15px] font-semibold">{u.name}</span>
                  <span className="oc-num text-[15px]">{num(tithes + off)}</span>
                </div>
                <div className="flex h-2 rounded bg-church-line overflow-hidden">
                  <span style={{ width: `${(tithes / maxUnit) * 100}%` }} className="bg-church-forest" />
                  <span style={{ width: `${(off / maxUnit) * 100}%` }} className="bg-church-lime" />
                </div>
                <span className="text-xs text-church-muted">
                  Tithe {num(tithes)} · Offertory {num(off)}
                </span>
              </div>
            ))}
          </div>
        </Card>
        {txs.length === 0 ? (
          <EmptyState icon={Coins} title="No remittances yet" />
        ) : (
          <ListCard title="Remittances" aside={currency}>
            {txs.map((t) => {
              const unit = units.find((u) => u.id === t.fellowshipUnitId);
              const tithe = t.category === FinanceCategory.TITHE;
              return (
                <Row
                  key={t.id}
                  lead={<Tile icon={tithe ? Wallet : Coins} tone={tithe ? 'blue' : 'amber'} />}
                  title={unit?.name ?? t.description}
                  sub={`${tithe ? 'Tithe' : 'Offertory'} · ${formatDate(t.transactionDate)} · ${t.paymentMethod}`}
                  trail={<span className="oc-num text-[15px] whitespace-nowrap">+{num(t.amount)}</span>}
                />
              );
            })}
          </ListCard>
        )}
      </div>
    </>
  );
};

// ─── DASHBOARD B: INDIVIDUAL BACENTA / CAMPUS LEADER DASHBOARD ────────────────

const LeaderMeetingCheckInView: React.FC<FellowshipProps> = ({ unitType }) => {
  useChurchStoreRefresh();
  const { user, activeTenantId } = useAuth();
  const isBacenta = unitType === FellowshipUnitType.BACENTA;
  const labelSingular = isBacenta ? 'Bacenta' : 'Campus';

  const units = FellowshipService.getUnits(activeTenantId, unitType);
  const myUnit = FellowshipService.getMyUnit(activeTenantId, unitType, user);

  const unitMembers = myUnit
    ? FellowshipService.getUnitMembers(activeTenantId, myUnit.id, unitType)
    : [];
  const pastMeetings = myUnit
    ? FellowshipService.getMeetings(activeTenantId, [myUnit.id])
    : [];

  const [meetingDate, setMeetingDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [title, setTitle] = useState('');
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [labourers, setLabourers] = useState(3);
  const [soulsWon, setSoulsWon] = useState(0);
  const [soulName, setSoulName] = useState('');
  const [soulPhone, setSoulPhone] = useState('');
  const [testimony, setTestimony] = useState('');
  const [savedBanner, setSavedBanner] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  if (!myUnit) {
    return (
      <div className="p-6 bg-white rounded-card text-sm text-church-muted">
        You haven’t been made leader of a {labelSingular} yet. Ask the Head of {labelSingular}s to appoint you when they
        create or edit a {labelSingular}.
      </div>
    );
  }

  const toggleCheck = (mId: string) => {
    setCheckedIds((prev) =>
      prev.includes(mId) ? prev.filter((x) => x !== mId) : [...prev, mId]
    );
  };

  const handleSubmitMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    FellowshipService.submitMeetingAndAttendance({
      tenantId: activeTenantId,
      unitId: myUnit.id,
      unitName: myUnit.name,
      unitType,
      meetingDate,
      title: title || `${myUnit.name} Weekly Meeting`,
      checkedInMemberIds: checkedIds,
      labourersCount: labourers,
      soulsWonCount: soulsWon,
      newSouls:
        soulsWon > 0 && soulName.trim()
          ? [{ fullName: soulName, phoneNumber: soulPhone }]
          : [],
      testimony,
      submittedBy: user.id,
    });
    setTitle('');
    setCheckedIds([]);
    setSoulsWon(0);
    setSoulName('');
    setSoulPhone('');
    setTestimony('');
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3500);
  };

  const handleQuickAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberPhone.trim()) return;
    const created = AttendanceAndMemberService.registerMember({
      tenantId: activeTenantId,
      fullName: newMemberName,
      phoneNumber: newMemberPhone,
      gender: 'Female',
      residence: myUnit.locationOrInstitution,
      bacentaId: isBacenta ? myUnit.id : null,
      campusId: !isBacenta ? myUnit.id : null,
      isFirstTimer: true,
    });
    setCheckedIds((prev) => [...prev, created.id]);
    setNewMemberName('');
    setNewMemberPhone('');
    setAddMemberOpen(false);
  };

  const pct = unitMembers.length ? Math.round((checkedIds.length / unitMembers.length) * 100) : 0;
  return (
    <>
      <PageHeader
        title="Meeting check-in"
        subtitle="Tap each member as they arrive, then send the report."
        actions={
          <button type="button" onClick={() => setAddMemberOpen(true)} className="oc-btn-dark">
            <UserPlus className="w-[18px] h-[18px] text-church-lime" /> Add member
          </button>
        }
      />
      <Columns
        main={
          <>
            <DarkCard eyebrow={`Meeting · ${myUnit.meetingDay}`} title={myUnit.name}>
              <span className="flex items-center gap-1.5 text-sm text-church-mist -mt-1">
                <MapPin className="w-4 h-4" /> {myUnit.locationOrInstitution}
              </span>
              <DarkStats
                items={[
                  { label: 'Present', value: checkedIds.length, accent: true },
                  { label: 'Members', value: unitMembers.length },
                  { label: 'Turn-out', value: `${pct}%` },
                ]}
              />
            </DarkCard>
            <SectionTitle title="Who’s here?" aside={`${checkedIds.length} of ${unitMembers.length}`} />
            {unitMembers.length === 0 ? (
              <EmptyState icon={Users} title="No members yet" sub="Add the people in your group." />
            ) : (
              <ListCard>
                {unitMembers.map((m) => {
                  const checked = checkedIds.includes(m.id);
                  return (
                    <Row
                      key={m.id}
                      lead={<Avatar name={m.fullName} />}
                      title={m.fullName}
                      sub={m.phoneNumber}
                      trail={
                        <button
                          type="button"
                          aria-pressed={checked}
                          onClick={() => toggleCheck(m.id)}
                          className={
                            checked
                              ? 'oc-btn !h-10 !px-3.5 !text-sm bg-church-posSoft text-[#0E5A37]'
                              : 'oc-btn-dark !h-10 !px-4 !text-sm'
                          }
                        >
                          {checked ? (
                            <>
                              <Check className="w-4 h-4" /> Present
                            </>
                          ) : (
                            'Present'
                          )}
                        </button>
                      }
                    />
                  );
                })}
              </ListCard>
            )}
            {pastMeetings.length > 0 && (
              <ListCard title="Sent reports">
                {pastMeetings.map((pm) => (
                  <Row
                    key={pm.id}
                    lead={<Tile icon={CalendarDays} />}
                    title={pm.title}
                    sub={`${formatDate(pm.meetingDate)} · ${pm.labourersCount} labourers · ${pm.soulsWonCount} souls`}
                  />
                ))}
              </ListCard>
            )}
          </>
        }
        side={
          <Card as="form" onSubmit={handleSubmitMeeting} className="!gap-4">
            <SectionTitle title="Meeting report" aside={`For the Head of ${labelSingular === 'Campus' ? 'Campuses' : 'Bacentas'}`} />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Labourers" value={labourers} min={1} onChange={setLabourers} required />
              <NumberInput label="Souls won" value={soulsWon} min={0} onChange={setSoulsWon} />
            </div>
            {soulsWon > 0 && (
              <div className="grid grid-cols-1 gap-3 p-3 rounded-2xl bg-church-limeSoft">
                <TextInput label="New believer’s name" value={soulName} onChange={setSoulName} placeholder="Goes to 4-week follow-up" />
                <PhoneInput label="Their phone" value={soulPhone} onChange={setSoulPhone} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <DateInput label="Date" value={meetingDate} onChange={setMeetingDate} required />
              <TextInput label="Topic" value={title} onChange={setTitle} placeholder="Weekly fellowship" />
            </div>
            <TextAreaInput label="Testimony" value={testimony} onChange={setTestimony} placeholder="What did God do in the meeting?" required />
            {savedBanner && (
              <p role="status" className="m-0 px-3.5 py-3 rounded-[14px] bg-church-posSoft text-sm font-semibold text-[#0E5A37]">
                Sent to the Head of {labelSingular === 'Campus' ? 'Campuses' : 'Bacentas'}.
              </p>
            )}
            <button type="submit" className="oc-btn-primary w-full !h-14 !text-base">
              <Send className="w-[18px] h-[18px]" /> Submit attendance & report
            </button>
          </Card>
        }
      />

      <MobileSheet
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        title={`Add Member to ${myUnit.name}`}
      >
        <form onSubmit={handleQuickAddMember} className="space-y-4">
          <TextInput label="Full Name" value={newMemberName} onChange={setNewMemberName} required />
          <PhoneInput label="Phone Number" value={newMemberPhone} onChange={setNewMemberPhone} required />
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Save & Check In
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

const LeaderOutreachView: React.FC<FellowshipProps> = ({ unitType }) => {
  useChurchStoreRefresh();
  const { user, activeTenantId } = useAuth();
  const units = FellowshipService.getUnits(activeTenantId, unitType);
  const myUnit = FellowshipService.getMyUnit(activeTenantId, unitType, user);
  const outreaches = myUnit
    ? FellowshipService.getOutreaches(activeTenantId, [myUnit.id])
    : [];

  const [outreachDate, setOutreachDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [location, setLocation] = useState('');
  const [labourers, setLabourers] = useState(4);
  const [soulsWon, setSoulsWon] = useState(1);
  const [soulName, setSoulName] = useState('');
  const [soulPhone, setSoulPhone] = useState('');
  const [testimony, setTestimony] = useState('');

  if (!myUnit) {
    return (
      <div className="p-6 bg-white rounded-card text-sm text-church-muted">
        You haven’t been made leader of a {unitType === FellowshipUnitType.BACENTA ? 'Bacenta' : 'Campus'} yet.
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !testimony.trim()) return;
    FellowshipService.submitOutreachReport({
      tenantId: activeTenantId,
      unitId: myUnit.id,
      unitName: myUnit.name,
      unitType,
      outreachDate,
      location: location || myUnit.locationOrInstitution,
      labourersCount: labourers,
      soulsWonCount: soulsWon,
      newSouls:
        soulsWon > 0 && soulName.trim()
          ? [{ fullName: soulName, phoneNumber: soulPhone }]
          : [],
      testimony,
      submittedBy: user.id,
    });
    setLocation('');
    setSoulName('');
    setSoulPhone('');
    setTestimony('');
  };

  return (
    <>
      <PageHeader title="Outreach report" subtitle="Where you went, who laboured and the souls won." />
      <Columns
        main={
          <Card as="form" onSubmit={handleSubmit} className="!gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DateInput label="Date" value={outreachDate} onChange={setOutreachDate} required />
              <TextInput label="Location" value={location} onChange={setLocation} placeholder={myUnit.locationOrInstitution} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Labourers" value={labourers} min={1} onChange={setLabourers} required />
              <NumberInput label="Souls won" value={soulsWon} min={0} onChange={setSoulsWon} required />
            </div>
            {soulsWon > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-church-limeSoft">
                <TextInput label="First soul’s name" value={soulName} onChange={setSoulName} placeholder="Goes to 4-week follow-up" />
                <PhoneInput label="Their phone" value={soulPhone} onChange={setSoulPhone} />
              </div>
            )}
            <TextAreaInput label="Testimony" value={testimony} onChange={setTestimony} placeholder="Salvations, miracles, open doors…" required />
            <button type="submit" className="oc-btn-primary w-full !h-14 !text-base">
              <Send className="w-[18px] h-[18px]" /> Submit outreach report
            </button>
          </Card>
        }
        side={
          <>
            <SectionTitle title="Submitted" aside={`${outreaches.length}`} />
            {outreaches.length === 0 ? (
              <EmptyState icon={Megaphone} title="No outreaches yet" />
            ) : (
              outreaches.map((o) => (
                <Card key={o.id}>
                  <div className="flex justify-between gap-2.5">
                    <span className="font-display text-lg font-semibold leading-snug">{o.location || myUnit.locationOrInstitution}</span>
                    <span className="oc-sub whitespace-nowrap">{formatDate(o.outreachDate)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>{o.labourersCount} labourers</Badge>
                    <Badge kind="ok">{o.soulsWonCount} souls won</Badge>
                  </div>
                  {o.testimony && (
                    <p className="m-0 px-3.5 py-3 rounded-[14px] bg-church-soft text-sm leading-relaxed text-[#3E4741]">“{o.testimony}”</p>
                  )}
                </Card>
              ))
            )}
          </>
        }
      />
    </>
  );
};

const LeaderMeetingFinanceView: React.FC<FellowshipProps> = ({ unitType }) => {
  useChurchStoreRefresh();
  const { user, tenant, activeTenantId } = useAuth();
  const currency = tenant?.currency || 'UGX';

  const units = FellowshipService.getUnits(activeTenantId, unitType);
  const myUnit = FellowshipService.getMyUnit(activeTenantId, unitType, user);

  const [category, setCategory] = useState<
    FinanceCategory.OFFERTORY | FinanceCategory.TITHE
  >(FinanceCategory.OFFERTORY);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<'Cash' | 'Mobile Money' | 'Bank Transfer'>(
    'Mobile Money'
  );
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [refCode, setRefCode] = useState('');

  if (!myUnit) {
    return (
      <div className="p-6 bg-white rounded-card text-sm text-church-muted">
        You haven’t been made leader of a {unitType === FellowshipUnitType.BACENTA ? 'Bacenta' : 'Campus'} yet.
      </div>
    );
  }

  const unitTxs = FinanceService.getTransactions(activeTenantId).filter(
    (t) => t.fellowshipUnitId === myUnit.id
  );

  const handleSubmitFinance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || amount <= 0) return;
    FellowshipService.submitUnitFinance({
      tenantId: activeTenantId,
      unitId: myUnit.id,
      unitName: myUnit.name,
      unitType,
      category,
      amount,
      paymentMethod: method,
      referenceCode: refCode,
      transactionDate: date,
      recordedBy: user.id,
    });
    setAmount(0);
    setRefCode('');
  };

  const sentTotal = unitTxs.reduce((t, x) => t + x.amount, 0);
  return (
    <>
      <PageHeader title="Meeting finance" subtitle={`Send what was collected at ${myUnit.name} to Finance.`} />
      <Columns
        main={
          <Card as="form" onSubmit={handleSubmitFinance} className="!gap-4">
            <Segment
              options={[
                { value: FinanceCategory.OFFERTORY, label: 'Offertory' },
                { value: FinanceCategory.TITHE, label: 'Tithe' },
              ]}
              value={category}
              onChange={(v) => setCategory(v as FinanceCategory.OFFERTORY | FinanceCategory.TITHE)}
            />
            <HeroAmountInput
              label="Amount"
              currency={currency}
              value={amount}
              onChange={setAmount}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput
                label="Channel"
                value={method}
                onChange={(v) => setMethod(v as 'Cash' | 'Mobile Money' | 'Bank Transfer')}
                options={[
                  { value: 'Mobile Money', label: 'Mobile Money' },
                  { value: 'Cash', label: 'Cash' },
                  { value: 'Bank Transfer', label: 'Bank' },
                ]}
              />
              <DateInput label="Date" value={date} onChange={setDate} required />
            </div>
            <TextInput label="Reference (optional)" value={refCode} onChange={setRefCode} placeholder="MM-77812" />
            <button type="submit" className="oc-btn-primary w-full !h-14 !text-base">
              Send to Finance
            </button>
          </Card>
        }
        side={
          unitTxs.length === 0 ? (
            <EmptyState icon={Coins} title="Nothing sent yet" />
          ) : (
            <ListCard title="Sent" aside={`${currency} ${num(sentTotal)}`}>
              {unitTxs.map((tx) => {
                const tithe = tx.category === FinanceCategory.TITHE;
                return (
                  <Row
                    key={tx.id}
                    lead={<Tile icon={tithe ? Wallet : Coins} tone={tithe ? 'blue' : 'amber'} />}
                    title={tithe ? 'Tithe' : 'Offertory'}
                    sub={`${formatDate(tx.transactionDate)} · ${tx.paymentMethod}`}
                    trail={<span className="oc-num text-[15px] whitespace-nowrap">{num(tx.amount)}</span>}
                  />
                );
              })}
            </ListCard>
          )
        }
      />
    </>
  );
};

export const FellowshipModule: React.FC<FellowshipProps> = ({ unitType }) => {
  const { user } = useAuth();
  const isBacenta = unitType === FellowshipUnitType.BACENTA;
  const deptCode = isBacenta ? DepartmentCode.BACENTA : DepartmentCode.CAMPUSES;

  const isLeaderOnly =
    user?.role === UserRole.BACENTA_LEADER || user?.role === UserRole.CAMPUS_LEADER;

  return (
    <Routes>
      {/* Head of Bacentas / Head of Campuses Routes */}
      <Route
        path="hod"
        element={
          isLeaderOnly ? (
            <Navigate to="../my-unit" replace />
          ) : (
            <HodUnitsAndReportsView unitType={unitType} />
          )
        }
      />
      <Route
        path="hod/attendance"
        element={
          isLeaderOnly ? (
            <Navigate to="../../my-unit" replace />
          ) : (
            <HodDualAttendanceView unitType={unitType} />
          )
        }
      />
      <Route
        path="hod/finance"
        element={
          isLeaderOnly ? (
            <Navigate to="../../my-unit" replace />
          ) : (
            <HodUnitFinanceView unitType={unitType} />
          )
        }
      />
      <Route
        path="hod/more"
        element={
          isLeaderOnly ? (
            <Navigate to="../../my-unit" replace />
          ) : (
            <HodMoreTab departmentCode={deptCode} />
          )
        }
      />

      {/* Individual Bacenta / Campus Dashboard Routes */}
      <Route path="my-unit" element={<LeaderMeetingCheckInView unitType={unitType} />} />
      <Route path="my-unit/outreach" element={<LeaderOutreachView unitType={unitType} />} />
      <Route
        path="my-unit/finance"
        element={<LeaderMeetingFinanceView unitType={unitType} />}
      />

      <Route
        path="*"
        element={<Navigate to={isLeaderOnly ? 'my-unit' : 'hod'} replace />}
      />
    </Routes>
  );
};
