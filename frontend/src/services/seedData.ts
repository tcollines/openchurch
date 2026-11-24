import { DepartmentCode, UserRole } from '@/shared/enums';
import {
  AbsenteeFollowup,
  Child,
  ChildAttendance,
  Department,
  DeptContribution,
  FellowshipMeeting,
  FellowshipMeetingAttendance,
  FellowshipOutreach,
  FellowshipUnit,
  FinanceTransaction,
  Member,
  Partner,
  Requisition,
  Service,
  ServiceAttendance,
  ServingMember,
  SoulFollowupWeek,
  SoulWon,
  SubscriptionPayment,
  RequisitionAccountability,
  DiscipleshipClass,
  DiscipleshipEnrollment,
  DiscipleshipAttendance,
  DiscipleshipSettings,
  TeleReachout,
  Tenant,
  User,
  Workplan,
} from '@/shared/types';

export interface OpenChurchDatabase {
  tenants: Tenant[];
  departments: Department[];
  users: User[];
  members: Member[];
  children: Child[];
  servingMembers: ServingMember[];
  services: Service[];
  serviceAttendance: ServiceAttendance[];
  childAttendance: ChildAttendance[];
  partners: Partner[];
  deptContributions: DeptContribution[];
  workplans: Workplan[];
  requisitions: Requisition[];
  financeTransactions: FinanceTransaction[];
  fellowshipUnits: FellowshipUnit[];
  fellowshipMeetings: FellowshipMeeting[];
  fellowshipMeetingAttendance: FellowshipMeetingAttendance[];
  fellowshipOutreaches: FellowshipOutreach[];
  teleReachouts: TeleReachout[];
  absenteeFollowups: AbsenteeFollowup[];
  soulsWon: SoulWon[];
  soulFollowupWeeks: SoulFollowupWeek[];
  subscriptionPayments: SubscriptionPayment[];
  requisitionAccountabilities: RequisitionAccountability[];
  discipleshipClasses: DiscipleshipClass[];
  discipleshipEnrollments: DiscipleshipEnrollment[];
  discipleshipAttendance: DiscipleshipAttendance[];
  discipleshipSettings: DiscipleshipSettings[];
}

export const createDepartmentsForTenant = (tenantId: string): Department[] => [
  {
    id: `${tenantId}-dept-admin`,
    tenantId,
    code: DepartmentCode.ADMIN,
    name: 'Administration',
    description: 'Overall church oversight, attendance %, budgets, finance & serving members',
  },
  {
    id: `${tenantId}-dept-finance`,
    tenantId,
    code: DepartmentCode.FINANCE,
    name: 'Finance Department',
    description: 'Per-service Offertory, Tithe, Partner-linked Partnership & payouts',
  },
  {
    id: `${tenantId}-dept-bacenta`,
    tenantId,
    code: DepartmentCode.BACENTA,
    name: 'Bacenta Ministry',
    description: 'Micro-church home fellowships, outreach reports, attendance & meeting offerings',
  },
  {
    id: `${tenantId}-dept-airport`,
    tenantId,
    code: DepartmentCode.AIRPORT_STARS,
    name: 'Airport Stars',
    description: 'Service creation, rapid member check-in & first-timer registration',
  },
  {
    id: `${tenantId}-dept-tele`,
    tenantId,
    code: DepartmentCode.TELE_PASTORING,
    name: 'Tele Pastoring',
    description: '3-missed-services retention, physical/phone reachouts & 4-week soul care',
  },
  {
    id: `${tenantId}-dept-children`,
    tenantId,
    code: DepartmentCode.CHILDRENS_CHURCH,
    name: "Children's Church",
    description: 'Service check-in, child salvations & 3-missed-services guardian follow-up',
  },
  {
    id: `${tenantId}-dept-campuses`,
    tenantId,
    code: DepartmentCode.CAMPUSES,
    name: 'Campuses Ministry',
    description: 'University & school campus fellowships, outreach reports & offerings',
  },
  {
    id: `${tenantId}-dept-discipleship`,
    tenantId,
    code: DepartmentCode.DISCIPLESHIP,
    name: 'Discipleship',
    description: 'Discipleship classes, member check-in and progress from enrolled to completed',
  },
];

/** Clean production-ready initial store — zero demo churches, members or transactions. */
export const buildInitialSeedDatabase = (): OpenChurchDatabase => ({
  tenants: [],
  departments: [],
  users: [
    {
      id: '1d0f1c01-52a5-4425-be1e-ca924250446d',
      tenantId: null,
      fullName: 'Collines (Network Council)',
      email: 'tcollines004@gmail.com',
      phoneNumber: '+256770000004',
      role: UserRole.PLATFORM_ADMIN,
      departmentId: null,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-11-18T11:43:24.183Z',
    },
  ],
  members: [],
  children: [],
  servingMembers: [],
  services: [],
  serviceAttendance: [],
  childAttendance: [],
  partners: [],
  deptContributions: [],
  workplans: [],
  requisitions: [],
  financeTransactions: [],
  fellowshipUnits: [],
  fellowshipMeetings: [],
  fellowshipMeetingAttendance: [],
  fellowshipOutreaches: [],
  teleReachouts: [],
  absenteeFollowups: [],
  soulsWon: [],
  soulFollowupWeeks: [],
  requisitionAccountabilities: [],
  discipleshipClasses: [],
  discipleshipEnrollments: [],
  discipleshipAttendance: [],
  discipleshipSettings: [],
  subscriptionPayments: [],
});
