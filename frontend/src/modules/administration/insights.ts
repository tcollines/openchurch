import { readStore, requisitionAsk } from '@/services/churchService';
import { DepartmentCode, FellowshipUnitType, FinanceType, RequisitionStatus, ReachoutMode } from '@/shared/enums';

/* Summaries the church Administrator sees when inspecting a department. All from local records. */

export const INSPECT_KEYS: Record<string, DepartmentCode> = {
  finance: DepartmentCode.FINANCE,
  bacentas: DepartmentCode.BACENTA,
  'airport-stars': DepartmentCode.AIRPORT_STARS,
  'tele-pastoring': DepartmentCode.TELE_PASTORING,
  children: DepartmentCode.CHILDRENS_CHURCH,
  campuses: DepartmentCode.CAMPUSES,
  discipleship: DepartmentCode.DISCIPLESHIP,
};
export const INSPECT_KEY_BY_CODE: Record<string, string> = Object.fromEntries(Object.entries(INSPECT_KEYS).map(([k, v]) => [v, k]));
export const DEPT_DASHBOARD: Record<string, string> = {
  [DepartmentCode.FINANCE]: '/finance/collections',
  [DepartmentCode.BACENTA]: '/bacentas/hod',
  [DepartmentCode.AIRPORT_STARS]: '/airport-stars/checkin',
  [DepartmentCode.TELE_PASTORING]: '/tele-pastoring/absentees',
  [DepartmentCode.CHILDRENS_CHURCH]: '/children/checkin',
  [DepartmentCode.CAMPUSES]: '/campuses/hod',
  [DepartmentCode.DISCIPLESHIP]: '/discipleship/classes',
};

const HEAD_ROLE: Record<string, string> = {
  [DepartmentCode.FINANCE]: 'FINANCE_HOD',
  [DepartmentCode.BACENTA]: 'BACENTA_HOD',
  [DepartmentCode.AIRPORT_STARS]: 'AIRPORT_HOD',
  [DepartmentCode.TELE_PASTORING]: 'TELE_HOD',
  [DepartmentCode.CHILDRENS_CHURCH]: 'CHILDREN_HOD',
  [DepartmentCode.CAMPUSES]: 'CAMPUS_HOD',
  [DepartmentCode.DISCIPLESHIP]: 'DISCIPLESHIP_HOD',
};

export interface Activity {
  kind: 'money' | 'meeting' | 'outreach' | 'checkin' | 'call' | 'request' | 'kids' | 'class';
  title: string;
  sub: string;
  amount?: number;
  at: string;
}
export interface InspectData {
  code: DepartmentCode;
  name: string;
  head: string | null;
  team: number;
  activityLabel: string;
  activityCount: number;
  attendanceLabel: string;
  attendance: number | null;
  bars: { label: string; pct: number }[];
  attendanceNote: string;
  contributed: number;
  spent: number;
  people: { name: string; sub: string; pct: number }[];
  peopleTitle: string;
  activity: Activity[];
}

const monthStart = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
};
const inMonth = (d?: string | null) => !!d && new Date(d) >= monthStart();
const short = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export const inspectDepartment = (tenantId: string, code: DepartmentCode): InspectData | null => {
  const db = readStore();
  const dept = db.departments.find((d) => d.tenantId === tenantId && d.code === code);
  if (!dept) return null;
  const members = new Map(db.members.filter((m) => m.tenantId === tenantId).map((m) => [m.id, m]));
  const head = db.users.find((u) => u.tenantId === tenantId && u.isActive && u.role === HEAD_ROLE[code] && (!u.departmentId || u.departmentId === dept.id));
  const team = db.servingMembers.filter((s) => s.tenantId === tenantId && s.departmentId === dept.id);
  const services = db.services
    .filter((s) => s.tenantId === tenantId && new Date(s.serviceDate) <= new Date())
    .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
  const last5 = services.slice(0, 5).reverse();

  const contributed = db.deptContributions
    .filter((c) => c.tenantId === tenantId && c.departmentId === dept.id && inMonth(c.contributionDate))
    .reduce((a, c) => a + Number(c.amount), 0);
  const expenses = db.financeTransactions
    .filter((t) => t.tenantId === tenantId && t.departmentId === dept.id && t.type === FinanceType.EXPENSE && inMonth(t.transactionDate || t.createdAt))
    .reduce((a, t) => a + Number(t.amount), 0);
  const reqs = db.requisitions.filter((r) => r.tenantId === tenantId && r.departmentId === dept.id);
  const spent =
    expenses ||
    reqs.filter((r) => r.status === RequisitionStatus.PAID && inMonth(r.requestedAt)).reduce((a, r) => a + Number(r.amountPaid || r.totalAmount), 0);

  const reqActivity: Activity[] = reqs.map((r) => ({
    kind: 'request',
    title: `${r.requisitionNumber} · ${r.title}`,
    sub: r.status === RequisitionStatus.PENDING_ADMIN ? 'Pending approval' : r.status === RequisitionStatus.PAID ? `Paid · ${short(r.requestedAt)}` : `${r.status.charAt(0)}${r.status.slice(1).toLowerCase()} · ${short(r.requestedAt)}`,
    amount: requisitionAsk(r),
    at: r.requestedAt,
  }));

  // Team on duty (serving check-ins) for the last five services.
  const teamIds = new Set(team.map((t) => t.memberId));
  const dutyFor = (serviceId: string) =>
    new Set(
      db.serviceAttendance
        .filter((a) => a.serviceId === serviceId && a.isServingCheckin && a.servingDepartmentId === dept.id && teamIds.has(a.memberId))
        .map((a) => a.memberId)
    );
  const dutyBars = last5.map((s) => ({ label: short(s.serviceDate), pct: pct(dutyFor(s.id).size, team.length) }));
  const teamPeople = team
    .map((t) => {
      const served = last5.filter((s) => dutyFor(s.id).has(t.memberId)).length;
      return { name: members.get(t.memberId)?.fullName ?? 'Team member', sub: t.servingRole, pct: pct(served, last5.length) };
    })
    .sort((a, b) => b.pct - a.pct);
  const avg = (bars: { pct: number }[]) => (bars.length ? Math.round(bars.reduce((a, b) => a + b.pct, 0) / bars.length) : null);

  const base = {
    code,
    name: dept.name,
    head: head?.fullName ?? null,
    team: team.length,
    contributed,
    spent,
  };

  if (code === DepartmentCode.BACENTA || code === DepartmentCode.CAMPUSES) {
    const type = code === DepartmentCode.BACENTA ? FellowshipUnitType.BACENTA : FellowshipUnitType.CAMPUS;
    const units = db.fellowshipUnits.filter((u) => u.tenantId === tenantId && u.unitType === type);
    const unitIds = new Set(units.map((u) => u.id));
    const unitMembers = (unitId: string) =>
      [...members.values()].filter((m) => (type === FellowshipUnitType.BACENTA ? m.bacentaId : m.campusId) === unitId && m.isActive).length;
    const meetings = db.fellowshipMeetings.filter((m) => unitIds.has(m.unitId)).sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
    const outreaches = db.fellowshipOutreaches.filter((o) => unitIds.has(o.unitId));
    const present = (meetingId: string) => db.fellowshipMeetingAttendance.filter((a) => a.meetingId === meetingId).length;
    const totalMembers = units.reduce((a, u) => a + unitMembers(u.id), 0);
    // Weekly attendance: people present across all units ÷ all unit members, last 5 weeks with meetings.
    const weeks = new Map<string, number>();
    meetings.forEach((m) => {
      const d = new Date(m.meetingDate);
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).toISOString().slice(0, 10);
      weeks.set(monday, (weeks.get(monday) ?? 0) + present(m.id));
    });
    const bars = [...weeks.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 5)
      .reverse()
      .map(([w, n]) => ({ label: short(w), pct: Math.min(100, pct(n, totalMembers)) }));
    const lastWeek = [...weeks.entries()].sort((a, b) => b[0].localeCompare(a[0]))[0];
    const unitWord = type === FellowshipUnitType.BACENTA ? 'bacenta' : 'campus';
    return {
      ...base,
      activityLabel: 'Meetings & outreach',
      activityCount: meetings.filter((m) => inMonth(m.meetingDate)).length + outreaches.filter((o) => inMonth(o.outreachDate)).length,
      attendanceLabel: type === FellowshipUnitType.BACENTA ? 'Member attendance' : 'Student attendance',
      attendance: avg(bars),
      bars,
      attendanceNote: lastWeek ? `${lastWeek[1]} of ${totalMembers} ${unitWord} members came in the week of ${short(lastWeek[0])}` : `No ${unitWord} meetings recorded yet`,
      peopleTitle: type === FellowshipUnitType.BACENTA ? 'Bacentas' : 'Campuses',
      people: units
        .map((u) => {
          const ms = meetings.filter((m) => m.unitId === u.id).slice(0, 5);
          const size = unitMembers(u.id);
          const p = ms.length && size ? Math.round(ms.reduce((a, m) => a + present(m.id), 0) / ms.length / size * 100) : 0;
          return { name: u.name, sub: u.leaderName || 'No leader yet', pct: Math.min(100, p) };
        })
        .sort((a, b) => b.pct - a.pct),
      activity: [
        ...meetings.map<Activity>((m) => ({
          kind: 'meeting',
          title: `${units.find((u) => u.id === m.unitId)?.name ?? 'Meeting'}${m.title ? ` · ${m.title}` : ''}`,
          sub: `${short(m.meetingDate)} · ${present(m.id)} present`,
          amount: Number(m.offertoryCollected || 0) + Number(m.titheCollected || 0) || undefined,
          at: m.meetingDate,
        })),
        ...outreaches.map<Activity>((o) => ({
          kind: 'outreach',
          title: `Outreach · ${o.location || units.find((u) => u.id === o.unitId)?.name || ''}`,
          sub: `${short(o.outreachDate)} · ${o.soulsWonCount} soul${o.soulsWonCount === 1 ? '' : 's'}`,
          at: o.outreachDate,
        })),
        ...reqActivity,
      ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 5),
    };
  }

  if (code === DepartmentCode.CHILDRENS_CHURCH) {
    const kids = db.children.filter((c) => c.tenantId === tenantId && c.isActive).length;
    const kidsAt = (serviceId: string) => db.childAttendance.filter((a) => a.serviceId === serviceId);
    const bars = last5.map((s) => ({ label: short(s.serviceDate), pct: Math.min(100, pct(kidsAt(s.id).length, kids)) }));
    const latest = services[0];
    return {
      ...base,
      activityLabel: 'Services held',
      activityCount: services.filter((s) => inMonth(s.serviceDate) && kidsAt(s.id).length > 0).length,
      attendanceLabel: 'Children attending',
      attendance: avg(bars),
      bars,
      attendanceNote: latest ? `${kidsAt(latest.id).length} of ${kids} registered children came on ${short(latest.serviceDate)}` : 'No services yet',
      peopleTitle: 'Who’s showing up',
      people: teamPeople,
      activity: [
        ...services.slice(0, 5).map<Activity>((s) => {
          const a = kidsAt(s.id);
          return {
            kind: 'kids',
            title: `${s.title} · check-in`,
            sub: `${short(s.serviceDate)} · ${a.length} child${a.length === 1 ? '' : 'ren'}${a.length ? ` · ${a.filter((x) => x.checkedOutAt).length} collected` : ''}`,
            at: s.serviceDate,
          };
        }),
        ...reqActivity,
      ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 5),
    };
  }

  if (code === DepartmentCode.TELE_PASTORING) {
    const reach = db.teleReachouts.filter((r) => r.tenantId === tenantId).sort((a, b) => b.reachoutDate.localeCompare(a.reachoutDate));
    const thisMonth = reach.filter((r) => inMonth(r.reachoutDate));
    const reachSpent = thisMonth.reduce((a, r) => a + Number(r.amountSpent || 0), 0);
    return {
      ...base,
      spent: spent || reachSpent,
      activityLabel: 'Reach-outs made',
      activityCount: thisMonth.length,
      attendanceLabel: 'Team on duty',
      attendance: avg(dutyBars),
      bars: dutyBars,
      attendanceNote: `${thisMonth.length} people reached this month`,
      peopleTitle: 'Who’s showing up',
      people: teamPeople,
      activity: [
        ...reach.slice(0, 5).map<Activity>((r) => ({
          kind: 'call',
          title: `${r.mode === ReachoutMode.PHONE_CALL ? 'Call' : 'Visit'} · ${members.get(r.memberId)?.fullName ?? 'Member'}`,
          sub: `${short(r.reachoutDate)}${r.comment ? ` · ${r.comment}` : ''}`,
          amount: Number(r.amountSpent || 0) || undefined,
          at: r.reachoutDate,
        })),
        ...reqActivity,
      ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 5),
    };
  }

  if (code === DepartmentCode.AIRPORT_STARS) {
    const checkins = (serviceId: string) => db.serviceAttendance.filter((a) => a.serviceId === serviceId && !a.isServingCheckin).length;
    const latest = services[0];
    return {
      ...base,
      activityLabel: 'Services served',
      activityCount: services.filter((s) => inMonth(s.serviceDate) && checkins(s.id) > 0).length,
      attendanceLabel: 'Team on duty',
      attendance: avg(dutyBars),
      bars: dutyBars,
      attendanceNote: latest ? `${dutyFor(latest.id).size} of ${team.length} on duty for ${latest.title} · ${checkins(latest.id)} people checked in` : 'No services yet',
      peopleTitle: 'Who’s showing up',
      people: teamPeople,
      activity: [
        ...services.slice(0, 5).map<Activity>((s) => {
          const n = checkins(s.id);
          const first = db.serviceAttendance.filter((a) => a.serviceId === s.id && a.isFirstTimeVisit).length;
          return { kind: 'checkin', title: `${s.title} · check-in`, sub: `${short(s.serviceDate)} · ${n} checked in${first ? ` · ${first} first-timers` : ''}`, at: s.serviceDate };
        }),
        ...reqActivity,
      ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 5),
    };
  }

  if (code === DepartmentCode.DISCIPLESHIP) {
    const today = new Date().toISOString().slice(0, 10);
    const classes = (db.discipleshipClasses ?? []).filter((c) => c.tenantId === tenantId).sort((a, b) => b.classDate.localeCompare(a.classDate));
    const held = classes.filter((c) => c.classDate <= today);
    const enrolled = (db.discipleshipEnrollments ?? []).filter((e) => e.tenantId === tenantId && e.status === 'ACTIVE');
    const att = (db.discipleshipAttendance ?? []).filter((a) => a.tenantId === tenantId && !a.isTeam);
    const target = (db.discipleshipSettings ?? []).find((x) => x.tenantId === tenantId)?.classesToComplete || 6;
    const presentAt = (classId: string) => att.filter((a) => a.classId === classId).length;
    const bars = held.slice(0, 5).reverse().map((c) => ({ label: short(c.classDate), pct: Math.min(100, pct(presentAt(c.id), enrolled.length)) }));
    const classIds = new Set(classes.map((c) => c.id));
    const done = (memberId: string) => att.filter((a) => a.memberId === memberId && classIds.has(a.classId)).length;
    const completed = enrolled.filter((e) => done(e.memberId) >= target).length;
    const latest = held[0];
    return {
      ...base,
      activityLabel: 'Classes held',
      activityCount: held.filter((c) => inMonth(c.classDate)).length,
      attendanceLabel: 'Class attendance',
      attendance: avg(bars),
      bars,
      attendanceNote: latest
        ? `${presentAt(latest.id)} of ${enrolled.length} enrolled came to ${latest.name} · ${completed} completed so far`
        : `${enrolled.length} enrolled · no classes held yet`,
      peopleTitle: 'Progress',
      people: enrolled
        .map((e) => {
          const n = done(e.memberId);
          return { name: members.get(e.memberId)?.fullName ?? 'Member', sub: n >= target ? 'Completed' : n ? `${n} of ${target} classes` : 'Enrolled, not started', pct: Math.min(100, pct(n, target)) };
        })
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 8),
      activity: [
        ...held.slice(0, 5).map<Activity>((c) => ({ kind: 'class', title: c.name, sub: `${short(c.classDate)} · ${presentAt(c.id)} present · ${c.trainerName}`, at: c.classDate })),
        ...reqActivity,
      ]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 5),
    };
  }

  // Finance (and any other department): records made + team on duty.
  const tx = db.financeTransactions.filter((t) => t.tenantId === tenantId).sort((a, b) => (b.transactionDate || b.createdAt).localeCompare(a.transactionDate || a.createdAt));
  const latest = last5[last5.length - 1];
  const CAT: Record<string, string> = {
    OFFERTORY: 'Offering recorded',
    TITHE: 'Tithe recorded',
    PARTNERSHIP: 'Partner gift recorded',
    DEPT_CONTRIBUTION: 'Team contribution',
    REQUISITION_PAYOUT: 'Requisition paid',
    TELE_REACHOUT_EXPENSE: 'Reach-out expense',
    OTHER_EXPENSE: 'Expense paid',
  };
  return {
    ...base,
    activityLabel: 'Records made',
    activityCount: tx.filter((t) => inMonth(t.transactionDate || t.createdAt)).length,
    attendanceLabel: 'Team on duty',
    attendance: avg(dutyBars),
    bars: dutyBars,
    attendanceNote: latest ? `${dutyFor(latest.id).size} of ${team.length} team members served on ${short(latest.serviceDate)}` : 'No services yet',
    peopleTitle: 'Who’s showing up',
    people: teamPeople,
    activity: [
      ...tx.slice(0, 5).map<Activity>((t) => ({
        kind: 'money',
        title: t.description || CAT[t.category] || 'Finance record',
        sub: `${short(t.transactionDate || t.createdAt)} · ${CAT[t.category] ?? t.category}`,
        amount: Number(t.amount),
        at: t.transactionDate || t.createdAt,
      })),
      ...reqActivity,
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 5),
  };
};
