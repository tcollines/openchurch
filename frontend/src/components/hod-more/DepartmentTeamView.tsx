import React, { useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, KeyRound, Mail, Plus, Search, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import { AttendanceAndMemberService, DepartmentService, PlatformService } from '@/services/churchService';
import { DepartmentCode, UserRole } from '@/shared/enums';
import { formatDate } from '@/shared/formatters';
import { MobileSheet } from '@/components/ui/FormControls';
import { Avatar, Badge, Card, EmptyState, PageHeader, PickerRow, Segment, Stats } from '@/components/ui/kit';

type ServingRole = 'HOD' | 'Coordinator' | 'Member';

const DEPT_SHORT: Record<string, string> = {
  [DepartmentCode.ADMIN]: 'Administration',
  [DepartmentCode.FINANCE]: 'Finance',
  [DepartmentCode.BACENTA]: 'Bacentas',
  [DepartmentCode.AIRPORT_STARS]: 'Airport Stars',
  [DepartmentCode.TELE_PASTORING]: 'Tele Pastoring',
  [DepartmentCode.CHILDRENS_CHURCH]: 'Children’s Church',
  [DepartmentCode.CAMPUSES]: 'Campuses',
  [DepartmentCode.DISCIPLESHIP]: 'Discipleship',
};

/** Which dashboard a new login gets, by department and serving role. */
const LOGIN_ROLE: Record<string, { hod: UserRole; member: UserRole }> = {
  [DepartmentCode.ADMIN]: { hod: UserRole.ADMIN, member: UserRole.ADMIN },
  [DepartmentCode.FINANCE]: { hod: UserRole.FINANCE_HOD, member: UserRole.FINANCE_OFFICER },
  [DepartmentCode.BACENTA]: { hod: UserRole.BACENTA_HOD, member: UserRole.BACENTA_LEADER },
  [DepartmentCode.AIRPORT_STARS]: { hod: UserRole.AIRPORT_HOD, member: UserRole.AIRPORT_MEMBER },
  [DepartmentCode.TELE_PASTORING]: { hod: UserRole.TELE_HOD, member: UserRole.TELE_PASTOR },
  [DepartmentCode.CHILDRENS_CHURCH]: { hod: UserRole.CHILDREN_HOD, member: UserRole.CHILDREN_WORKER },
  [DepartmentCode.CAMPUSES]: { hod: UserRole.CAMPUS_HOD, member: UserRole.CAMPUS_LEADER },
  [DepartmentCode.DISCIPLESHIP]: { hod: UserRole.DISCIPLESHIP_HOD, member: UserRole.DISCIPLESHIP_MEMBER },
};

const prettyPhone = (p: string) => p.replace(/^\+?256(\d{3})(\d{3})(\d{3})$/, '+256 $1 $2 $3');

/**
 * Department team: who serves, who's on duty this service,
 * and adding someone by searching the church database.
 */
/** Duty tracked against something other than church services (e.g. Discipleship classes). */
export interface DutySessions {
  noun: string;
  sessions: { id: string; label: string }[];
  isOnDuty: (memberId: string, sessionId: string) => boolean;
  toggle: (memberId: string, sessionId: string, onDuty: boolean) => void;
  attendancePct: (memberId: string) => number;
}

export const DepartmentTeamView: React.FC<{ departmentCode: DepartmentCode; onBack?: () => void; duty?: DutySessions }> = ({
  departmentCode,
  onBack,
  duty,
}) => {
  useChurchStoreRefresh();
  const { user, activeTenantId } = useAuth();
  const dept = DepartmentService.getDepartmentByCode(activeTenantId, departmentCode);
  const deptName = DEPT_SHORT[departmentCode] ?? dept?.name ?? '';

  const services = AttendanceAndMemberService.getServices(activeTenantId);
  const members = AttendanceAndMemberService.getMembers(activeTenantId);
  const allAtt = AttendanceAndMemberService.getServiceAttendance(activeTenantId);
  const departments = DepartmentService.getDepartments(activeTenantId);
  const allServing = DepartmentService.getServingMembers(activeTenantId);
  const serving = dept ? allServing.filter((s) => s.departmentId === dept.id) : [];
  const users = PlatformService.getUsersForTenant(activeTenantId);

  const sessions = duty ? duty.sessions : services.map((s) => ({ id: s.id, label: `${s.title} · ${formatDate(s.serviceDate)}` }));
  const [serviceId, setServiceId] = useState(sessions[0]?.id ?? '');
  const activeServiceId = serviceId || sessions[0]?.id || '';
  const onDutyIds = new Set(
    duty
      ? serving.filter((sm) => duty.isOnDuty(sm.memberId, activeServiceId)).map((sm) => sm.memberId)
      : allAtt.filter((a) => a.serviceId === activeServiceId).map((a) => a.memberId)
  );

  const rows = serving
    .map((sm) => {
      const m = members.find((x) => x.id === sm.memberId);
      if (!m) return null;
      const attended = allAtt.filter((a) => a.memberId === m.id).length;
      const pct = duty ? duty.attendancePct(m.id) : services.length ? Math.round((attended / services.length) * 100) : 0;
      return { sm, m, pct, login: users.find((u) => u.id === sm.userId) ?? null, onDuty: onDutyIds.has(m.id) };
    })
    .filter(Boolean) as { sm: (typeof serving)[number]; m: (typeof members)[number]; pct: number; login: (typeof users)[number] | null; onDuty: boolean }[];
  const order: Record<ServingRole, number> = { HOD: 0, Coordinator: 1, Member: 2 };
  rows.sort((a, b) => order[a.sm.servingRole] - order[b.sm.servingRole]);

  const dutyCount = rows.filter((r) => r.onDuty).length;
  const avg = rows.length ? Math.round(rows.reduce((t, r) => t + r.pct, 0) / rows.length) : 0;

  const toggleDuty = (memberId: string, on: boolean) => {
    if (!activeServiceId || !user) return;
    if (duty) return duty.toggle(memberId, activeServiceId, on);
    if (on) AttendanceAndMemberService.undoMemberCheckIn(activeServiceId, memberId);
    else
      AttendanceAndMemberService.checkInMember({
        tenantId: activeTenantId,
        serviceId: activeServiceId,
        memberId,
        checkedInBy: user.id,
        isServingCheckin: true,
        servingDepartmentId: dept?.id ?? null,
      });
  };

  /* ── Add-a-member sheet ── */
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [role, setRole] = useState<ServingRole>('Member');
  const [giveLogin, setGiveLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      q.length === 0
        ? []
        : members
            .filter((m) => m.fullName.toLowerCase().includes(q) || m.phoneNumber.replace(/\s/g, '').includes(q.replace(/\s/g, '')) || m.residence.toLowerCase().includes(q))
            .slice(0, 12),
    [q, members]
  );
  const selected = members.find((m) => m.id === selectedId) ?? null;

  const resetSheet = () => {
    setQuery('');
    setSelectedId(null);
    setRole('Member');
    setGiveLogin(false);
    setLoginEmail('');
    setError('');
  };

  const handleAdd = () => {
    if (!dept || !selected) return;
    setError('');
    let userId: string | null = null;
    if (giveLogin) {
      const email = loginEmail.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        setError('Enter the Google email they’ll sign in with.');
        return;
      }
      const existing = PlatformService.getAllUsers().find((u) => u.email.toLowerCase() === email);
      if (existing) {
        setError('That email already has a login.');
        return;
      }
      const map = LOGIN_ROLE[departmentCode];
      const newUser = PlatformService.createUser({
        tenantId: activeTenantId,
        fullName: selected.fullName,
        email,
        phoneNumber: selected.phoneNumber,
        role: role === 'HOD' ? map.hod : map.member,
        departmentId: dept.id,
      });
      userId = newUser.id;
    }
    DepartmentService.addServingMember({
      tenantId: activeTenantId,
      departmentId: dept.id,
      memberId: selected.id,
      servingRole: role,
      userId,
    });
    setToast(`${selected.fullName.split(' ')[0]} added to ${deptName}${giveLogin ? ' with a login' : ''}.`);
    setTimeout(() => setToast(''), 3500);
    setAddOpen(false);
    resetSheet();
  };

  const roleBadge = (r: ServingRole, hasLogin: boolean) =>
    r === 'HOD' ? (
      <Badge kind="ink">
        <span className="text-church-lime">HOD</span>
      </Badge>
    ) : r === 'Coordinator' ? (
      <Badge>Coordinator</Badge>
    ) : hasLogin ? (
      <span title="Has a dashboard login" className="text-church-muted flex">
        <KeyRound className="w-4 h-4" aria-label="Has a login" />
      </span>
    ) : null;

  const addPanel = (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2.5 h-[52px] px-3.5 rounded-[14px] border-[1.5px] border-church-border bg-white text-church-muted focus-within:border-church-lime focus-within:ring-4 focus-within:ring-[#EEF8DC]">
        <Search className="w-5 h-5 shrink-0" strokeWidth={1.8} />
        <input
          type="search"
          aria-label="Search the church database"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
          placeholder="Name, phone or area"
          className="flex-1 min-w-0 bg-transparent outline-none text-base font-medium text-church-text placeholder:text-church-faint"
        />
        {q && <span className="text-[13px] font-semibold whitespace-nowrap">{results.length} found</span>}
      </label>

      {q.length === 0 ? (
        <p className="m-0 oc-sub -mt-1">Start typing to search everyone already registered in the church.</p>
      ) : results.length === 0 ? (
        <p className="m-0 oc-sub -mt-1">No one matches “{query}”.</p>
      ) : (
        <div className="flex flex-col gap-0.5 -mx-3">
          {results.map((m) => {
            const here = serving.some((s) => s.memberId === m.id);
            const elsewhere = allServing
              .filter((s) => s.memberId === m.id && s.departmentId !== dept?.id)
              .map((s) => DEPT_SHORT[departments.find((d) => d.id === s.departmentId)?.code ?? ''] ?? '')
              .filter(Boolean);
            const on = selectedId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={here}
                aria-pressed={on}
                onClick={() => setSelectedId(m.id)}
                className={`oc-press w-full flex items-center gap-3 min-h-[66px] px-3 py-2.5 rounded-2xl text-left border-[1.5px] transition disabled:opacity-55 disabled:pointer-events-none ${
                  on ? 'border-church-lime bg-church-limeSoft' : 'border-transparent'
                }`}
              >
                <Avatar name={m.fullName} />
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold truncate">{m.fullName}</span>
                  <span className="oc-sub truncate">
                    {prettyPhone(m.phoneNumber)} · {m.residence}
                  </span>
                  {(here || elsewhere.length > 0) && (
                    <span className="text-xs font-semibold text-church-warn">
                      {here ? `Already in ${deptName}` : `Also serves in ${elsewhere.join(', ')}`}
                    </span>
                  )}
                </span>
                {!here && (
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      on ? 'bg-church-lime text-church-forest' : 'border-2 border-church-border text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 p-3 rounded-2xl border-[1.5px] border-dashed border-church-border">
        <span className="w-10 h-10 rounded-full bg-church-canvas flex items-center justify-center shrink-0">
          <Plus className="w-[18px] h-[18px]" />
        </span>
        <span className="flex-1 flex flex-col">
          <span className="text-[15px] font-semibold">Not in the database?</span>
          <span className="oc-sub">Register them as a church member first (Airport Stars check-in or Administration).</span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="oc-label">Their role in {deptName}</span>
        <Segment
          options={[
            { value: 'Member', label: 'Member' },
            { value: 'Coordinator', label: 'Coordinator' },
            { value: 'HOD', label: 'HOD' },
          ]}
          value={role}
          onChange={(v) => setRole(v as ServingRole)}
        />
      </div>

      <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-church-soft">
        <KeyRound className="w-5 h-5 text-church-muted shrink-0" />
        <span className="flex-1 flex flex-col">
          <span className="text-[15px] font-semibold">Give them a dashboard login</span>
          <span className="oc-sub">They’ll sign in with Google and see only {deptName}.</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={giveLogin}
          aria-label="Give a dashboard login"
          onClick={() => setGiveLogin((v) => !v)}
          className={`w-[50px] h-[30px] rounded-full p-[3px] flex shrink-0 transition-colors ${
            giveLogin ? 'bg-church-lime justify-end' : 'bg-[#DADDD6] justify-start'
          }`}
        >
          <span className="w-6 h-6 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]" />
        </button>
      </div>
      {giveLogin && (
        <label className="flex flex-col gap-1.5">
          <span className="oc-label">Google email</span>
          <span className="flex items-center gap-2.5 h-[52px] px-3.5 rounded-[14px] border-[1.5px] border-church-border bg-church-field text-church-muted focus-within:bg-white focus-within:border-church-lime focus-within:ring-4 focus-within:ring-[#EEF8DC]">
            <Mail className="w-5 h-5 shrink-0" strokeWidth={1.8} />
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="name@gmail.com"
              className="flex-1 min-w-0 bg-transparent outline-none text-base font-medium text-church-text placeholder:text-church-faint"
            />
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="m-0 px-3.5 py-2.5 rounded-xl bg-church-negSoft text-sm text-[#8F1D14]">
          {error}
        </p>
      )}

      <button type="button" disabled={!selected} onClick={handleAdd} className="oc-btn-primary w-full !h-14 !text-[17px]">
        <UserPlus className="w-5 h-5" />
        {selected ? `Add ${selected.fullName.split(' ')[0]} to ${deptName}` : 'Pick someone first'}
      </button>
    </div>
  );

  return (
    <>
      {onBack && <div className="flex items-center gap-2.5">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2.5 text-sm text-church-muted">
          <span className="oc-press w-11 h-11 rounded-[14px] bg-white flex items-center justify-center text-church-text">
            <ChevronLeft className="w-5 h-5" />
          </span>
          More
        </button>
      </div>}
      <PageHeader
        title="Team"
        subtitle={`Everyone serving in ${deptName}, and who’s on duty this ${duty?.noun ?? 'service'}.`}
        actions={
          <button type="button" onClick={() => setAddOpen(true)} className="oc-btn-dark lg:hidden">
            <UserPlus className="w-[18px] h-[18px] text-church-lime" /> Add a member
          </button>
        }
      />
      {toast && (
        <p role="status" className="m-0 px-4 py-3 rounded-2xl bg-church-posSoft text-sm font-semibold text-[#0E5A37]">
          {toast}
        </p>
      )}

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-stretch lg:items-start">
        <div className="flex-[3] min-w-0 flex flex-col gap-4">
          <Card>
            <Stats
              items={[
                { label: 'Serving', value: rows.length },
                { label: 'On duty', value: `${dutyCount} of ${rows.length}`, color: '#116B43' },
                { label: 'Attendance', value: `${avg}%` },
              ]}
            />
          </Card>
          {sessions.length > 0 && (
            <PickerRow
              icon={CalendarDays}
              label="Duty for"
              value={activeServiceId}
              onChange={setServiceId}
              options={sessions.map((s) => ({ value: s.id, label: s.label }))}
            />
          )}
          {rows.length === 0 ? (
            <EmptyState icon={UserPlus} title="No one serving yet" sub="Search the church database to add your first team member." />
          ) : (
            <section className="bg-white rounded-card px-4">
              <div className="divide-y divide-church-line">
                {rows.map(({ sm, m, pct, login, onDuty }) => (
                  <div key={sm.id} className="flex items-center gap-3 py-3 min-h-[68px]">
                    <Avatar name={m.fullName} />
                    <span className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="text-[15px] font-semibold truncate">{m.fullName}</span>
                      <span className="flex items-center gap-2">
                        {roleBadge(sm.servingRole, !!login)}
                        <span className="oc-sub whitespace-nowrap truncate">{pct}% attendance</span>
                      </span>
                    </span>
                    {activeServiceId && (
                      <button
                        type="button"
                        aria-pressed={onDuty}
                        onClick={() => toggleDuty(m.id, onDuty)}
                        className={
                          onDuty
                            ? 'oc-btn !h-10 !px-3 !text-sm bg-church-posSoft text-[#0E5A37]'
                            : 'oc-btn !h-10 !px-3.5 !text-sm bg-church-canvas text-church-text'
                        }
                      >
                        {onDuty ? (
                          <>
                            <Check className="w-4 h-4" /> On duty
                          </>
                        ) : (
                          'Mark duty'
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="lg:hidden oc-press h-14 rounded-[18px] border-[1.5px] border-dashed border-church-border text-[15px] font-semibold flex items-center justify-center gap-2"
          >
            <UserPlus className="w-[18px] h-[18px]" /> Add a member from the database
          </button>
        </div>
        <div className="hidden lg:flex flex-[2] min-w-0 flex-col gap-4 lg:sticky lg:top-6">
          <Card className="!gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="oc-h2">Add a member</h2>
              <span className="oc-sub">From the church database</span>
            </div>
            {addPanel}
          </Card>
        </div>
      </div>

      <MobileSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          resetSheet();
        }}
        title={`Add to ${deptName}`}
        subtitle="Search everyone already registered in the church."
      >
        {addPanel}
      </MobileSheet>
    </>
  );
};


