import { DepartmentCode, UserRole } from './enums';
import { User } from './types';

export const formatPhoneNumber = (phone: string, defaultPrefix = '+256'): string => {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('0')) return `${defaultPrefix}${cleaned.slice(1)}`;
  return `${defaultPrefix}${cleaned}`;
};

export const formatCurrency = (amount: number, currencyCode = 'UGX'): string => {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: currencyCode === 'UGX' || currencyCode === 'KES' ? 0 : 2,
    }).format(safeAmount);
  } catch {
    return `${currencyCode} ${safeAmount.toLocaleString()}`;
  }
};

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const getWhatsAppLink = (phone: string, message?: string): string => {
  const digits = formatPhoneNumber(phone).replace(/\+/g, '');
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${query}`;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.PLATFORM_ADMIN]: 'Network Council (Super Admin)',
  [UserRole.ADMIN]: 'Church Administration (Overall)',
  [UserRole.FINANCE_HOD]: 'Head of Finance',
  [UserRole.FINANCE_OFFICER]: 'Finance Dept Member',
  [UserRole.BACENTA_HOD]: 'Head of Bacentas',
  [UserRole.BACENTA_LEADER]: 'Bacenta Leader',
  [UserRole.AIRPORT_HOD]: 'Head of Airport Stars',
  [UserRole.AIRPORT_MEMBER]: 'Airport Stars Check-In Member',
  [UserRole.TELE_HOD]: 'Head of Tele Pastoring',
  [UserRole.TELE_PASTOR]: 'Tele Pastor',
  [UserRole.CHILDREN_HOD]: "Head of Children's Church",
  [UserRole.CHILDREN_WORKER]: "Children's Church Worker",
  [UserRole.CAMPUS_HOD]: 'Head of Campuses',
  [UserRole.CAMPUS_LEADER]: 'Campus Leader',
};

export const HOD_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.FINANCE_HOD,
  UserRole.BACENTA_HOD,
  UserRole.AIRPORT_HOD,
  UserRole.TELE_HOD,
  UserRole.CHILDREN_HOD,
  UserRole.CAMPUS_HOD,
];

export const isHodUser = (user: User | null): boolean => {
  if (!user) return false;
  return HOD_ROLES.includes(user.role);
};

export const getDepartmentCodeForRole = (role: UserRole): DepartmentCode | null => {
  switch (role) {
    case UserRole.ADMIN:
      return DepartmentCode.ADMIN;
    case UserRole.FINANCE_HOD:
    case UserRole.FINANCE_OFFICER:
      return DepartmentCode.FINANCE;
    case UserRole.BACENTA_HOD:
    case UserRole.BACENTA_LEADER:
      return DepartmentCode.BACENTA;
    case UserRole.AIRPORT_HOD:
    case UserRole.AIRPORT_MEMBER:
      return DepartmentCode.AIRPORT_STARS;
    case UserRole.TELE_HOD:
    case UserRole.TELE_PASTOR:
      return DepartmentCode.TELE_PASTORING;
    case UserRole.CHILDREN_HOD:
    case UserRole.CHILDREN_WORKER:
      return DepartmentCode.CHILDRENS_CHURCH;
    case UserRole.CAMPUS_HOD:
    case UserRole.CAMPUS_LEADER:
      return DepartmentCode.CAMPUSES;
    default:
      return null;
  }
};

export const getDefaultRouteForUser = (user: User | null): string => {
  if (!user) return '/login';
  switch (user.role) {
    case UserRole.PLATFORM_ADMIN:
      return '/platform/tenants';
    case UserRole.ADMIN:
      return '/admin/overview';
    case UserRole.FINANCE_HOD:
    case UserRole.FINANCE_OFFICER:
      return '/finance/collections';
    case UserRole.BACENTA_HOD:
      return '/bacentas/hod';
    case UserRole.BACENTA_LEADER:
      return '/bacentas/my-unit';
    case UserRole.AIRPORT_HOD:
    case UserRole.AIRPORT_MEMBER:
      return '/airport-stars/checkin';
    case UserRole.TELE_HOD:
    case UserRole.TELE_PASTOR:
      return '/tele-pastoring/absentees';
    case UserRole.CHILDREN_HOD:
    case UserRole.CHILDREN_WORKER:
      return '/children/checkin';
    case UserRole.CAMPUS_HOD:
      return '/campuses/hod';
    case UserRole.CAMPUS_LEADER:
      return '/campuses/my-unit';
    default:
      return '/login';
  }
};

export const getChildAgeGroup = (age: number): string => {
  if (age <= 5) return 'Toddlers (2–5 yrs)';
  if (age <= 9) return 'Champions (6–9 yrs)';
  if (age <= 12) return 'Pre-Teens (10–12 yrs)';
  return 'Teens (13+ yrs)';
};

