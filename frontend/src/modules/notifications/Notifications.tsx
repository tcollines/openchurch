import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ClipboardList, Coins, FileText, Heart, PhoneCall, Receipt, UserPlus, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChurchStoreRefresh } from '@/hooks/useChurchStoreRefresh';
import { readStore, requisitionAsk, SubscriptionService, TelePastoringService } from '@/services/churchService';
import { DepartmentCode, FinanceCategory, FinanceType, RequisitionStatus, UserRole, WorkflowStatus } from '@/shared/enums';
import { Tenant, User } from '@/shared/types';
import { Chips, EmptyState, PageHeader, TileTone } from '@/components/ui/kit';
import { BackRow } from '@/modules/platform/CouncilPages';

/* Notifications are worked out from what has happened in the church's data, so nothing extra
   needs storing. Which ones a person has read is kept on their device. */

type Kind = 'approval' | 'money' | 'souls' | 'people' | 'billing';
export type Notice = { id: string; kind: Kind; icon: React.ElementType; tone: TileTone; title: string; sub: string; at: string; to: string };

const TONE_CLASS: Record<string, string> = {
  amber: 'bg-[#FCEFD9] text-[#7A4300]',
  blue: 'bg-[#DDEBF7] text-[#1D4E7A]',
  lime: 'bg-[#E3F1D4] text-[#2F5D10]',
  green: 'bg-[#DDF1E4] text-[#0E5A37]',
  red: 'bg-[#FBE1DF] text-[#8F1D14]',
  violet: 'bg-[#ECE3F6] text-[#55307F]',
  neutral: 'bg-church-canvas text-church-text',
};

const HEAD_DEPT: Partial<Record<UserRole, DepartmentCode>> = {
  [UserRole.FINANCE_HOD]: DepartmentCode.FINANCE,
  [UserRole.BACENTA_HOD]: DepartmentCode.BACENTA,
  [UserRole.AIRPORT_HOD]: DepartmentCode.AIRPORT_STARS,
  [UserRole.TELE_HOD]: DepartmentCode.TELE_PASTORING,
  [UserRole.CHILDREN_HOD]: DepartmentCode.CHILDRENS_CHURCH,
  [UserRole.CAMPUS_HOD]: DepartmentCode.CAMPUSES,
};
const DEPT_LABEL: Record<string, string> = {
  FINANCE: 'Finance',
  BACENTA: 'Bacentas',
  AIRPORT_STARS: 'Airport Stars',
  TELE_PASTORING: 'Tele Pastoring',
  CHILDRENS_CHURCH: 'Children’s Church',
  CAMPUSES: 'Campuses',
  ADMIN: 'Administration',
};
const MORE_ROUTE: Record<string, string> = {
  FINANCE: '/finance/more',
  BACENTA: '/bacentas/hod/more',
  AIRPORT_STARS: '/airport-stars/more',
  TELE_PASTORING: '/tele-pastoring/more',
  CHILDRENS_CHURCH: '/children/more',
  CAMPUSES: '/campuses/hod/more',
};
const short = (n: number) => (n >= 1_000_000 ? `${Math.round(n / 10_000) / 100}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${Math.round(n)}`);

export const buildNotifications = (user: User | null, tenant: Tenant | null): Notice[] => {
  if (!user || !tenant) return [];
  const db = readStore();
  const t = tenant.id;
  const cur = tenant.currency || 'UGX';
  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.PLATFORM_ADMIN;
  const depts = db.departments.filter((d) => d.tenantId === t);
  const deptOf = (id: string) => depts.find((d) => d.id === id);
  const label = (id: string) => DEPT_LABEL[deptOf(id)?.code ?? ''] ?? deptOf(id)?.name ?? 'A department';
  const myDeptId = (() => {
    const code = HEAD_DEPT[user.role];
    return code ? depts.find((d) => d.code === code)?.id : user.departmentId || undefined;
  })();
  const myMore = MORE_ROUTE[depts.find((d) => d.id === myDeptId)?.code ?? ''] ?? '/';
  const since = Date.now() - 30 * 864e5;
  const recent = (iso: string) => new Date(iso).getTime() >= since;
  const out: Notice[] = [];
  const services = new Map(db.services.filter((s) => s.tenantId === t).map((s) => [s.id, s]));

  // Requisitions & workplans
  for (const r of db.requisitions.filter((x) => x.tenantId === t && recent(x.createdAt))) {
    const mine = r.departmentId === myDeptId;
    const give = Number(r.deptContributionAmount || 0);
    if (r.status === RequisitionStatus.PENDING_ADMIN && isAdmin) {
      out.push({ id: `req-${r.id}`, kind: 'approval', icon: FileText, tone: 'amber', title: `${label(r.departmentId)} sent a requisition`, sub: `${r.title} · asking ${cur} ${short(requisitionAsk(r))}${give ? ` after giving ${short(give)}` : ''}`, at: r.createdAt, to: '/admin/approvals' });
    }
    if (mine && (r.status === RequisitionStatus.APPROVED || r.status === RequisitionStatus.REJECTED)) {
      const ok = r.status === RequisitionStatus.APPROVED;
      out.push({ id: `req-${r.status}-${r.id}`, kind: 'approval', icon: FileText, tone: ok ? 'green' : 'red', title: `Your requisition was ${ok ? 'approved' : 'rejected'}`, sub: ok ? `${r.title} · Finance will pay ${cur} ${short(requisitionAsk(r))}` : `${r.title}${r.rejectionReason ? ` · ${r.rejectionReason}` : ''}`, at: r.createdAt, to: myMore });
    }
    if (r.status === RequisitionStatus.APPROVED && user.role === UserRole.FINANCE_HOD) {
      out.push({ id: `req-topay-${r.id}`, kind: 'money', icon: Receipt, tone: 'amber', title: `Ready to pay out ${r.requisitionNumber}`, sub: `${label(r.departmentId)} · ${cur} ${short(requisitionAsk(r) - r.amountPaid)}`, at: r.createdAt, to: '/finance/expenses' });
    }
  }
  for (const w of db.workplans.filter((x) => x.tenantId === t && recent(x.createdAt))) {
    if (w.status === WorkflowStatus.SUBMITTED && isAdmin) {
      out.push({ id: `wp-${w.id}`, kind: 'approval', icon: ClipboardList, tone: 'blue', title: `${label(w.departmentId)} submitted a workplan`, sub: `${w.title || w.monthLabel} · ${cur} ${short(Number(w.totalRequested))}`, at: w.createdAt, to: '/admin/approvals' });
    }
    if (w.departmentId === myDeptId && w.status !== WorkflowStatus.SUBMITTED && w.status !== WorkflowStatus.DRAFT) {
      const ok = w.status === WorkflowStatus.APPROVED;
      out.push({ id: `wp-${w.status}-${w.id}`, kind: 'approval', icon: ClipboardList, tone: ok ? 'green' : 'red', title: `Your workplan was ${ok ? 'approved' : 'rejected'}`, sub: `${w.title || w.monthLabel}${ok ? ` · ${cur} ${short(Number(w.totalApproved))}` : ''}`, at: w.createdAt, to: myMore });
    }
  }

  // Money: payouts and collections
  for (const tx of db.financeTransactions.filter((x) => x.tenantId === t && recent(x.createdAt))) {
    if (tx.type === FinanceType.EXPENSE && tx.requisitionId) {
      const r = db.requisitions.find((x) => x.id === tx.requisitionId);
      if (r && (isAdmin || r.departmentId === myDeptId)) {
        out.push({ id: `pay-${tx.id}`, kind: 'money', icon: Receipt, tone: 'neutral', title: `Finance paid out ${r.requisitionNumber}`, sub: `${label(r.departmentId)} · ${cur} ${short(Number(tx.amount))}`, at: tx.createdAt, to: isAdmin ? '/admin/finance' : myMore });
      }
    }
  }
  if (isAdmin) {
    const bySvc = new Map<string, { total: number; at: string }>();
    for (const tx of db.financeTransactions) {
      if (tx.tenantId !== t || tx.type !== FinanceType.INCOME || !tx.serviceId || !recent(tx.createdAt)) continue;
      if (![FinanceCategory.OFFERTORY, FinanceCategory.TITHE, FinanceCategory.PARTNERSHIP].includes(tx.category)) continue;
      const g = bySvc.get(tx.serviceId) ?? { total: 0, at: tx.createdAt };
      g.total += Number(tx.amount);
      if (tx.createdAt > g.at) g.at = tx.createdAt;
      bySvc.set(tx.serviceId, g);
    }
    for (const [sid, g] of bySvc) {
      out.push({ id: `col-${sid}-${Math.round(g.total)}`, kind: 'money', icon: Coins, tone: 'green', title: `Collections recorded for ${services.get(sid)?.title ?? 'a service'}`, sub: `${cur} ${short(g.total)} · offertory, tithe & partnership`, at: g.at, to: '/admin/finance' });
    }
  }

  // Souls won, grouped by service
  if (isAdmin || user.role === UserRole.TELE_HOD || user.role === UserRole.TELE_PASTOR) {
    const groups = new Map<string, { n: number; at: string; label: string }>();
    for (const s of db.soulsWon.filter((x) => x.tenantId === t && recent(x.createdAt))) {
      const key = `${s.serviceId || s.sourceLabel}-${s.wonDate}`;
      const g = groups.get(key) ?? { n: 0, at: s.createdAt, label: s.serviceId ? services.get(s.serviceId)?.title ?? s.sourceLabel : s.sourceLabel };
      g.n += 1;
      if (s.createdAt > g.at) g.at = s.createdAt;
      groups.set(key, g);
    }
    for (const [key, g] of groups) {
      out.push({ id: `souls-${key}-${g.n}`, kind: 'souls', icon: Heart, tone: 'lime', title: `${g.n} ${g.n === 1 ? 'soul' : 'souls'} won at ${g.label}`, sub: 'Tele Pastoring is following them up', at: g.at, to: isAdmin ? '/admin/inspect/tele-pastoring' : '/tele-pastoring/souls' });
    }
  }

  // Absentees (3 services in a row)
  if (isAdmin || user.role === UserRole.TELE_HOD || user.role === UserRole.TELE_PASTOR) {
    const list = TelePastoringService.getThreeServiceAbsentees(t, 'ADULT');
    const lastSvc = [...services.values()].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate))[0];
    if (list.length && lastSvc) {
      out.push({ id: `absent-${lastSvc.id}-${list.length}`, kind: 'people', icon: PhoneCall, tone: 'violet', title: `${list.length} ${list.length === 1 ? 'member' : 'members'} missed 3 services in a row`, sub: 'Tele Pastoring has them on the call list', at: lastSvc.createdAt || `${lastSvc.serviceDate}T12:00:00Z`, to: isAdmin ? '/admin/inspect/tele-pastoring' : '/tele-pastoring/absentees' });
    }
  }

  // New members
  if (isAdmin) {
    for (const m of db.members.filter((x) => x.tenantId === t && x.isActive && Date.now() - new Date(x.createdAt).getTime() < 14 * 864e5)) {
      out.push({ id: `mem-${m.id}`, kind: 'people', icon: UserPlus, tone: 'neutral', title: `${m.fullName} was added to members`, sub: m.isFirstTimer ? 'First timer' : m.residence, at: m.createdAt, to: '/admin/members' });
    }
  }

  // Subscription
  if (user.role === UserRole.ADMIN) {
    const st = SubscriptionService.getState(tenant);
    if (st && (st.phase === 'due' || st.phase === 'expired')) {
      const day = new Date().toISOString().slice(0, 10);
      out.push({
        id: `billing-${st.phase}-${day}`,
        kind: 'billing',
        icon: Wallet,
        tone: 'red',
        title: st.phase === 'expired' ? 'Your Open Church subscription has ended' : st.isTrial ? `Free trial ends in ${st.daysLeft} ${st.daysLeft === 1 ? 'day' : 'days'}` : `Subscription due in ${st.daysLeft} ${st.daysLeft === 1 ? 'day' : 'days'}`,
        sub: `Pay ${cur} ${st.fee.toLocaleString('en-US')} to keep Open Church running`,
        at: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
        to: '/admin/subscription',
      });
    }
  }

  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60);
};

/* ── Read state (per person, on this device) ────────────────────────── */

const readKey = (uid: string) => `open_church_notifications_read_${uid}`;
const getRead = (uid: string): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(readKey(uid)) || '[]'));
  } catch {
    return new Set();
  }
};
const saveRead = (uid: string, ids: Set<string>) => {
  try {
    localStorage.setItem(readKey(uid), JSON.stringify([...ids].slice(-500)));
  } catch {
    /* storage full or blocked */
  }
  window.dispatchEvent(new Event('oc-notifications-read'));
};

export const useNotifications = () => {
  useChurchStoreRefresh();
  const { user, tenant } = useAuth();
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    window.addEventListener('oc-notifications-read', fn);
    return () => window.removeEventListener('oc-notifications-read', fn);
  }, []);
  const list = buildNotifications(user, tenant);
  const read = user ? getRead(user.id) : new Set<string>();
  const unread = list.filter((n) => !read.has(n.id));
  return {
    list,
    isUnread: (n: Notice) => !read.has(n.id),
    unreadCount: unread.length,
    markRead: (n: Notice) => {
      if (!user || read.has(n.id)) return;
      read.add(n.id);
      saveRead(user.id, read);
    },
    markAllRead: () => {
      if (!user) return;
      list.forEach((n) => read.add(n.id));
      saveRead(user.id, read);
    },
  };
};

/* ── UI ──────────────────────────────────────────────────────────────── */

const when = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
  return days <= 0 ? time : days === 1 ? `Yesterday · ${time}` : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};
const groupOf = (iso: string) => {
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 864e5);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : 'Earlier';
};

const NoticeRow: React.FC<{ n: Notice; unread: boolean; onOpen: () => void }> = ({ n, unread, onOpen }) => {
  const Icon = n.icon;
  return (
    <button type="button" onClick={onOpen} className={`oc-press w-full flex items-start gap-3 p-3 -mx-3 rounded-2xl text-left ${unread ? 'bg-[#F1F9E6]' : ''}`} style={{ width: 'calc(100% + 24px)' }}>
      <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${TONE_CLASS[n.tone] ?? TONE_CLASS.neutral}`}>
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
        <span className={`text-[15px] leading-[1.3] ${unread ? 'font-bold' : 'font-semibold'}`}>{n.title}</span>
        <span className="oc-sub leading-[1.4]">{n.sub}</span>
        <span className="text-xs text-[#8A938C]">{when(n.at)}</span>
      </span>
      {unread ? <span aria-label="Unread" className="w-[9px] h-[9px] mt-1.5 rounded-full bg-[#3F8F12] shrink-0" /> : <span className="w-[9px] shrink-0" />}
    </button>
  );
};

type Filter = 'all' | 'unread' | 'approval' | 'money';
const filterItems = (counts: Record<Filter, number>) =>
  [
    { value: 'all' as Filter, label: 'All', count: counts.all },
    { value: 'unread' as Filter, label: 'Unread', count: counts.unread },
    { value: 'approval' as Filter, label: 'Approvals', count: counts.approval },
    { value: 'money' as Filter, label: 'Money', count: counts.money },
  ].filter((f) => f.value === 'all' || f.value === 'unread' || f.count > 0);

const useFiltered = () => {
  const n = useNotifications();
  const [filter, setFilter] = useState<Filter>('all');
  const counts: Record<Filter, number> = {
    all: n.list.length,
    unread: n.unreadCount,
    approval: n.list.filter((x) => x.kind === 'approval').length,
    money: n.list.filter((x) => x.kind === 'money').length,
  };
  const shown = n.list.filter((x) => (filter === 'all' ? true : filter === 'unread' ? n.isUnread(x) : x.kind === filter));
  return { ...n, filter, setFilter, counts, shown };
};

/** Full page: /notifications (on phones it opens with a back arrow and no bottom bar). */
export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const n = useFiltered();
  const open = (x: Notice) => {
    n.markRead(x);
    navigate(x.to);
  };
  const groups = ['Today', 'Yesterday', 'Earlier'].map((g) => ({ g, items: n.shown.filter((x) => groupOf(x.at) === g) })).filter((x) => x.items.length);
  return (
    <>
      <div className="flex items-center gap-2.5">
        <div className="flex-1">
          <BackRow label="Back" onClick={() => navigate(-1)} />
        </div>
        {n.unreadCount > 0 && (
          <button type="button" onClick={n.markAllRead} className="text-sm font-semibold text-[#2F6B0A] flex items-center gap-1">
            <Check className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>
      <PageHeader title="Notifications" subtitle="Approvals, payments, souls and anything that needs you." />
      <Chips<Filter> items={filterItems(n.counts)} value={n.filter} onChange={n.setFilter} />
      {groups.length === 0 ? (
        <EmptyState icon={Bell} title={n.filter === 'unread' ? 'You’re all caught up' : 'Nothing yet'} sub="New requisitions, payouts, souls won and more will show up here." />
      ) : (
        <div className="flex flex-col gap-3 max-w-[760px]">
          {groups.map(({ g, items }) => (
            <React.Fragment key={g}>
              <span className="text-[13px] font-semibold text-church-muted px-0.5 pt-1">{g}</span>
              <section className="bg-white rounded-[20px] px-4 py-1 flex flex-col gap-0.5">
                {items.map((x) => (
                  <NoticeRow key={x.id} n={x} unread={n.isUnread(x)} onOpen={() => open(x)} />
                ))}
              </section>
            </React.Fragment>
          ))}
        </div>
      )}
    </>
  );
};

/** The bell: on phones it opens the Notifications page; on desktop a panel under the bell. */
export const NotificationBell: React.FC<{ className: string }> = ({ className }) => {
  const navigate = useNavigate();
  const n = useFiltered();
  const [panel, setPanel] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!panel) return;
    const onDoc = (e: MouseEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setPanel(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanel(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [panel]);
  const click = () => {
    if (window.matchMedia('(min-width: 768px)').matches) setPanel((p) => !p);
    else navigate('/notifications');
  };
  return (
    <div ref={wrap} className="relative shrink-0">
      <button type="button" onClick={click} aria-label={n.unreadCount ? `Notifications, ${n.unreadCount} unread` : 'Notifications'} aria-expanded={panel} className={className}>
        <Bell className="w-5 h-5" strokeWidth={1.8} />
        {n.unreadCount > 0 && <span className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-church-neg ring-2 ring-white" />}
      </button>
      {panel && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-[52px] z-50 w-[440px] max-h-[min(760px,calc(100vh-120px))] overflow-y-auto bg-white rounded-[24px] shadow-[0_30px_80px_-20px_rgba(15,36,24,0.45),0_0_0_1px_rgba(15,36,24,0.06)] px-5 pt-[18px] pb-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="font-display text-[22px] font-bold">Notifications</span>
            {n.unreadCount > 0 && (
              <button type="button" onClick={n.markAllRead} className="text-sm font-semibold text-[#2F6B0A]">
                Mark all read
              </button>
            )}
          </div>
          <div className="shrink-0">
            <Chips<Filter> items={filterItems(n.counts).slice(0, 3)} value={n.filter} onChange={n.setFilter} />
          </div>
          {n.shown.length === 0 ? (
            <p className="m-0 py-8 text-center oc-sub">{n.filter === 'unread' ? 'You’re all caught up.' : 'Nothing yet.'}</p>
          ) : (
            <div className="flex flex-col gap-0.5 px-3">
              {n.shown.slice(0, 8).map((x) => (
                <NoticeRow
                  key={x.id}
                  n={x}
                  unread={n.isUnread(x)}
                  onOpen={() => {
                    n.markRead(x);
                    setPanel(false);
                    navigate(x.to);
                  }}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setPanel(false);
              navigate('/notifications');
            }}
            className="h-11 mt-1 border-t border-church-line text-sm font-semibold"
          >
            See all notifications
          </button>
        </div>
      )}
    </div>
  );
};
