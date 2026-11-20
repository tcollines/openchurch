import React, { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Footprints,
  MessageCircle,
  NotebookPen,
  Phone,
  PhoneCall,
  Search,
  Send,
  Sparkles,
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
  TelePastoringService,
} from '@/services/churchService';
import {
  AbsenteeStatus,
  DepartmentCode,
  ReachoutMode,
  UserRole,
} from '@/shared/enums';
import {
  formatCurrency,
  formatDate,
  getWhatsAppLink,
} from '@/shared/formatters';
import {
  DateInput,
  KpiCard,
  MobileSheet,
  NumberInput,
  SelectInput,
  StatusBadge,
  TextAreaInput,
} from '@/components/ui/FormControls';
import { HodMoreTab } from '@/components/hod-more/HodMoreTab';

const ThreeMissedServicesView: React.FC = () => {
  useChurchStoreRefresh();
  const { user, activeTenantId } = useAuth();
  const absentees = TelePastoringService.getThreeServiceAbsentees(
    activeTenantId,
    'ADULT'
  );

  const [filter, setFilter] = useState<'pending' | 'followed'>('pending');
  const [activePersonId, setActivePersonId] = useState<string | null>(null);
  const [status, setStatus] = useState<AbsenteeStatus>(AbsenteeStatus.CONTACTED);
  const [comment, setComment] = useState('');

  const pendingList = absentees.filter((a) => !a.followup?.comment);
  const followedList = absentees.filter((a) => Boolean(a.followup?.comment));
  const displayed = filter === 'pending' ? pendingList : followedList;

  const selectedPerson = absentees.find((a) => a.personId === activePersonId) ?? null;

  const handleSaveFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson || !comment.trim() || !user) return;
    TelePastoringService.saveAbsenteeFollowup({
      tenantId: activeTenantId,
      personType: 'ADULT',
      personId: selectedPerson.personId,
      status,
      comment,
      followedBy: user.id,
    });
    setActivePersonId(null);
    setComment('');
  };

  return (
    <>
      <PageHeader title="Absentees" subtitle="Members who’ve missed 3 services in a row. Reach out and log how they’re doing." />
      <Chips
        items={[
          { value: 'pending', label: 'Needs contact', count: pendingList.length },
          { value: 'followed', label: 'Followed up', count: followedList.length },
        ]}
        value={filter}
        onChange={(v) => setFilter(v as 'pending' | 'followed')}
      />
      {displayed.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title={filter === 'pending' ? 'Everyone has been contacted' : 'No notes yet'}
          sub={filter === 'pending' ? 'Nice work — nobody is waiting for a call.' : 'Notes you log will show up here.'}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {displayed.map((item) => (
            <Card key={item.personId}>
              <div className="flex items-center gap-3">
                <Avatar name={item.fullName} />
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="text-base font-semibold truncate">{item.fullName}</span>
                    {item.followup?.comment ? <Badge kind="ok">Contacted</Badge> : <Badge kind="warn">Missed 3</Badge>}
                  </span>
                  <span className="oc-sub truncate">
                    {item.secondaryLabel} · last seen {item.lastAttendedDate ? formatDate(item.lastAttendedDate) : 'never'}
                  </span>
                </span>
                <ContactButtons phone={item.phoneNumber} name={item.fullName} />
              </div>
              {item.followup?.comment && (
                <p className="m-0 px-3.5 py-3 rounded-[14px] bg-church-soft text-sm leading-relaxed text-[#3E4741]">{item.followup.comment}</p>
              )}
              <button
                type="button"
                onClick={() => {
                  setActivePersonId(item.personId);
                  setStatus(item.followup?.status || AbsenteeStatus.CONTACTED);
                  setComment(item.followup?.comment || '');
                }}
                className={item.followup?.comment ? 'oc-btn-ghost w-full !h-12' : 'oc-btn-dark w-full !h-12'}
              >
                <NotebookPen className={`w-[18px] h-[18px] ${item.followup?.comment ? '' : 'text-church-lime'}`} />
                {item.followup?.comment ? 'Edit note' : 'Log how they are'}
              </button>
            </Card>
          ))}
        </div>
      )}

      <MobileSheet
        open={Boolean(selectedPerson)}
        onClose={() => setActivePersonId(null)}
        title={`Contact Note: ${selectedPerson?.fullName ?? ''}`}
        subtitle={selectedPerson?.phoneNumber}
      >
        <form onSubmit={handleSaveFollowUp} className="space-y-4">
          <SelectInput
            label="Outcome Status"
            value={status}
            onChange={(v) => setStatus(v as AbsenteeStatus)}
            options={[
              { value: AbsenteeStatus.CONTACTED, label: 'Contacted — In Touch' },
              { value: AbsenteeStatus.RESOLVED, label: 'Resolved — Returning' },
              { value: AbsenteeStatus.PENDING, label: 'Unreachable — Try Again' },
            ]}
          />
          <TextAreaInput
            label="Pastoral Comment"
            value={comment}
            onChange={setComment}
            placeholder="Write any issue shared, prayer point, or pastoral action..."
            required
          />
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Save Comment
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

const SubmitReachoutReportView: React.FC = () => {
  useChurchStoreRefresh();
  const { user, tenant, activeTenantId } = useAuth();
  const currency = tenant?.currency || 'UGX';

  const members = AttendanceAndMemberService.getMembers(activeTenantId);
  const reachouts = TelePastoringService.getReachouts(activeTenantId);

  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || '');
  const [mode, setMode] = useState<ReachoutMode>(ReachoutMode.PHYSICAL_VISIT);
  const [labourers, setLabourers] = useState(2);
  const [amount, setAmount] = useState(0);
  const [comment, setComment] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [savedToast, setSavedToast] = useState(false);

  const filteredMembers = members.filter(
    (m) =>
      !memberSearch.trim() ||
      m.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.phoneNumber.includes(memberSearch)
  );

  const handleSubmitReachout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedMemberId || !comment.trim()) return;

    TelePastoringService.submitReachout({
      tenantId: activeTenantId,
      memberId: selectedMemberId,
      mode,
      labourersCount: mode === ReachoutMode.PHYSICAL_VISIT ? labourers : null,
      amountSpentOrSent: amount,
      comment,
      reachoutDate: date,
      reachedBy: user.id,
    });
    setAmount(0);
    setComment('');
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const selectedMember = members.find((m) => m.id === selectedMemberId) ?? null;
  const monthSpent = reachouts.reduce((t, r) => t + (r.amountSpent || 0), 0);
  const form = (
    <Card as="form" onSubmit={handleSubmitReachout} className="!gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="oc-label">Member</span>
        <SearchField
          value={memberSearch}
          onChange={(v) => {
            setMemberSearch(v);
            const first = members.find((m) => m.fullName.toLowerCase().includes(v.toLowerCase()) || m.phoneNumber.includes(v));
            if (first) setSelectedMemberId(first.id);
          }}
          placeholder="Find a member by name or phone"
        />
      </label>
      {selectedMember && (
        <label className="relative flex items-center gap-3 px-3 py-2.5 rounded-2xl border-[1.5px] border-church-border">
          <Avatar name={selectedMember.fullName} />
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[15px] font-semibold truncate">{selectedMember.fullName}</span>
            <span className="oc-sub truncate">
              {selectedMember.phoneNumber} · {selectedMember.residence}
            </span>
          </span>
          <span className="text-sm font-semibold text-church-emerald">Change</span>
          <select
            aria-label="Member"
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          >
            {filteredMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName} — {m.residence}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { v: ReachoutMode.PHYSICAL_VISIT, label: 'Visit', icon: Footprints },
          { v: ReachoutMode.PHONE_CALL, label: 'Call', icon: PhoneCall },
        ].map((o) => {
          const on = mode === o.v;
          const I = o.icon;
          return (
            <button
              key={o.v}
              type="button"
              aria-pressed={on}
              onClick={() => setMode(o.v)}
              className={`oc-press flex items-center gap-2.5 p-3.5 rounded-2xl text-[15px] font-bold ${
                on ? 'bg-church-forest text-white' : 'bg-church-canvas text-church-text'
              }`}
            >
              <I className={`w-5 h-5 ${on ? 'text-church-lime' : ''}`} /> {o.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {mode === ReachoutMode.PHYSICAL_VISIT ? (
          <NumberInput label="Labourers" value={labourers} min={1} onChange={setLabourers} required />
        ) : (
          <DateInput label="Date" value={date} onChange={setDate} required />
        )}
        <NumberInput
          label={mode === ReachoutMode.PHYSICAL_VISIT ? 'Spent' : 'Sent (airtime / MoMo)'}
          value={amount}
          min={0}
          prefix={currency}
          onChange={setAmount}
        />
      </div>
      {mode === ReachoutMode.PHYSICAL_VISIT && <DateInput label="Date" value={date} onChange={setDate} required />}
      <TextAreaInput
        label="Report"
        value={comment}
        onChange={setComment}
        placeholder={
          mode === ReachoutMode.PHYSICAL_VISIT
            ? 'Visit outcome, welfare support, prayer requests…'
            : 'What you talked about and how they are…'
        }
        required
      />
      {savedToast && (
        <p role="status" className="m-0 px-3.5 py-3 rounded-[14px] bg-church-posSoft text-sm font-semibold text-[#0E5A37]">
          Saved. Any money spent or sent has gone to Finance.
        </p>
      )}
      <button type="submit" className="oc-btn-primary w-full !h-14 !text-base">
        <Send className="w-[18px] h-[18px]" /> Submit reachout
      </button>
    </Card>
  );

  return (
    <>
      <PageHeader title="Reachout" subtitle="Log a visit or call. Money spent or sent goes to Finance automatically." />
      <Columns
        main={form}
        side={
          <>
            {reachouts.length === 0 ? (
              <EmptyState icon={Footprints} title="No reachouts yet" />
            ) : (
              <ListCard title="Recent">
                {reachouts.map((r) => {
                  const member = members.find((m) => m.id === r.memberId);
                  const visit = r.mode === ReachoutMode.PHYSICAL_VISIT;
                  return (
                    <Row
                      key={r.id}
                      lead={<Tile icon={visit ? Footprints : PhoneCall} tone={visit ? 'violet' : 'blue'} />}
                      title={member?.fullName ?? 'Member'}
                      sub={`${visit ? 'Visit' : 'Call'} · ${formatDate(r.reachoutDate)}${visit && r.labourersCount ? ` · ${r.labourersCount} labourers` : ''}${
                        r.amountSpent ? ` · ${num(r.amountSpent)}` : ''
                      }`}
                    />
                  );
                })}
              </ListCard>
            )}
            <Card>
              <div className="flex items-center gap-3">
                <Tile icon={Wallet} tone="amber" />
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">
                    {currency} {num(monthSpent)} sent to Finance
                  </span>
                  <span className="oc-sub">Synced automatically as expenses</span>
                </span>
              </div>
            </Card>
          </>
        }
      />
    </>
  );
};

const SoulsFourWeekTrackerView: React.FC = () => {
  useChurchStoreRefresh();
  const { user, activeTenantId } = useAuth();

  const souls = TelePastoringService.getSoulsWon(activeTenantId);
  const allWeeks = TelePastoringService.getSoulFollowupWeeks(activeTenantId);

  const [selectedSoulId, setSelectedSoulId] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<1 | 2 | 3 | 4>(1);
  const [contactMode, setContactMode] = useState<ReachoutMode>(
    ReachoutMode.PHONE_CALL
  );
  const [attendedService, setAttendedService] = useState(true);
  const [comment, setComment] = useState('');

  const activeSoul = souls.find((s) => s.id === selectedSoulId) ?? null;

  const handleSaveWeek = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSoul || !comment.trim() || !user) return;
    TelePastoringService.recordSoulFollowupWeek({
      tenantId: activeTenantId,
      soulId: activeSoul.id,
      weekNumber: selectedWeek,
      contactMode,
      attendedService,
      comment,
      completedBy: user.id,
    });
    setSelectedSoulId(null);
    setComment('');
  };

  const [soulFilter, setSoulFilter] = useState<'progress' | 'integrated'>('progress');
  const inProgress = souls.filter((x) => x.status !== 'INTEGRATED');
  const integratedSouls = souls.filter((x) => x.status === 'INTEGRATED');
  const shown = soulFilter === 'progress' ? inProgress : integratedSouls;
  return (
    <>
      <PageHeader title="Souls" subtitle="Four weeks of care for every new believer, until they’re part of the family." />
      <Card>
        <Stats
          items={[
            { label: 'In follow-up', value: inProgress.length, color: '#A15C00' },
            { label: 'Integrated', value: integratedSouls.length, color: '#116B43' },
            { label: 'All souls', value: souls.length },
          ]}
        />
      </Card>
      <Chips
        items={[
          { value: 'progress', label: 'In progress', count: inProgress.length },
          { value: 'integrated', label: 'Integrated', count: integratedSouls.length },
        ]}
        value={soulFilter}
        onChange={(v) => setSoulFilter(v as 'progress' | 'integrated')}
      />
      {shown.length === 0 ? (
        <EmptyState icon={Sparkles} title="Nobody here yet" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {shown.map((soul) => {
            const soulWeeks = allWeeks.filter((w) => w.soulId === soul.id);
            return (
              <Card key={soul.id}>
                <div className="flex items-center gap-3">
                  <Avatar name={soul.fullName} />
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-base font-semibold truncate">{soul.fullName}</span>
                    <span className="oc-sub truncate">
                      {soul.sourceLabel} · {formatDate(soul.wonDate)}
                    </span>
                  </span>
                  {soul.phoneNumber && <ContactButtons phone={soul.phoneNumber} name={soul.fullName} />}
                </div>
                <div className="flex justify-between">
                  <span className="oc-sub">4-week follow-up</span>
                  <span className="oc-num text-sm">{soulWeeks.length} of 4</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([1, 2, 3, 4] as const).map((wk) => {
                    const done = soulWeeks.find((w) => w.weekNumber === wk);
                    return (
                      <button
                        key={wk}
                        type="button"
                        aria-label={`Week ${wk}${done ? ' — done' : ''}`}
                        onClick={() => {
                          setSelectedSoulId(soul.id);
                          setSelectedWeek(wk);
                          setContactMode(done?.contactMode || ReachoutMode.PHONE_CALL);
                          setAttendedService(done?.attendedService ?? true);
                          setComment(done?.comment || '');
                        }}
                        className={`oc-press flex flex-col items-center gap-1.5 py-2 rounded-[14px] ${done ? 'bg-church-limeSoft' : 'bg-church-soft'}`}
                      >
                        <span
                          className={`w-[26px] h-[26px] rounded-full flex items-center justify-center font-display text-xs font-bold text-church-forest ${
                            done ? 'bg-church-lime' : 'bg-white'
                          }`}
                        >
                          {done ? <Check className="w-3.5 h-3.5" /> : wk}
                        </span>
                        <span className={`text-xs font-semibold ${done ? 'text-[#2F5D10]' : 'text-church-muted'}`}>Week {wk}</span>
                      </button>
                    );
                  })}
                </div>
                {soulWeeks.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {soulWeeks.map((w) => (
                      <p key={w.id} className="m-0 text-sm leading-snug text-[#3E4741]">
                        <b className="text-church-text">Wk {w.weekNumber}</b> · {w.comment}
                      </p>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <MobileSheet
        open={Boolean(activeSoul)}
        onClose={() => setSelectedSoulId(null)}
        title={`Week ${selectedWeek} Follow-Up — ${activeSoul?.fullName ?? ''}`}
        subtitle="4-Week New Believer Care & Retention"
      >
        <form onSubmit={handleSaveWeek} className="space-y-4">
          <SelectInput
            label="Contact Method"
            value={contactMode}
            onChange={(v) => setContactMode(v as ReachoutMode)}
            options={[
              { value: ReachoutMode.PHONE_CALL, label: 'Phone Call' },
              { value: ReachoutMode.PHYSICAL_VISIT, label: 'Physical Visit' },
            ]}
          />
          <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-church-limeSoft border border-church-limeLine cursor-pointer">
            <input
              type="checkbox"
              checked={attendedService}
              onChange={(e) => setAttendedService(e.target.checked)}
              className="w-4 h-4 accent-church-emerald"
            />
            <span className="text-xs font-bold text-church-pos">
              Attended Church Service / Bacenta This Week
            </span>
          </label>
          <TextAreaInput
            label={`Week ${selectedWeek} Pastoral Note`}
            value={comment}
            onChange={setComment}
            placeholder="Foundation topic shared, prayer request, or feedback..."
            required
          />
          <button
            type="submit"
            className="oc-btn-primary w-full"
          >
            Save Week {selectedWeek} Follow-Up
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

const TeleMembersDashboardView: React.FC = () => {
  useChurchStoreRefresh();
  const { activeTenantId } = useAuth();
  const members = AttendanceAndMemberService.getMembers(activeTenantId);
  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const allAtt = AttendanceAndMemberService.getServiceAttendance(activeTenantId);
  const reachouts = TelePastoringService.getReachouts(activeTenantId);

  const [search, setSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const filtered = members.filter(
    (m) =>
      !search.trim() ||
      m.fullName.toLowerCase().includes(search.toLowerCase()) ||
      m.phoneNumber.includes(search) ||
      m.residence.toLowerCase().includes(search.toLowerCase())
  );

  const inspectMember = members.find((m) => m.id === selectedMemberId) ?? null;

  return (
    <>
      <PageHeader title="Members" subtitle="Attendance and pastoral history for every member." />
      <SearchField value={search} onChange={setSearch} placeholder="Search name, phone or area" />
      <ListCard>
        {filtered.map((m) => {
          const attended = allAtt.filter((a) => a.memberId === m.id).length;
          const pct = services.length > 0 ? Math.round((attended / services.length) * 100) : 0;
          return (
            <div key={m.id} className="flex items-center gap-3 py-3 min-h-[64px]">
              <button type="button" onClick={() => setSelectedMemberId(m.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                <Avatar name={m.fullName} />
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold truncate">{m.fullName}</span>
                  <span className="oc-sub truncate">
                    {m.residence} · {pct}% attendance
                  </span>
                </span>
                <span className="hidden sm:flex w-36">
                  <MiniBar pct={pct} />
                </span>
              </button>
              <ContactButtons phone={m.phoneNumber} name={m.fullName} />
            </div>
          );
        })}
      </ListCard>

      <MobileSheet
        open={Boolean(inspectMember)}
        onClose={() => setSelectedMemberId(null)}
        title={inspectMember?.fullName ?? ''}
        subtitle={`${inspectMember?.phoneNumber ?? ''} • ${inspectMember?.residence ?? ''}`}
      >
        {inspectMember && (
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-church-muted">
              Pastoral Reachout History
            </h4>
            {reachouts.filter((r) => r.memberId === inspectMember.id).length === 0 ? (
              <p className="text-xs text-church-muted">No reachout reports logged yet.</p>
            ) : (
              reachouts
                .filter((r) => r.memberId === inspectMember.id)
                .map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-2xl bg-church-soft border border-church-line text-xs space-y-1"
                  >
                    <div className="flex justify-between font-bold">
                      <span>{r.mode.replace('_', ' ')}</span>
                      <span>{formatDate(r.reachoutDate)}</span>
                    </div>
                    <p className="text-church-muted">{r.comment}</p>
                  </div>
                ))
            )}
          </div>
        )}
      </MobileSheet>
    </>
  );
};

export const TelePastoringModule: React.FC = () => {
  const { user } = useAuth();
  const canSeeMore =
    user?.role === UserRole.TELE_HOD ||
    user?.role === UserRole.ADMIN ||
    user?.role === UserRole.PLATFORM_ADMIN;

  return (
    <Routes>
      <Route path="absentees" element={<ThreeMissedServicesView />} />
      <Route path="reachout" element={<SubmitReachoutReportView />} />
      <Route path="souls" element={<SoulsFourWeekTrackerView />} />
      <Route path="members" element={<TeleMembersDashboardView />} />
      <Route
        path="more"
        element={
          canSeeMore ? (
            <HodMoreTab departmentCode={DepartmentCode.TELE_PASTORING} />
          ) : (
            <Navigate to="/tele-pastoring/absentees" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="absentees" replace />} />
    </Routes>
  );
};

