import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Baby,
  Building2,
  Plane,
  HeartPulse,
  CheckCircle2,
  Coins,
  GraduationCap,
  HeartHandshake,
  Home,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Bell,
  ChevronRight,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { Avatar, initials } from '@/components/ui/kit';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/shared/enums';
import { ROLE_LABELS } from '@/shared/formatters';
import { MobileSheet } from '@/components/ui/FormControls';

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
}

export const getNavItemsForRole = (role: UserRole): NavItem[] => {
  switch (role) {
    case UserRole.PLATFORM_ADMIN:
      return [
        { to: '/platform/tenants', label: 'Churches', shortLabel: 'Churches', icon: Building2 },
        { to: '/admin/overview', label: 'Inspect a church', shortLabel: 'Inspect', icon: LayoutDashboard },
      ];
    case UserRole.ADMIN:
      return [
        { to: '/admin/overview', label: 'Overview', shortLabel: 'Home', icon: LayoutDashboard },
        { to: '/admin/members', label: 'Members', shortLabel: 'Members', icon: Users },
        { to: '/admin/finance', label: 'Finance', shortLabel: 'Finance', icon: Wallet },
        { to: '/admin/serving', label: 'Team & duty', shortLabel: 'Team', icon: ShieldCheck },
        { to: '/admin/more', label: 'More', shortLabel: 'More', icon: MoreHorizontal },
      ];
    case UserRole.FINANCE_HOD:
      return [
        { to: '/finance/collections', label: 'Service collections', shortLabel: 'Collections', icon: Coins },
        { to: '/finance/partners', label: 'Partners', shortLabel: 'Partners', icon: HeartHandshake },
        { to: '/finance/outflows', label: 'Expenses & payouts', shortLabel: 'Expenses', icon: Wallet },
        { to: '/finance/more', label: 'More', shortLabel: 'More', icon: MoreHorizontal },
      ];
    case UserRole.FINANCE_OFFICER:
      return [
        { to: '/finance/collections', label: 'Service collections', shortLabel: 'Collections', icon: Coins },
        { to: '/finance/partners', label: 'Partners', shortLabel: 'Partners', icon: HeartHandshake },
        { to: '/finance/outflows', label: 'Expenses & payouts', shortLabel: 'Expenses', icon: Wallet },
      ];
    case UserRole.BACENTA_HOD:
      return [
        { to: '/bacentas/hod', label: 'Bacentas & reports', shortLabel: 'Bacentas', icon: Home },
        { to: '/bacentas/hod/attendance', label: 'Attendance', shortLabel: 'Attendance', icon: CheckCircle2 },
        { to: '/bacentas/hod/finance', label: 'Finance', shortLabel: 'Finance', icon: Coins },
        { to: '/bacentas/hod/more', label: 'More', shortLabel: 'More', icon: MoreHorizontal },
      ];
    case UserRole.BACENTA_LEADER:
      return [
        { to: '/bacentas/my-unit', label: 'Meeting check-in', shortLabel: 'Check-In', icon: CheckCircle2 },
        { to: '/bacentas/my-unit/outreach', label: 'Outreach report', shortLabel: 'Outreach', icon: Sparkles },
        { to: '/bacentas/my-unit/finance', label: 'Meeting finance', shortLabel: 'Finance', icon: Coins },
      ];
    case UserRole.AIRPORT_HOD:
      return [
        { to: '/airport-stars/checkin', label: 'Check-in', shortLabel: 'Check-In', icon: CheckCircle2 },
        { to: '/airport-stars/attendance', label: 'Team & duty', shortLabel: 'Team', icon: Users },
        { to: '/airport-stars/more', label: 'More', shortLabel: 'More', icon: MoreHorizontal },
      ];
    case UserRole.AIRPORT_MEMBER:
      // Strictly locked to Service Check-In only!
      return [
        { to: '/airport-stars/checkin', label: 'Check-in', shortLabel: 'Check-In', icon: CheckCircle2 },
      ];
    case UserRole.TELE_HOD:
      return [
        { to: '/tele-pastoring/absentees', label: 'Absentees', shortLabel: 'Absentees', icon: PhoneCall },
        { to: '/tele-pastoring/reachout', label: 'Reachout', shortLabel: 'Reachout', icon: HeartHandshake },
        { to: '/tele-pastoring/souls', label: 'Souls follow-up', shortLabel: 'Souls', icon: Sparkles },
        { to: '/tele-pastoring/members', label: 'Members', shortLabel: 'Members', icon: Users },
        { to: '/tele-pastoring/more', label: 'More', shortLabel: 'More', icon: MoreHorizontal },
      ];
    case UserRole.TELE_PASTOR:
      return [
        { to: '/tele-pastoring/absentees', label: 'Absentees', shortLabel: 'Absentees', icon: PhoneCall },
        { to: '/tele-pastoring/reachout', label: 'Reachout', shortLabel: 'Reachout', icon: HeartHandshake },
        { to: '/tele-pastoring/souls', label: 'Souls follow-up', shortLabel: 'Souls', icon: Sparkles },
        { to: '/tele-pastoring/members', label: 'Members', shortLabel: 'Members', icon: Users },
      ];
    case UserRole.CHILDREN_HOD:
      return [
        { to: '/children/checkin', label: 'Kids check-in', shortLabel: 'Check-In', icon: Baby },
        { to: '/children/souls', label: 'Souls won', shortLabel: 'Souls', icon: Sparkles },
        { to: '/children/followup', label: 'Follow-up', shortLabel: 'Follow-Up', icon: PhoneCall },
        { to: '/children/more', label: 'More', shortLabel: 'More', icon: MoreHorizontal },
      ];
    case UserRole.CHILDREN_WORKER:
      return [
        { to: '/children/checkin', label: 'Kids check-in', shortLabel: 'Check-In', icon: Baby },
        { to: '/children/souls', label: 'Souls won', shortLabel: 'Souls', icon: Sparkles },
        { to: '/children/followup', label: 'Follow-up', shortLabel: 'Follow-Up', icon: PhoneCall },
      ];
    case UserRole.CAMPUS_HOD:
      return [
        { to: '/campuses/hod', label: 'Campuses & reports', shortLabel: 'Campuses', icon: GraduationCap },
        { to: '/campuses/hod/attendance', label: 'Attendance', shortLabel: 'Attendance', icon: CheckCircle2 },
        { to: '/campuses/hod/finance', label: 'Finance', shortLabel: 'Finance', icon: Coins },
        { to: '/campuses/hod/more', label: 'More', shortLabel: 'More', icon: MoreHorizontal },
      ];
    case UserRole.CAMPUS_LEADER:
      return [
        { to: '/campuses/my-unit', label: 'Meeting check-in', shortLabel: 'Check-In', icon: CheckCircle2 },
        { to: '/campuses/my-unit/outreach', label: 'Outreach report', shortLabel: 'Outreach', icon: Sparkles },
        { to: '/campuses/my-unit/finance', label: 'Meeting finance', shortLabel: 'Finance', icon: Coins },
      ];
    default:
      return [];
  }
};

const DEPT_LABEL: Partial<Record<UserRole, string>> = {
  [UserRole.PLATFORM_ADMIN]: 'Network Council',
  [UserRole.ADMIN]: 'Administration',
  [UserRole.FINANCE_HOD]: 'Finance',
  [UserRole.FINANCE_OFFICER]: 'Finance',
  [UserRole.BACENTA_HOD]: 'Bacentas',
  [UserRole.BACENTA_LEADER]: 'My bacenta',
  [UserRole.AIRPORT_HOD]: 'Airport Stars',
  [UserRole.AIRPORT_MEMBER]: 'Airport Stars',
  [UserRole.TELE_HOD]: 'Tele Pastoring',
  [UserRole.TELE_PASTOR]: 'Tele Pastoring',
  [UserRole.CHILDREN_HOD]: 'Children’s Church',
  [UserRole.CHILDREN_WORKER]: 'Children’s Church',
  [UserRole.CAMPUS_HOD]: 'Campuses',
  [UserRole.CAMPUS_LEADER]: 'My campus',
};

const SHORT_ROLE: Record<UserRole, string> = {
  [UserRole.PLATFORM_ADMIN]: 'Network Council',
  [UserRole.ADMIN]: 'Church Administrator',
  [UserRole.FINANCE_HOD]: 'Head of Finance',
  [UserRole.FINANCE_OFFICER]: 'Finance team',
  [UserRole.BACENTA_HOD]: 'Head of Bacentas',
  [UserRole.BACENTA_LEADER]: 'Bacenta Leader',
  [UserRole.AIRPORT_HOD]: 'Head of Airport Stars',
  [UserRole.AIRPORT_MEMBER]: 'Airport Stars · Check-in',
  [UserRole.TELE_HOD]: 'Head of Tele Pastoring',
  [UserRole.TELE_PASTOR]: 'Tele Pastor',
  [UserRole.CHILDREN_HOD]: 'Head of Children’s Church',
  [UserRole.CHILDREN_WORKER]: 'Children’s Church team',
  [UserRole.CAMPUS_HOD]: 'Head of Campuses',
  [UserRole.CAMPUS_LEADER]: 'Campus Leader',
};

const ADMIN_DEPTS: { to: string; label: string; icon: React.ElementType; bg: string; fg: string }[] = [
  { to: '/finance/collections', label: 'Finance', icon: Wallet, bg: '#FCEFD9', fg: '#7A4300' },
  { to: '/bacentas/hod', label: 'Bacentas', icon: Home, bg: '#E3F1D4', fg: '#2F5D10' },
  { to: '/airport-stars/checkin', label: 'Airport Stars', icon: Plane, bg: '#DDEBF7', fg: '#1D4E7A' },
  { to: '/tele-pastoring/absentees', label: 'Tele Pastoring', icon: HeartPulse, bg: '#ECE3F6', fg: '#55307F' },
  { to: '/children/checkin', label: 'Children’s Church', icon: Baby, bg: '#F7DEDF', fg: '#8A2B33' },
  { to: '/campuses/hod', label: 'Campuses', icon: GraduationCap, bg: '#E4E6F7', fg: '#33397F' },
];

const isEnd = (to: string) => to.endsWith('/hod') || to.endsWith('/my-unit');

const today = () =>
  new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const ResponsiveShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const { pathname } = useLocation();

  if (!user) return <>{children}</>;

  const navItems = getNavItemsForRole(user.role).filter(
    (item) => !(user.role === UserRole.PLATFORM_ADMIN && item.to === '/admin/overview' && !tenant)
  );
  // Admin pages opened from More (Subscription, tools) keep the More tab highlighted.
  const moreAlias = (to: string) => to === '/admin/more' && /^\/admin\/(subscription|tools)/.test(pathname);
  // Step-by-step flows take the whole phone screen: no greeting header, no tab bar (desktop keeps the sidebar).
  const focusFlow = /^\/platform\/tenants\/new/.test(pathname);
  const showTabBar = navItems.length > 1 && !focusFlow;
  const deptLabel = DEPT_LABEL[user.role] ?? ROLE_LABELS[user.role];

  const signOut = () => {
    setSwitcherOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-church-canvas text-church-text">
      {/* ── Web: dark sidebar ── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-[248px] flex-col gap-[22px] bg-church-forest text-[#EEF5E9] px-3.5 py-[22px] overflow-y-auto">
        <div className="flex items-center gap-2.5 px-1.5">
          <img src="/logo.jpg" alt="1000 Micro Church Network International" className="w-9 h-9 rounded-full object-cover" />
          <span className="min-w-0 flex flex-col">
            <span className="font-display text-base font-bold text-white">Open Church</span>
            <span className="text-xs text-church-mist truncate">{tenant?.name ?? 'All churches'}</span>
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="px-3.5 pb-1 text-xs font-semibold uppercase tracking-[0.06em] text-[#6F8274]">{deptLabel}</span>
          <nav aria-label="Main" className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={isEnd(item.to)}
                  className={({ isActive: rawActive }) =>
                    `relative flex items-center gap-3 h-11 pl-3.5 pr-3 rounded-[12px] text-sm font-semibold no-underline transition ${
                      (rawActive || moreAlias(item.to)) ? 'bg-white/[0.08] text-white' : 'text-church-mist hover:bg-white/[0.05] hover:text-white'
                    }`
                  }
                >
                  {({ isActive: rawActive }) => (
                    <>
                      {(rawActive || moreAlias(item.to)) && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r bg-church-lime" />}
                      <Icon className={`w-5 h-5 shrink-0 ${(rawActive || moreAlias(item.to)) ? 'text-church-lime' : ''}`} strokeWidth={1.8} />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {user.role === UserRole.ADMIN && (
          <div className="flex flex-col gap-1">
            <span className="px-3.5 pb-1 text-xs font-semibold uppercase tracking-[0.06em] text-[#6F8274]">Departments</span>
            {ADMIN_DEPTS.map((d) => {
              const DIcon = d.icon;
              return (
                <NavLink
                  key={d.to}
                  to={d.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 h-10 pl-3.5 pr-3 rounded-[12px] text-sm font-medium no-underline transition ${
                      isActive ? 'bg-white/[0.08] text-white' : 'text-church-mist hover:bg-white/[0.05] hover:text-white'
                    }`
                  }
                >
                  <span className="w-[26px] h-[26px] rounded-lg flex items-center justify-center" style={{ background: d.bg, color: d.fg }}>
                    <DIcon className="w-[15px] h-[15px]" strokeWidth={1.8} />
                  </span>
                  {d.label}
                </NavLink>
              );
            })}
          </div>
        )}

        <div className="mt-auto flex items-center gap-2.5 p-2.5 rounded-[14px] bg-white/[0.06]">
          <button
            type="button"
            onClick={() => setSwitcherOpen(true)}
            className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
            aria-label="Account and switch account"
          >
            <span className="w-9 h-9 rounded-full bg-church-lime text-church-forest flex items-center justify-center font-display text-[13px] font-bold shrink-0">
              {user.fullName
                .replace(/^(Dr\.|Pastor|Apostle|Rev\.|Sis\.|Bro\.|Elder)\s+/i, '')
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0])
                .join('')
                .toUpperCase()}
            </span>
            <span className="min-w-0 flex flex-col">
              <span className="text-[13px] font-semibold text-white truncate">{user.fullName}</span>
              <span className="text-xs text-church-mist truncate">{SHORT_ROLE[user.role]}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-church-mist hover:text-white hover:bg-white/10"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>
        </div>
      </aside>

      <div className="md:pl-[248px] min-w-0 flex flex-col min-h-screen">
        {/* ── Phone: greeting header ── */}
        <header className={`${focusFlow ? 'hidden' : 'md:hidden'} sticky top-0 z-20 bg-church-canvas/90 backdrop-blur-xl px-5 pt-[max(14px,env(safe-area-inset-top))] pb-2.5 flex flex-wrap items-center gap-3`}>
          <button type="button" onClick={() => setSwitcherOpen(true)} className="flex items-center gap-3 min-w-0 flex-1 text-left" aria-label="Account and switch account">
            <span className="w-10 h-10 rounded-full bg-church-forest text-church-lime flex items-center justify-center font-display text-sm font-bold shrink-0">
              {initials(user.fullName)}
            </span>
            <span className="min-w-0 flex flex-col">
              <span className="text-[15px] font-semibold truncate">{user.fullName}</span>
              <span className="oc-sub truncate">{SHORT_ROLE[user.role]}</span>
            </span>
          </button>
          <button
            type="button"
            aria-label="Notifications"
            className="relative w-11 h-11 rounded-full bg-white flex items-center justify-center shrink-0"
          >
            <Bell className="w-5 h-5" strokeWidth={1.8} />
            <span className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-church-neg ring-2 ring-white" />
          </button>
        </header>

        {/* ── Web: top bar ── */}
        <div className="hidden md:flex items-center justify-between gap-3 px-10 pt-6">
          <span className="text-sm text-church-muted">{today()}</span>
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={() => setSwitcherOpen(true)} className="oc-btn-ghost !h-11 !px-4 !text-sm">
              Switch account
            </button>
            <button type="button" aria-label="Notifications" className="relative w-11 h-11 rounded-[14px] bg-white flex items-center justify-center">
              <Bell className="w-5 h-5" strokeWidth={1.8} />
              <span className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-church-neg ring-2 ring-white" />
            </button>
          </div>
        </div>

        <main className={`flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-5 md:px-10 ${focusFlow ? 'pt-[max(16px,env(safe-area-inset-top))]' : 'pt-2'} md:pt-6 ${showTabBar ? 'pb-32' : 'pb-10'} md:pb-14`}>
          <div className="flex flex-col gap-4 md:gap-6">{children}</div>
        </main>
      </div>

      {/* ── Phone: floating dark tab bar ── */}
      {showTabBar && (
        <nav
          aria-label="Main"
          className="md:hidden fixed z-30 left-3 right-3 bottom-[max(12px,env(safe-area-inset-bottom))] h-[68px] rounded-[26px] bg-church-forest/95 backdrop-blur-xl shadow-[0_18px_40px_-12px_rgba(15,36,24,0.55)] px-1.5 grid items-center"
          style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={isEnd(item.to)}
                className="no-underline flex justify-center"
              >
                {({ isActive: rawActive }) => (
                  <span
                    className={`oc-press flex flex-col items-center justify-center gap-1 h-14 w-full max-w-[84px] rounded-[20px] transition ${
                      (rawActive || moreAlias(item.to)) ? 'bg-church-lime text-church-forest' : 'text-church-mist'
                    }`}
                  >
                    <Icon className="w-[22px] h-[22px]" strokeWidth={1.8} />
                    <span className="text-[11px] font-semibold leading-none truncate max-w-full px-1">{item.shortLabel}</span>
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      )}

      {/* ── Account profile sheet ── */}
      <MobileSheet
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        title="Your account"
        subtitle={tenant ? tenant.name : '1000 Micro Church Network Council'}
      >
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-church-soft">
          <Avatar name={user.fullName} size={46} />
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[15px] font-semibold truncate">{user.fullName}</span>
            <span className="oc-sub truncate">{user.email}</span>
            <span className="text-xs font-semibold text-church-emerald mt-0.5">{SHORT_ROLE[user.role]}</span>
          </span>
        </div>
        <button type="button" onClick={signOut} className="oc-btn w-full bg-church-negSoft text-[#8F1D14]">
          <LogOut className="w-[18px] h-[18px]" /> Sign out
        </button>
      </MobileSheet>
    </div>
  );
};
