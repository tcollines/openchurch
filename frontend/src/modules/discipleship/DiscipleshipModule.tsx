import React, { useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  Lock,
  Plus,
  RotateCcw,
  Settings2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import {
  AttendanceAndMemberService,
  DepartmentService,
  DiscipleshipProgress,
  DiscipleshipService,
  DiscipleshipStage,
} from '@/services/churchService';
import { DepartmentCode, UserRole } from '@/shared/enums';
import { DiscipleshipClass, Member } from '@/shared/types';
import { formatDate } from '@/shared/formatters';
import {
  Avatar,
  Badge,
  Card,
  Chips,
  Columns,
  ContactButtons,
  DarkCard,
  DarkStats,
  EmptyState,
  ListCard,
  PageHeader,
  Row,
  SearchField,
  Stats,
  Tile,
} from '@/components/ui/kit';
import { DateInput, MobileSheet, SelectInput, TextInput } from '@/components/ui/FormControls';
import { Highlight, SearchTakeover } from '@/components/ui/SearchTakeover';
import { HodMoreTab } from '@/components/hod-more/HodMoreTab';
import { DepartmentTeamView } from '@/components/hod-more/DepartmentTeamView';

/* ── helpers ─────────────────────────────────────────────────────────────── */

const todayISO = () => new Date().toISOString().slice(0, 10);
const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const when = (c: DiscipleshipClass) => `${c.classDate === todayISO() ? 'Today' : formatDate(c.classDate)} · ${time12(c.startTime)}`;
const matches = (m: Member, q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return m.fullName.toLowerCase().includes(s) || m.phoneNumber.replace(/\s/g, '').includes(s.replace(/\s/g, '')) || (m.residence || '').toLowerCase().includes(s);
};
const STAGE_LABEL: Record<DiscipleshipStage, string> = { ENROLLED: 'Enrolled', IN_PROGRESS: 'In progress', COMPLETED: 'Completed' };

/** n of target as a segmented bar. */
const Steps: React.FC<{ n: number; total: number }> = ({ n, total }) => {
  const done = n >= total;
  const segs = Math.min(total, 12);
  const filled = Math.round((Math.min(n, total) / total) * segs);
  return (
    <span role="img" aria-label={`${n} of ${total} classes`} className="flex items-center gap-2 w-[118px] shrink-0">
      <span className="flex-1 flex gap-[3px]">
        {Array.from({ length: segs }, (_, i) => (
          <span key={i} className={`flex-1 h-1.5 rounded-full ${i < filled ? (done ? 'bg-church-pos' : 'bg-church-lime') : 'bg-church-line'}`} />
        ))}
      </span>
      <span className={`w-9 text-right font-display text-[13px] font-bold tabular-nums ${done ? 'text-church-pos' : n ? 'text-church-emerald' : 'text-church-faint'}`}>
        {Math.min(n, total)}/{total}
      </span>
    </span>
  );
};

const useDiscipleship = () => {
  useChurchStoreRefresh();
  const { user, activeTenantId } = useAuth();
  const dept = DepartmentService.getDepartmentByCode(activeTenantId, DepartmentCode.DISCIPLESHIP);
  const isHod = user?.role !== UserRole.DISCIPLESHIP_MEMBER;
  return { user, tenantId: activeTenantId, dept, isHod };
};

/* ── Enroll sheet: pick from the church's members ───────────────────────── */

const EnrollSheet: React.FC<{ open: boolean; onClose: () => void; classId?: string }> = ({ open, onClose, classId }) => {
  const { user, tenantId } = useDiscipleship();
  const [q, setQ] = useState('');
  const target = DiscipleshipService.classesToComplete(tenantId);
  const enrolled = new Set(DiscipleshipService.getEnrollments(tenantId).map((e) => e.memberId));
  const members = AttendanceAndMemberService.getMembers(tenantId).filter((m) => m.isActive !== false);
  const results = q.trim() ? members.filter((m) => matches(m, q)).slice(0, 20) : members.filter((m) => !enrolled.has(m.id)).slice(0, 8);
  const enroll = (m: Member) => {
    if (!user) return;
    DiscipleshipService.enroll(tenantId, m.id, user.id);
    if (classId) DiscipleshipService.checkIn({ tenantId, classId, memberId: m.id, checkedInBy: user.id });
  };
  return (
    <MobileSheet
      open={open}
      onClose={() => {
        setQ('');
        onClose();
      }}
      title="Enroll in discipleship"
      subtitle={`They’ll start at class 1 of ${target}.`}
    >
      <div className="flex flex-col gap-4">
        <SearchField value={q} onChange={setQ} placeholder="Search the church’s members" />
        {results.length === 0 ? (
          <p className="m-0 oc-sub">No one matches “{q}”. Add them to members first.</p>
        ) : (
          <div className="divide-y divide-church-line">
            {results.map((m) => (
              <div key={m.id} className="flex items-center gap-3 min-h-[60px] py-2">
                <Avatar name={m.fullName} />
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[15px] font-semibold truncate">
                    <Highlight text={m.fullName} query={q} />
                  </span>
                  <span className="oc-sub truncate">
                    {m.phoneNumber}
                    {m.residence ? ` · ${m.residence}` : ''}
                  </span>
                </span>
                {enrolled.has(m.id) ? (
                  <Badge kind="ok">Enrolled</Badge>
                ) : (
                  <button type="button" onClick={() => enroll(m)} className="oc-btn-dark !h-10 !px-3.5 !text-sm shrink-0">
                    <Plus className="w-4 h-4 text-church-lime" /> Enroll
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex items-start gap-3 px-3.5 py-3 rounded-2xl bg-[#F6F7F3] text-sm leading-[1.45] text-[#3E4741]">
          <Users className="w-5 h-5 text-church-emerald shrink-0 mt-0.5" />
          {classId ? 'Enrolling also checks them in to this class. ' : ''}Someone new to church? Add them to members first.
        </div>
      </div>
    </MobileSheet>
  );
};

/* ── 1. Classes (Check-In tab) ──────────────────────────────────────────── */

const NewClassSheet: React.FC<{ open: boolean; onClose: () => void; onCreated: (c: DiscipleshipClass) => void }> = ({ open, onClose, onCreated }) => {
  const { user, tenantId, dept } = useDiscipleship();
  const team = dept ? DepartmentService.getServingMembers(tenantId).filter((s) => s.departmentId === dept.id) : [];
  const members = AttendanceAndMemberService.getMembers(tenantId);
  const trainers = team.map((t) => members.find((m) => m.id === t.memberId)).filter(Boolean) as Member[];
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState('18:30');
  const [trainerId, setTrainerId] = useState('');
  const [otherTrainer, setOtherTrainer] = useState('');
  const [error, setError] = useState('');
  const pick = trainerId || trainers[0]?.id || 'other';
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !dept) return;
    try {
      const t = trainers.find((m) => m.id === pick);
      const c = DiscipleshipService.createClass({
        tenantId,
        departmentId: dept.id,
        name,
        classDate: date,
        startTime: time,
        trainerMemberId: t?.id ?? null,
        trainerName: t?.fullName ?? otherTrainer,
        createdBy: user.id,
      });
      setName('');
      setOtherTrainer('');
      setError('');
      onCreated(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the class');
    }
  };
  return (
    <MobileSheet open={open} onClose={onClose} title="New class" subtitle="Members check in to it like a service, but it stays in Discipleship.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextInput label="Class name" value={name} onChange={setName} placeholder="e.g. Foundations · Lesson 5: The Holy Spirit" required />
        <div className="grid grid-cols-2 gap-3">
          <DateInput label="Date" value={date} onChange={setDate} required />
          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="oc-label">
              Time <span className="text-church-neg">*</span>
            </span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="oc-field" />
          </label>
        </div>
        <SelectInput
          label="Trainer"
          value={pick}
          onChange={setTrainerId}
          options={[...trainers.map((m) => ({ value: m.id, label: m.fullName })), { value: 'other', label: 'Someone else…' }]}
          required
        />
        {pick === 'other' && <TextInput label="Trainer’s name" value={otherTrainer} onChange={setOtherTrainer} placeholder="e.g. Pastor Daniel Ssekandi" required />}
        <div className="flex items-start gap-3 px-3.5 py-3 rounded-2xl bg-[#F6F7F3] text-sm leading-[1.45] text-[#3E4741]">
          <Lock className="w-5 h-5 text-church-emerald shrink-0 mt-0.5" />
          Only Discipleship sees this class. It won’t appear in service check-in or in other departments.
        </div>
        {error && (
          <p role="alert" className="m-0 px-3.5 py-2.5 rounded-xl bg-church-negSoft text-sm text-[#8F1D14]">
            {error}
          </p>
        )}
        <button type="submit" className="oc-btn-primary w-full">
          <Plus className="w-5 h-5" /> Create class
        </button>
      </form>
    </MobileSheet>
  );
};

const ClassesView: React.FC = () => {
  const { tenantId, isHod } = useDiscipleship();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const classes = DiscipleshipService.getClasses(tenantId);
  const enrolledCount = DiscipleshipService.getEnrollments(tenantId).length;
  const att = DiscipleshipService.getAttendance(tenantId).filter((a) => !a.isTeam);
  const present = (id: string) => att.filter((a) => a.classId === id).length;
  const today = todayISO();
  const upcomingAll = classes.filter((c) => c.classDate >= today).reverse(); // soonest first
  const featured = upcomingAll[0] ?? classes[0] ?? null;
  const upcoming = upcomingAll.filter((c) => c.id !== featured?.id);
  const past = classes.filter((c) => c.classDate < today && c.id !== featured?.id);
  const pct = (n: number) => (enrolledCount ? Math.round((n / enrolledCount) * 100) : 0);
  const open = (c: DiscipleshipClass) => navigate(`/discipleship/classes/${c.id}`);

  const side = featured ? (
    <DarkCard live={featured.classDate === today} eyebrow={featured.classDate === today ? when(featured) : `${featured.classDate > today ? 'Next class' : 'Last class'} · ${when(featured)}`} title={featured.name}>
      <span className="flex items-center gap-2 text-[13px] text-[#A9B8AC]">
        <Avatar name={featured.trainerName} size={24} /> Trainer · {featured.trainerName}
      </span>
      <DarkStats
        items={[
          { label: 'Checked in', value: present(featured.id), accent: true },
          { label: 'Enrolled', value: enrolledCount },
          { label: 'Present', value: `${pct(present(featured.id))}%` },
        ]}
      />
      <button type="button" onClick={() => open(featured)} className="oc-btn-primary self-start !h-12">
        {isHod ? 'Open check-in' : 'Check people in'} <ArrowRight className="w-[18px] h-[18px]" />
      </button>
    </DarkCard>
  ) : (
    <EmptyState
      icon={CalendarPlus}
      title="No classes yet"
      sub={isHod ? 'Create the first class to start checking members in.' : 'The Head of Discipleship hasn’t created a class yet.'}
      action={
        isHod ? (
          <button type="button" onClick={() => setNewOpen(true)} className="oc-btn-primary">
            New class
          </button>
        ) : undefined
      }
    />
  );

  const classRow = (c: DiscipleshipClass, showCount: boolean) => {
    const n = present(c.id);
    const p = pct(n);
    return (
      <Row
        key={c.id}
        onClick={() => open(c)}
        lead={<Tile icon={showCount ? CalendarDays : BookOpen} tone={showCount ? 'neutral' : 'violet'} />}
        title={c.name}
        sub={`${when(c)} · ${c.trainerName}`}
        trail={
          showCount ? (
            <span className="flex flex-col items-end shrink-0">
              <span className="oc-num text-base">
                {n}/{enrolledCount}
              </span>
              <span className={`text-xs font-semibold ${p >= 75 ? 'text-church-pos' : p >= 50 ? 'text-[#A15C00]' : 'text-church-neg'}`}>{p}%</span>
            </span>
          ) : undefined
        }
        chevron
      />
    );
  };

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle={isHod ? 'Discipleship classes only. They don’t show up in service check-in.' : 'Pick a class to check people in.'}
        actions={
          isHod ? (
            <button type="button" onClick={() => setNewOpen(true)} className="oc-btn-dark">
              <Plus className="w-[18px] h-[18px] text-church-lime" /> New class
            </button>
          ) : undefined
        }
      />
      <Columns
        sideFirst
        side={side}
        main={
          <>
            {upcoming.length > 0 && <ListCard title="Coming up">{upcoming.map((c) => classRow(c, false))}</ListCard>}
            {past.length > 0 && (
              <ListCard title="Past classes" aside={<span className="oc-sub">Present</span>}>
                {past.map((c) => classRow(c, true))}
              </ListCard>
            )}
            {isHod && (
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="oc-press h-14 rounded-[18px] border-[1.5px] border-dashed border-church-border text-[15px] font-semibold text-church-text flex items-center justify-center gap-2"
              >
                <Plus className="w-[18px] h-[18px]" /> Create a class
              </button>
            )}
          </>
        }
      />
      {isHod && <NewClassSheet open={newOpen} onClose={() => setNewOpen(false)} onCreated={(c) => { setNewOpen(false); open(c); }} />}
    </>
  );
};

/* ── 1b. Class check-in ─────────────────────────────────────────────────── */

const ClassCheckInView: React.FC = () => {
  const { id } = useParams();
  const { user, tenantId, isHod } = useDiscipleship();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'in'>('all');
  const [enrollOpen, setEnrollOpen] = useState(false);
  const cls = DiscipleshipService.getClasses(tenantId).find((c) => c.id === id);
  const progress = DiscipleshipService.progress(tenantId);
  const att = id ? DiscipleshipService.getAttendance(tenantId, id).filter((a) => !a.isTeam) : [];
  const inSet = new Set(att.map((a) => a.memberId));
  if (!cls) return <Navigate to="/discipleship/classes" replace />;

  const people = progress.filter((p) => p.member).sort((a, b) => a.member!.fullName.localeCompare(b.member!.fullName));
  const searched = people.filter((p) => matches(p.member!, q));
  const listed = searched.filter((p) => (filter === 'all' ? true : filter === 'in' ? inSet.has(p.member!.id) : !inSet.has(p.member!.id)));
  const pct = people.length ? Math.round((inSet.size / people.length) * 100) : 0;
  const meta = (p: DiscipleshipProgress) => {
    const here = inSet.has(p.member!.id);
    const n = p.attended - (here ? 1 : 0); // classes before this one
    const where = p.member!.residence ? ` · ${p.member!.residence}` : '';
    if (p.stage === 'COMPLETED' && !here) return `Completed${where}`;
    return `${n === 0 ? 'First class' : `Class ${Math.min(n + 1, p.target)} of ${p.target}`}${where}`;
  };

  const row = (p: DiscipleshipProgress, hl = '') => {
    const m = p.member!;
    const here = inSet.has(m.id);
    return (
      <Row
        key={m.id}
        lead={<Avatar name={m.fullName} />}
        title={<Highlight text={m.fullName} query={hl} />}
        sub={meta(p)}
        trail={
          here ? (
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="h-10 px-3.5 rounded-2xl bg-church-posSoft text-[#0E5A37] text-sm font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> In
              </span>
              {isHod && (
                <button
                  type="button"
                  onClick={() => DiscipleshipService.undoCheckIn(cls.id, m.id)}
                  aria-label={`Undo check-in for ${m.fullName}`}
                  className="oc-press w-10 h-10 rounded-full text-church-muted hover:bg-church-negSoft hover:text-church-neg flex items-center justify-center"
                >
                  <RotateCcw className="w-[18px] h-[18px]" />
                </button>
              )}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => user && DiscipleshipService.checkIn({ tenantId, classId: cls.id, memberId: m.id, checkedInBy: user.id })}
              className="oc-btn-dark !h-10 !px-4 !text-sm shrink-0"
            >
              Check in
            </button>
          )
        }
      />
    );
  };

  const card = (
    <DarkCard
      live={cls.classDate === todayISO()}
      eyebrow={`Class check-in · ${when(cls)}`}
      action={
        <button type="button" onClick={() => navigate('/discipleship/classes')} className="text-[13px] font-semibold text-church-gold">
          Change
        </button>
      }
      title={cls.name}
    >
      <span className="text-[13px] text-[#A9B8AC] -mt-1">Trainer · {cls.trainerName}</span>
      <DarkStats
        items={[
          { label: 'Checked in', value: inSet.size, accent: true },
          { label: 'Enrolled', value: people.length },
          { label: 'Present', value: `${pct}%` },
        ]}
      />
    </DarkCard>
  );

  return (
    <>
      <PageHeader
        eyebrow={
          <button type="button" onClick={() => navigate('/discipleship/classes')} className="inline-flex items-center gap-1 font-semibold text-church-emerald">
            <ChevronLeft className="w-4 h-4" /> Classes
          </button>
        }
        title="Class check-in"
        subtitle={isHod ? 'Search, tap, done. Only enrolled members are listed.' : 'Search, tap, done.'}
        actions={
          <button type="button" onClick={() => setEnrollOpen(true)} className="oc-btn-dark">
            <UserPlus className="w-[18px] h-[18px] text-church-lime" /> Enroll someone
          </button>
        }
      />
      <Columns
        main={
          <>
            <div className="lg:hidden">{card}</div>
            <SearchTakeover
              value={q}
              onChange={setQ}
              placeholder="Search enrolled members"
              context={`${cls.name} · ${inSet.size} checked in`}
              count={q.trim() ? searched.length : undefined}
            >
              {q.trim() ? (
                <>
                  {searched.length > 0 && (
                    <section className="bg-white rounded-[20px] px-4">
                      <div className="divide-y divide-church-line">{searched.slice(0, 60).map((p) => row(p, q))}</div>
                    </section>
                  )}
                  <button
                    type="button"
                    onClick={() => setEnrollOpen(true)}
                    className="oc-press h-14 w-full rounded-[18px] border-[1.5px] border-dashed border-church-border text-[15px] font-semibold flex items-center justify-center gap-2 bg-white"
                  >
                    <UserPlus className="w-[18px] h-[18px]" /> Not enrolled yet? Enroll them
                  </button>
                </>
              ) : (
                <p className="m-0 oc-sub">Type a few letters to find someone.</p>
              )}
            </SearchTakeover>
            <Chips
              items={[
                { value: 'all', label: 'Everyone', count: searched.length },
                { value: 'pending', label: 'Not yet', count: searched.filter((p) => !inSet.has(p.member!.id)).length },
                { value: 'in', label: 'Checked in', count: searched.filter((p) => inSet.has(p.member!.id)).length },
              ]}
              value={filter}
              onChange={(v) => setFilter(v as typeof filter)}
            />
            {people.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="No one enrolled yet"
                sub="Enroll church members in discipleship, then check them in here."
                action={
                  <button type="button" onClick={() => setEnrollOpen(true)} className="oc-btn-primary">
                    Enroll someone
                  </button>
                }
              />
            ) : listed.length === 0 ? (
              <EmptyState icon={UserPlus} title={q ? `No enrolled member called “${q}”` : 'No one here'} sub={q ? 'Enroll them first, then check them in.' : undefined} />
            ) : (
              <section className="bg-white rounded-[20px] px-4">
                <div className="divide-y divide-church-line">{listed.map((p) => row(p, q))}</div>
              </section>
            )}
            <button
              type="button"
              onClick={() => setEnrollOpen(true)}
              className="oc-press h-14 rounded-[18px] border-[1.5px] border-dashed border-church-border text-[15px] font-semibold text-church-text flex items-center justify-center gap-2"
            >
              <UserPlus className="w-[18px] h-[18px]" /> Not enrolled yet? Enroll them
            </button>
          </>
        }
        side={<div className="hidden lg:block">{card}</div>}
      />
      <EnrollSheet open={enrollOpen} onClose={() => setEnrollOpen(false)} classId={cls.id} />
    </>
  );
};

/* ── 2. Attendance progress ─────────────────────────────────────────────── */

const ProgressView: React.FC = () => {
  const { tenantId } = useDiscipleship();
  const [setOpen, setSetOpen] = useState(false);
  const progress = DiscipleshipService.progress(tenantId).filter((p) => p.member);
  const target = DiscipleshipService.classesToComplete(tenantId);
  const [draft, setDraft] = useState(String(target));
  const count = (s: DiscipleshipStage) => progress.filter((p) => p.stage === s).length;
  const total = progress.length;
  const today = todayISO();
  const classes = DiscipleshipService.getClasses(tenantId).filter((c) => c.classDate <= today);
  const recent = classes.slice(0, 6).reverse();
  const att = DiscipleshipService.getAttendance(tenantId).filter((a) => !a.isTeam);
  const enrolledBy = (c: DiscipleshipClass) => DiscipleshipService.getEnrollments(tenantId).filter((e) => e.enrolledAt.slice(0, 10) <= c.classDate).length || total;
  const bars = recent.map((c) => {
    const n = att.filter((a) => a.classId === c.id).length;
    const of = Math.max(enrolledBy(c), n);
    return { c, n, of, pct: of ? Math.round((n / of) * 100) : 0 };
  });
  const avg = bars.length ? Math.round(bars.reduce((a, b) => a + b.pct, 0) / bars.length) : 0;
  const closest = progress.filter((p) => p.stage === 'IN_PROGRESS').sort((a, b) => b.attended - a.attended).slice(0, 8);
  const missed = progress.filter((p) => p.missedLastTwo);
  const w = (n: number) => (total ? `${(n / total) * 100}%` : '0%');

  return (
    <>
      <PageHeader
        title="Attendance progress"
        subtitle={`How many classes each person has attended out of the ${target} in the track.`}
        actions={
          <button type="button" onClick={() => { setDraft(String(target)); setSetOpen(true); }} className="oc-btn bg-white text-church-text">
            <Settings2 className="w-[18px] h-[18px]" /> {target} classes to complete
          </button>
        }
      />
      <Columns
        sideFirst
        side={
          <DarkCard eyebrow={`Discipleship track · ${target} classes`} title={`${count('COMPLETED')} ${count('COMPLETED') === 1 ? 'person' : 'people'} completed`}>
            <div className="flex flex-col gap-1.5">
              <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.12]">
                <div className="bg-church-lime" style={{ width: w(count('COMPLETED')) }} />
                <div className="bg-[#6B8F4E]" style={{ width: w(count('IN_PROGRESS')) }} />
              </div>
              <span className="text-[13px] text-[#A9B8AC]">
                {count('COMPLETED')} completed · {count('IN_PROGRESS')} in progress · {count('ENROLLED')} enrolled, not started
              </span>
            </div>
          </DarkCard>
        }
        main={
          <>
            <Card>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="oc-h2">Class attendance</h2>
                <span className="oc-sub">Last {bars.length || 0} classes</span>
              </div>
              {bars.length === 0 ? (
                <p className="m-0 oc-sub">Attendance shows here after the first class.</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2 -mt-1">
                    <span className="oc-num text-[32px]">{avg}%</span>
                    <span className="oc-sub">average present</span>
                  </div>
                  <div role="img" aria-label={`Average attendance ${avg} percent`} className="flex gap-2.5">
                    {bars.map(({ c, n, of, pct }) => (
                      <div key={c.id} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                        <span className="font-display text-[13px] font-bold tabular-nums">
                          {n}/{of}
                        </span>
                        <div className="w-full h-[90px] flex items-end">
                          <div className="w-full rounded-[10px] bg-church-forest" style={{ height: `${Math.max(4, pct)}%` }} title={c.name} />
                        </div>
                        <span className="oc-sub text-[12px] truncate max-w-full">{formatDate(c.classDate).replace(/,? \d{4}$/, '')}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
            {closest.length > 0 && (
              <ListCard title="Closest to finishing" aside={<span className="oc-sub">Classes</span>}>
                {closest.map((p) => (
                  <Row key={p.enrollment.id} lead={<Avatar name={p.member!.fullName} />} title={p.member!.fullName} sub={`Next: class ${p.attended + 1}`} trail={<Steps n={p.attended} total={p.target} />} />
                ))}
              </ListCard>
            )}
            {missed.length > 0 && (
              <ListCard title={`${missed.length} missed the last 2 classes`} aside={<span className="oc-sub">Worth a call</span>}>
                {missed.map((p) => (
                  <Row
                    key={p.enrollment.id}
                    lead={<Tile icon={AlertTriangle} tone="amber" />}
                    title={p.member!.fullName}
                    sub={p.lastClassDate ? `Last came ${formatDate(p.lastClassDate)}` : 'Hasn’t come yet'}
                    trail={p.member!.phoneNumber ? <ContactButtons phone={p.member!.phoneNumber} name={p.member!.fullName} /> : undefined}
                  />
                ))}
              </ListCard>
            )}
            {total === 0 && <EmptyState icon={Users} title="No one enrolled yet" sub="Enroll members from the Members tab or during class check-in." />}
          </>
        }
      />
      <MobileSheet open={setOpen} onClose={() => setSetOpen(false)} title="Classes to complete" subtitle="How many classes someone attends to finish discipleship.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(draft);
            if (n >= 1) {
              DiscipleshipService.setClassesToComplete(tenantId, n);
              setSetOpen(false);
            }
          }}
          className="flex flex-col gap-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="oc-label">Classes</span>
            <input type="number" min={1} max={52} inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} className="oc-field" />
          </label>
          <p className="m-0 oc-sub">Everyone’s progress updates straight away. People who reach the number move to Completed.</p>
          <button type="submit" className="oc-btn-primary w-full">
            Save
          </button>
        </form>
      </MobileSheet>
    </>
  );
};

/* ── 3. Members: enrolled · in progress · completed ─────────────────────── */

const MembersView: React.FC = () => {
  const { tenantId } = useDiscipleship();
  const [stage, setStage] = useState<DiscipleshipStage>('IN_PROGRESS');
  const [q, setQ] = useState('');
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const progress = DiscipleshipService.progress(tenantId).filter((p) => p.member);
  const count = (s: DiscipleshipStage) => progress.filter((p) => p.stage === s).length;
  const list = progress
    .filter((p) => p.stage === stage && matches(p.member!, q))
    .sort((a, b) => (stage === 'COMPLETED' ? (b.completedOn ?? '').localeCompare(a.completedOn ?? '') : stage === 'ENROLLED' ? b.enrollment.enrolledAt.localeCompare(a.enrollment.enrolledAt) : b.attended - a.attended));
  const selected = progress.find((p) => p.enrollment.id === openId) ?? null;

  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Everyone in discipleship, from enrolled to completed."
        actions={
          <button type="button" onClick={() => setEnrollOpen(true)} className="oc-btn-dark">
            <UserPlus className="w-[18px] h-[18px] text-church-lime" /> Enroll a member
          </button>
        }
      />
      <Card>
        <Stats
          items={[
            { label: 'Enrolled', value: count('ENROLLED') },
            { label: 'In progress', value: count('IN_PROGRESS'), color: '#2F6B0A' },
            { label: 'Completed', value: count('COMPLETED'), color: '#116B43' },
          ]}
        />
      </Card>
      <Chips
        items={(['ENROLLED', 'IN_PROGRESS', 'COMPLETED'] as DiscipleshipStage[]).map((s) => ({ value: s, label: STAGE_LABEL[s], count: count(s) }))}
        value={stage}
        onChange={(v) => setStage(v)}
      />
      <SearchField value={q} onChange={setQ} placeholder="Search name, phone or area" />
      {list.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? 'No one matches' : stage === 'ENROLLED' ? 'No one waiting to start' : stage === 'IN_PROGRESS' ? 'No one in progress' : 'No one has completed yet'}
          sub={stage === 'ENROLLED' ? 'People move to In progress after their first class check-in.' : undefined}
        />
      ) : (
        <section className="bg-white rounded-[20px] px-4 max-w-[760px]">
          <div className="divide-y divide-church-line">
            {list.map((p) => (
              <Row
                key={p.enrollment.id}
                onClick={() => setOpenId(p.enrollment.id)}
                lead={<Avatar name={p.member!.fullName} />}
                title={<Highlight text={p.member!.fullName} query={q} />}
                sub={
                  p.stage === 'COMPLETED'
                    ? `Completed ${p.completedOn ? formatDate(p.completedOn) : ''}`
                    : p.stage === 'ENROLLED'
                      ? `${p.member!.residence ? `${p.member!.residence} · ` : ''}Enrolled ${formatDate(p.enrollment.enrolledAt)}`
                      : `${p.member!.residence ? `${p.member!.residence} · ` : ''}class ${p.attended + 1} next`
                }
                trail={p.stage === 'COMPLETED' ? <Badge kind="ok">{`${p.target} of ${p.target}`}</Badge> : p.stage === 'ENROLLED' ? <Badge>Not started</Badge> : <Steps n={p.attended} total={p.target} />}
              />
            ))}
          </div>
        </section>
      )}
      <button
        type="button"
        onClick={() => setEnrollOpen(true)}
        className="oc-press h-14 max-w-[760px] rounded-[18px] border-[1.5px] border-dashed border-church-border text-[15px] font-semibold text-church-text flex items-center justify-center gap-2"
      >
        <UserPlus className="w-[18px] h-[18px]" /> Enroll a member
      </button>
      <EnrollSheet open={enrollOpen} onClose={() => setEnrollOpen(false)} />
      <MemberSheet p={selected} onClose={() => setOpenId(null)} />
    </>
  );
};

const MemberSheet: React.FC<{ p: DiscipleshipProgress | null; onClose: () => void }> = ({ p, onClose }) => {
  const { tenantId } = useDiscipleship();
  const [confirm, setConfirm] = useState(false);
  const history = useMemo(() => {
    if (!p) return [];
    const all = DiscipleshipService.getClasses(tenantId);
    const mine = new Set(DiscipleshipService.getAttendance(tenantId).filter((a) => a.memberId === p.enrollment.memberId && !a.isTeam).map((a) => a.classId));
    const firstCame = all.filter((c) => mine.has(c.id)).map((c) => c.classDate).sort()[0];
    const from = [p.enrollment.enrolledAt.slice(0, 10), firstCame].filter(Boolean).sort()[0] as string;
    const classes = all.filter((c) => c.classDate <= todayISO() && c.classDate >= from);
    return classes.slice(0, 8).map((c) => ({ c, here: mine.has(c.id) }));
  }, [p, tenantId]);
  if (!p || !p.member) return null;
  const m = p.member;
  return (
    <MobileSheet
      open
      onClose={() => {
        setConfirm(false);
        onClose();
      }}
      title={m.fullName}
      subtitle={`${STAGE_LABEL[p.stage]} · ${p.attended} of ${p.target} classes`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={m.fullName} size={48} />
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="oc-sub">{m.phoneNumber}</span>
            <span className="oc-sub">Enrolled {formatDate(p.enrollment.enrolledAt)}</span>
          </span>
          {m.phoneNumber && <ContactButtons phone={m.phoneNumber} name={m.fullName} />}
        </div>
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-[#F6F7F3]">
          <Steps n={p.attended} total={p.target} />
          <span className="text-sm text-[#3E4741]">{p.stage === 'COMPLETED' ? `Finished ${p.completedOn ? formatDate(p.completedOn) : ''}` : `${p.target - p.attended} to go`}</span>
        </div>
        {history.length > 0 && (
          <div className="flex flex-col">
            <span className="oc-label mb-1">Classes since starting</span>
            {history.map(({ c, here }) => (
              <div key={c.id} className="flex items-center gap-3 min-h-[48px] border-t border-church-line">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${here ? 'bg-church-pos' : 'bg-church-border'}`} />
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-sm font-semibold truncate">{c.name}</span>
                  <span className="oc-sub">{formatDate(c.classDate)}</span>
                </span>
                {here ? <Badge kind="ok">Present</Badge> : <Badge kind="bad">Absent</Badge>}
              </div>
            ))}
          </div>
        )}
        {confirm ? (
          <div className="flex flex-col gap-2.5">
            <p className="m-0 text-sm text-[#5A3500] px-3.5 py-3 rounded-2xl bg-church-warnSoft">
              {m.fullName.split(' ')[0]} will come off the discipleship list. Their past class attendance stays in the records.
            </p>
            <button
              type="button"
              onClick={() => {
                DiscipleshipService.withdraw(p.enrollment.id);
                setConfirm(false);
                onClose();
              }}
              className="oc-btn w-full bg-church-neg text-white"
            >
              <UserMinus className="w-5 h-5" /> Remove from discipleship
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="oc-btn-ghost w-full">
              Keep
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="oc-btn w-full bg-white text-church-neg border-[1.5px] border-[#F4C7C3]">
            <UserMinus className="w-5 h-5" /> Remove from discipleship
          </button>
        )}
      </div>
    </MobileSheet>
  );
};

/* ── 4. Team (duty is per class) ────────────────────────────────────────── */

const TeamView: React.FC = () => {
  const { user, tenantId } = useDiscipleship();
  const classes = DiscipleshipService.getClasses(tenantId);
  const today = todayISO();
  const ordered = [...classes.filter((c) => c.classDate >= today).reverse(), ...classes.filter((c) => c.classDate < today)];
  const att = DiscipleshipService.getAttendance(tenantId).filter((a) => a.isTeam);
  return (
    <DepartmentTeamView
      departmentCode={DepartmentCode.DISCIPLESHIP}
      duty={{
        noun: 'class',
        sessions: ordered.map((c) => ({ id: c.id, label: `${c.name} · ${when(c)}` })),
        isOnDuty: (memberId, sessionId) => att.some((a) => a.classId === sessionId && a.memberId === memberId),
        toggle: (memberId, sessionId, on) => {
          if (on) DiscipleshipService.undoCheckIn(sessionId, memberId);
          else if (user) DiscipleshipService.checkIn({ tenantId, classId: sessionId, memberId, checkedInBy: user.id, isTeam: true });
        },
        attendancePct: (memberId) => {
          const past = classes.filter((c) => c.classDate <= today);
          if (!past.length) return 0;
          const ids = new Set(past.map((c) => c.id));
          return Math.round((att.filter((a) => a.memberId === memberId && ids.has(a.classId)).length / past.length) * 100);
        },
      }}
    />
  );
};

/* ── Module ─────────────────────────────────────────────────────────────── */

export const DiscipleshipModule: React.FC = () => {
  const { user } = useAuth();
  const memberOnly = user?.role === UserRole.DISCIPLESHIP_MEMBER;
  const hodOnly = (el: React.ReactElement) => (memberOnly ? <Navigate to="/discipleship/classes" replace /> : el);
  return (
    <Routes>
      <Route path="classes" element={<ClassesView />} />
      <Route path="classes/:id" element={<ClassCheckInView />} />
      <Route path="progress" element={hodOnly(<ProgressView />)} />
      <Route path="members" element={hodOnly(<MembersView />)} />
      <Route path="team" element={hodOnly(<TeamView />)} />
      <Route path="more" element={hodOnly(<HodMoreTab departmentCode={DepartmentCode.DISCIPLESHIP} />)} />
      <Route path="*" element={<Navigate to="classes" replace />} />
    </Routes>
  );
};
