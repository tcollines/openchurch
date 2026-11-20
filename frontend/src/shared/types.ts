import {
  AbsenteeStatus,
  DepartmentCode,
  FellowshipUnitType,
  FinanceCategory,
  FinanceScope,
  FinanceType,
  ReachoutMode,
  RequisitionStatus,
  ServiceCategory,
  ServiceStatus,
  SoulSourceType,
  SoulStatus,
  UserRole,
  WorkflowStatus,
} from './enums';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  currency: string;
  city: string;
  country: string;
  status: 'ACTIVE' | 'SUSPENDED';
  subscriptionStatus?: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED';
  monthlyFee?: number; // 50,000 UGX
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  lastPaidAt?: string;
  createdAt: string;
  shortName?: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  launchDate?: string;
  /** Set when the pastor finishes the Get started flow (starts the 7-day trial). */
  setupCompletedAt?: string | null;
}

export interface SubscriptionPayment {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  paymentMethod: 'MTN_MOMO' | 'AIRTEL_MONEY' | 'BANK_TRANSFER' | 'VISA';
  referenceNumber: string;
  phoneOrAccount: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  periodStart: string;
  periodEnd: string;
  recordedBy?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  tenantId: string;
  code: DepartmentCode;
  name: string;
  description: string;
}

export interface User {
  id: string;
  tenantId: string | null;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  departmentId: string | null;
  fellowshipUnitId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Member {
  id: string;
  tenantId: string;
  fullName: string;
  phoneNumber: string;
  gender: 'Male' | 'Female';
  residence: string;
  bacentaId: string | null;
  campusId: string | null;
  isFirstTimer: boolean;
  joinedAt: string;
  isActive: boolean;
  createdAt: string;
}

export interface Child {
  id: string;
  tenantId: string;
  fullName: string;
  age: number;
  ageGroup: string;
  guardianName: string;
  guardianPhone: string;
  parentMemberId: string | null;
  joinedAt: string;
  isActive: boolean;
  createdAt: string;
}

export interface ServingMember {
  id: string;
  tenantId: string;
  departmentId: string;
  memberId: string;
  servingRole: 'HOD' | 'Coordinator' | 'Member';
  userId: string | null;
  joinedDeptAt: string;
}

export interface Service {
  id: string;
  tenantId: string;
  title: string;
  serviceDate: string;
  category: ServiceCategory;
  status: ServiceStatus;
  createdBy: string | null;
  createdAt: string;
}

export interface ServiceAttendance {
  id: string;
  tenantId: string;
  serviceId: string;
  memberId: string;
  isFirstTimeVisit: boolean;
  isServingCheckin: boolean;
  servingDepartmentId: string | null;
  checkedInAt: string;
  checkedInBy: string | null;
}

export interface ChildAttendance {
  id: string;
  tenantId: string;
  serviceId: string;
  childId: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  soulWon: boolean;
  checkedInBy: string | null;
}

export interface Partner {
  id: string;
  tenantId: string;
  memberId: string | null;
  fullName: string;
  phoneNumber: string;
  email: string;
  tierOrPledge: string;
  monthlyPledge: number;
  frequency: 'Weekly' | 'Monthly' | 'Quarterly' | 'One-Time';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface DeptContribution {
  id: string;
  tenantId: string;
  departmentId: string;
  memberId: string;
  amount: number;
  purpose: string;
  paymentMethod: 'Cash' | 'Mobile Money' | 'Bank Transfer';
  referenceCode: string;
  contributionDate: string;
  recordedBy: string | null;
  createdAt: string;
}

export interface WorkplanItem {
  id: string;
  activity: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface Workplan {
  id: string;
  tenantId: string;
  departmentId: string;
  monthLabel: string;
  title: string;
  items: WorkplanItem[];
  totalRequested: number;
  deptContributionAmount: number;
  totalApproved: number;
  status: WorkflowStatus;
  reviewNotes: string;
  submittedBy: string | null;
  createdAt: string;
}

export interface RequisitionLineItem {
  description: string;
  quantity: number;
  unitCost: number;
}

export interface Requisition {
  id: string;
  tenantId: string;
  departmentId: string;
  workplanId: string | null;
  serviceId: string | null;
  requisitionNumber: string;
  title: string;
  items: RequisitionLineItem[];
  totalAmount: number;
  amountPaid: number;
  status: RequisitionStatus;
  rejectionReason: string;
  requestedBy: string | null;
  requestedAt: string;
  createdAt: string;
}

export interface FinanceTransaction {
  id: string;
  tenantId: string;
  type: FinanceType;
  category: FinanceCategory;
  sourceScope: FinanceScope;
  serviceId: string | null;
  departmentId: string | null;
  partnerId: string | null;
  memberId: string | null;
  fellowshipUnitId: string | null;
  requisitionId: string | null;
  amount: number;
  paymentMethod: 'Cash' | 'Mobile Money' | 'Bank Transfer';
  referenceCode: string;
  description: string;
  isVerified: boolean;
  transactionDate: string;
  recordedBy: string | null;
  createdAt: string;
}

export interface FellowshipUnit {
  id: string;
  tenantId: string;
  unitType: FellowshipUnitType;
  name: string;
  locationOrInstitution: string;
  meetingDay: string;
  leaderUserId: string | null;
  leaderName: string;
  leaderPhone: string;
  createdAt: string;
}

export interface FellowshipMeeting {
  id: string;
  tenantId: string;
  unitId: string;
  meetingDate: string;
  title: string;
  labourersCount: number;
  soulsWonCount: number;
  testimony: string;
  titheCollected: number;
  offertoryCollected: number;
  submittedBy: string | null;
  createdAt: string;
}

export interface FellowshipMeetingAttendance {
  id: string;
  tenantId: string;
  meetingId: string;
  memberId: string;
  checkedInAt: string;
}

export interface FellowshipOutreach {
  id: string;
  tenantId: string;
  unitId: string;
  outreachDate: string;
  location: string;
  labourersCount: number;
  soulsWonCount: number;
  testimony: string;
  submittedBy: string | null;
  createdAt: string;
}

export interface TeleReachout {
  id: string;
  tenantId: string;
  memberId: string;
  serviceId: string | null;
  mode: ReachoutMode;
  labourersCount: number | null;
  amountSpent: number;
  comment: string;
  financeTransactionId: string | null;
  reachedBy: string | null;
  reachoutDate: string;
  createdAt: string;
}

export interface AbsenteeFollowup {
  id: string;
  tenantId: string;
  personType: 'ADULT' | 'CHILD';
  memberId: string | null;
  childId: string | null;
  missedServicesCount: number;
  status: AbsenteeStatus;
  comment: string;
  followedBy: string | null;
  updatedAt: string;
}

export interface SoulWon {
  id: string;
  tenantId: string;
  fullName: string;
  phoneNumber: string;
  guardianName: string;
  guardianPhone: string;
  isChild: boolean;
  sourceType: SoulSourceType;
  sourceLabel: string;
  serviceId: string | null;
  fellowshipUnitId: string | null;
  wonDate: string;
  status: SoulStatus;
  notes: string;
  createdAt: string;
}

export interface SoulFollowupWeek {
  id: string;
  tenantId: string;
  soulId: string;
  weekNumber: 1 | 2 | 3 | 4;
  contactMode: ReachoutMode;
  attendedService: boolean;
  comment: string;
  completedBy: string | null;
  completedAt: string;
}

