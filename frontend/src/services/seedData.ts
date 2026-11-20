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
} from '@/shared/enums';
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
];

export const buildInitialSeedDatabase = (): OpenChurchDatabase => {
  const t1 = 't-kampala';
  const t2 = 't-nairobi';

  const tenants: Tenant[] = [
    {
      id: t1,
      name: '1000 Micro Church — Kampala Central',
      slug: 'kampala-central',
      logoUrl: '/logo.jpg',
      currency: 'UGX',
      city: 'Kampala',
      country: 'Uganda',
      status: 'ACTIVE',
      subscriptionStatus: 'TRIALING',
      monthlyFee: 50000,
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: '2026-01-10T08:00:00Z',
    },
    {
      id: t2,
      name: '1000 Micro Church — Nairobi Hub',
      slug: 'nairobi-hub',
      logoUrl: '/logo.jpg',
      currency: 'KES',
      city: 'Nairobi',
      country: 'Kenya',
      status: 'ACTIVE',
      subscriptionStatus: 'ACTIVE',
      monthlyFee: 50000,
      subscriptionEndsAt: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString(),
      lastPaidAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: '2026-03-15T08:00:00Z',
    },
  ];

  const departments: Department[] = [
    ...createDepartmentsForTenant(t1),
    ...createDepartmentsForTenant(t2),
  ];

  const fellowshipUnits: FellowshipUnit[] = [
    {
      id: 'bac-ntinda',
      tenantId: t1,
      unitType: FellowshipUnitType.BACENTA,
      name: 'Ntinda Grace Bacenta',
      locationOrInstitution: 'Ntinda Ministers Village',
      meetingDay: 'Wednesday 6:00 PM',
      leaderUserId: 'u-bac-leader-1',
      leaderName: 'Bro. Samuel Okello',
      leaderPhone: '+256772310401',
      createdAt: '2026-02-01T10:00:00Z',
    },
    {
      id: 'bac-kira',
      tenantId: t1,
      unitType: FellowshipUnitType.BACENTA,
      name: 'Kira Townships Bacenta',
      locationOrInstitution: 'Kira Mulawa Zone',
      meetingDay: 'Thursday 6:30 PM',
      leaderUserId: null,
      leaderName: 'Sis. Esther Namukasa',
      leaderPhone: '+256701882910',
      createdAt: '2026-02-10T10:00:00Z',
    },
    {
      id: 'bac-muyenga',
      tenantId: t1,
      unitType: FellowshipUnitType.BACENTA,
      name: 'Muyenga Hill Bacenta',
      locationOrInstitution: 'Muyenga Tank Hill',
      meetingDay: 'Wednesday 6:30 PM',
      leaderUserId: null,
      leaderName: 'Bro. Ivan Mugisha',
      leaderPhone: '+256782994120',
      createdAt: '2026-03-05T10:00:00Z',
    },
    {
      id: 'camp-muk',
      tenantId: t1,
      unitType: FellowshipUnitType.CAMPUS,
      name: 'Makerere University (MUK) Campus',
      locationOrInstitution: 'Makerere University Main Hall',
      meetingDay: 'Friday 5:00 PM',
      leaderUserId: 'u-camp-leader-1',
      leaderName: 'Bro. Joshua Kato',
      leaderPhone: '+256754112233',
      createdAt: '2026-02-05T10:00:00Z',
    },
    {
      id: 'camp-kyu',
      tenantId: t1,
      unitType: FellowshipUnitType.CAMPUS,
      name: 'Kyambogo University Campus',
      locationOrInstitution: 'Kyambogo CTF Auditorium',
      meetingDay: 'Thursday 5:30 PM',
      leaderUserId: null,
      leaderName: 'Sis. Priscilla Nabirye',
      leaderPhone: '+256776554433',
      createdAt: '2026-02-14T10:00:00Z',
    },
    {
      id: 'bac-westlands',
      tenantId: t2,
      unitType: FellowshipUnitType.BACENTA,
      name: 'Westlands Micro-Church Bacenta',
      locationOrInstitution: 'Westlands, Nairobi',
      meetingDay: 'Wednesday 6:00 PM',
      leaderUserId: null,
      leaderName: 'Bro. Daniel Mwangi',
      leaderPhone: '+254712345678',
      createdAt: '2026-04-01T10:00:00Z',
    },
  ];

  const users: User[] = [
    {
      id: 'u-platform',
      tenantId: null,
      fullName: 'Apostle Grace Overseer',
      email: 'council@openchurch.org',
      phoneNumber: '+256770000001',
      role: UserRole.PLATFORM_ADMIN,
      departmentId: null,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-01T08:00:00Z',
    },
    {
      id: 'u-platform-collines',
      tenantId: null,
      fullName: 'Collines (Network Council)',
      email: 'tcollines004@gmail.com',
      phoneNumber: '+256770000004',
      role: UserRole.PLATFORM_ADMIN,
      departmentId: null,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-01T08:00:00Z',
    },
    {
      id: 'u-admin',
      tenantId: t1,
      fullName: 'Pastor Daniel Ssebuga',
      email: 'admin@kampala.openchurch.org',
      phoneNumber: '+256772100100',
      role: UserRole.ADMIN,
      departmentId: `${t1}-dept-admin`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-10T08:30:00Z',
    },
    {
      id: 'u-fin-hod',
      tenantId: t1,
      fullName: 'Sarah Namubiru',
      email: 'finance.hod@kampala.openchurch.org',
      phoneNumber: '+256772100200',
      role: UserRole.FINANCE_HOD,
      departmentId: `${t1}-dept-finance`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-12T08:30:00Z',
    },
    {
      id: 'u-fin-member',
      tenantId: t1,
      fullName: 'Timothy Kiggundu',
      email: 'finance@kampala.openchurch.org',
      phoneNumber: '+256772100201',
      role: UserRole.FINANCE_OFFICER,
      departmentId: `${t1}-dept-finance`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-12T09:00:00Z',
    },
    {
      id: 'u-bac-hod',
      tenantId: t1,
      fullName: 'Elder Moses Byaruhanga',
      email: 'bacenta.hod@kampala.openchurch.org',
      phoneNumber: '+256772100300',
      role: UserRole.BACENTA_HOD,
      departmentId: `${t1}-dept-bacenta`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-15T08:00:00Z',
    },
    {
      id: 'u-bac-leader-1',
      tenantId: t1,
      fullName: 'Bro. Samuel Okello',
      email: 'ntinda.bacenta@kampala.openchurch.org',
      phoneNumber: '+256772310401',
      role: UserRole.BACENTA_LEADER,
      departmentId: `${t1}-dept-bacenta`,
      fellowshipUnitId: 'bac-ntinda',
      isActive: true,
      createdAt: '2026-02-01T08:00:00Z',
    },
    {
      id: 'u-air-hod',
      tenantId: t1,
      fullName: 'Rebecca Kyomugisha',
      email: 'airport.hod@kampala.openchurch.org',
      phoneNumber: '+256772100400',
      role: UserRole.AIRPORT_HOD,
      departmentId: `${t1}-dept-airport`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-15T09:00:00Z',
    },
    {
      id: 'u-air-member',
      tenantId: t1,
      fullName: 'Brian Wasswa',
      email: 'checkin@kampala.openchurch.org',
      phoneNumber: '+256772100401',
      role: UserRole.AIRPORT_MEMBER,
      departmentId: `${t1}-dept-airport`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-16T09:00:00Z',
    },
    {
      id: 'u-tele-hod',
      tenantId: t1,
      fullName: 'Pastor Ruth Nakato',
      email: 'tele.hod@kampala.openchurch.org',
      phoneNumber: '+256772100500',
      role: UserRole.TELE_HOD,
      departmentId: `${t1}-dept-tele`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-17T09:00:00Z',
    },
    {
      id: 'u-tele-member',
      tenantId: t1,
      fullName: 'Lydia Nansubuga',
      email: 'tele@kampala.openchurch.org',
      phoneNumber: '+256772100501',
      role: UserRole.TELE_PASTOR,
      departmentId: `${t1}-dept-tele`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-17T10:00:00Z',
    },
    {
      id: 'u-child-hod',
      tenantId: t1,
      fullName: 'Martha Asiimwe',
      email: 'children.hod@kampala.openchurch.org',
      phoneNumber: '+256772100600',
      role: UserRole.CHILDREN_HOD,
      departmentId: `${t1}-dept-children`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-18T09:00:00Z',
    },
    {
      id: 'u-child-worker',
      tenantId: t1,
      fullName: 'Joy Babirye',
      email: 'children@kampala.openchurch.org',
      phoneNumber: '+256772100601',
      role: UserRole.CHILDREN_WORKER,
      departmentId: `${t1}-dept-children`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-18T10:00:00Z',
    },
    {
      id: 'u-camp-hod',
      tenantId: t1,
      fullName: 'Pastor Allan Tumwine',
      email: 'campuses.hod@kampala.openchurch.org',
      phoneNumber: '+256772100700',
      role: UserRole.CAMPUS_HOD,
      departmentId: `${t1}-dept-campuses`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-01-20T09:00:00Z',
    },
    {
      id: 'u-camp-leader-1',
      tenantId: t1,
      fullName: 'Bro. Joshua Kato',
      email: 'muk.campus@kampala.openchurch.org',
      phoneNumber: '+256754112233',
      role: UserRole.CAMPUS_LEADER,
      departmentId: `${t1}-dept-campuses`,
      fellowshipUnitId: 'camp-muk',
      isActive: true,
      createdAt: '2026-02-05T09:00:00Z',
    },
    {
      id: 'u-nairobi-admin',
      tenantId: t2,
      fullName: 'Pastor Faith Wanjiku',
      email: 'admin@nairobi.openchurch.org',
      phoneNumber: '+254722111222',
      role: UserRole.ADMIN,
      departmentId: `${t2}-dept-admin`,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: '2026-03-15T09:00:00Z',
    },
  ];

  // 16 Adult Members in Kampala + 3 in Nairobi
  const members: Member[] = [
    { id: 'm1', tenantId: t1, fullName: 'Rebecca Kyomugisha', phoneNumber: '+256772100400', gender: 'Female', residence: 'Ntinda', bacentaId: 'bac-ntinda', campusId: null, isFirstTimer: false, joinedAt: '2026-01-15', isActive: true, createdAt: '2026-01-15T10:00:00Z' },
    { id: 'm2', tenantId: t1, fullName: 'Brian Wasswa', phoneNumber: '+256772100401', gender: 'Male', residence: 'Ntinda', bacentaId: 'bac-ntinda', campusId: null, isFirstTimer: false, joinedAt: '2026-01-16', isActive: true, createdAt: '2026-01-16T10:00:00Z' },
    { id: 'm3', tenantId: t1, fullName: 'Samuel Okello', phoneNumber: '+256772310401', gender: 'Male', residence: 'Ntinda', bacentaId: 'bac-ntinda', campusId: null, isFirstTimer: false, joinedAt: '2026-01-20', isActive: true, createdAt: '2026-01-20T10:00:00Z' },
    { id: 'm4', tenantId: t1, fullName: 'Sarah Namubiru', phoneNumber: '+256772100200', gender: 'Female', residence: 'Kira', bacentaId: 'bac-kira', campusId: null, isFirstTimer: false, joinedAt: '2026-01-12', isActive: true, createdAt: '2026-01-12T10:00:00Z' },
    { id: 'm5', tenantId: t1, fullName: 'Esther Namukasa', phoneNumber: '+256701882910', gender: 'Female', residence: 'Kira', bacentaId: 'bac-kira', campusId: null, isFirstTimer: false, joinedAt: '2026-02-01', isActive: true, createdAt: '2026-02-01T10:00:00Z' },
    { id: 'm6', tenantId: t1, fullName: 'Ivan Mugisha', phoneNumber: '+256782994120', gender: 'Male', residence: 'Muyenga', bacentaId: 'bac-muyenga', campusId: null, isFirstTimer: false, joinedAt: '2026-02-05', isActive: true, createdAt: '2026-02-05T10:00:00Z' },
    { id: 'm7', tenantId: t1, fullName: 'Joshua Kato', phoneNumber: '+256754112233', gender: 'Male', residence: 'Wandegeya', bacentaId: null, campusId: 'camp-muk', isFirstTimer: false, joinedAt: '2026-02-05', isActive: true, createdAt: '2026-02-05T10:00:00Z' },
    { id: 'm8', tenantId: t1, fullName: 'Priscilla Nabirye', phoneNumber: '+256776554433', gender: 'Female', residence: 'Banda', bacentaId: null, campusId: 'camp-kyu', isFirstTimer: false, joinedAt: '2026-02-14', isActive: true, createdAt: '2026-02-14T10:00:00Z' },
    { id: 'm9', tenantId: t1, fullName: 'Dr. Patrick Otim', phoneNumber: '+256772900111', gender: 'Male', residence: 'Kololo', bacentaId: 'bac-ntinda', campusId: null, isFirstTimer: false, joinedAt: '2026-02-18', isActive: true, createdAt: '2026-02-18T10:00:00Z' },
    { id: 'm10', tenantId: t1, fullName: 'Grace Atwine', phoneNumber: '+256704223344', gender: 'Female', residence: 'Muyenga', bacentaId: 'bac-muyenga', campusId: null, isFirstTimer: false, joinedAt: '2026-03-01', isActive: true, createdAt: '2026-03-01T10:00:00Z' },
    { id: 'm11', tenantId: t1, fullName: 'Kevin Ssempijja', phoneNumber: '+256759887766', gender: 'Male', residence: 'Makerere Kikoni', bacentaId: null, campusId: 'camp-muk', isFirstTimer: false, joinedAt: '2026-03-10', isActive: true, createdAt: '2026-03-10T10:00:00Z' },
    { id: 'm12', tenantId: t1, fullName: 'Martha Asiimwe', phoneNumber: '+256772100600', gender: 'Female', residence: 'Bukoto', bacentaId: 'bac-ntinda', campusId: null, isFirstTimer: false, joinedAt: '2026-01-18', isActive: true, createdAt: '2026-01-18T10:00:00Z' },
    { id: 'm13', tenantId: t1, fullName: 'Ruth Nakato', phoneNumber: '+256772100500', gender: 'Female', residence: 'Naguru', bacentaId: 'bac-ntinda', campusId: null, isFirstTimer: false, joinedAt: '2026-01-17', isActive: true, createdAt: '2026-01-17T10:00:00Z' },
    // 3 Members who intentionally missed the last 3 consecutive services (m14, m15, m16) for Tele-Pastoring!
    { id: 'm14', tenantId: t1, fullName: 'Peter Lubega', phoneNumber: '+256773445566', gender: 'Male', residence: 'Kisaasi', bacentaId: 'bac-kira', campusId: null, isFirstTimer: false, joinedAt: '2026-04-01', isActive: true, createdAt: '2026-04-01T10:00:00Z' },
    { id: 'm15', tenantId: t1, fullName: 'ritah Nankya'.replace(/^r/, 'R'), phoneNumber: '+256702998877', gender: 'Female', residence: 'Najjera', bacentaId: 'bac-kira', campusId: null, isFirstTimer: false, joinedAt: '2026-04-12', isActive: true, createdAt: '2026-04-12T10:00:00Z' },
    { id: 'm16', tenantId: t1, fullName: 'Denis Kalyango', phoneNumber: '+256784123987', gender: 'Male', residence: 'Makerere', bacentaId: null, campusId: 'camp-muk', isFirstTimer: false, joinedAt: '2026-05-01', isActive: true, createdAt: '2026-05-01T10:00:00Z' },
    // Nairobi Tenant Members
    { id: 'm-nb-1', tenantId: t2, fullName: 'Daniel Mwangi', phoneNumber: '+254712345678', gender: 'Male', residence: 'Westlands', bacentaId: 'bac-westlands', campusId: null, isFirstTimer: false, joinedAt: '2026-03-20', isActive: true, createdAt: '2026-03-20T10:00:00Z' },
    { id: 'm-nb-2', tenantId: t2, fullName: 'Mercy Achieng', phoneNumber: '+254723987654', gender: 'Female', residence: 'Kilimani', bacentaId: 'bac-westlands', campusId: null, isFirstTimer: false, joinedAt: '2026-03-22', isActive: true, createdAt: '2026-03-22T10:00:00Z' },
  ];

  const children: Child[] = [
    { id: 'c1', tenantId: t1, fullName: 'Ethan Okello', age: 8, ageGroup: 'Champions (6–9 yrs)', guardianName: 'Samuel Okello', guardianPhone: '+256772310401', parentMemberId: 'm3', joinedAt: '2026-02-01', isActive: true, createdAt: '2026-02-01T10:00:00Z' },
    { id: 'c2', tenantId: t1, fullName: 'Abigail Otim', age: 11, ageGroup: 'Pre-Teens (10–12 yrs)', guardianName: 'Dr. Patrick Otim', guardianPhone: '+256772900111', parentMemberId: 'm9', joinedAt: '2026-02-20', isActive: true, createdAt: '2026-02-20T10:00:00Z' },
    { id: 'c3', tenantId: t1, fullName: 'Zion Namukasa', age: 5, ageGroup: 'Toddlers (2–5 yrs)', guardianName: 'Esther Namukasa', guardianPhone: '+256701882910', parentMemberId: 'm5', joinedAt: '2026-03-01', isActive: true, createdAt: '2026-03-01T10:00:00Z' },
    // 2 Children who missed last 3 consecutive services (c4, c5)
    { id: 'c4', tenantId: t1, fullName: 'Micah Lubega', age: 9, ageGroup: 'Champions (6–9 yrs)', guardianName: 'Peter Lubega', guardianPhone: '+256773445566', parentMemberId: 'm14', joinedAt: '2026-04-05', isActive: true, createdAt: '2026-04-05T10:00:00Z' },
    { id: 'c5', tenantId: t1, fullName: 'Hannah Nankya', age: 7, ageGroup: 'Champions (6–9 yrs)', guardianName: 'Ritah Nankya', guardianPhone: '+256702998877', parentMemberId: 'm15', joinedAt: '2026-04-12', isActive: true, createdAt: '2026-04-12T10:00:00Z' },
  ];

  const servingMembers: ServingMember[] = [
    { id: 'sm1', tenantId: t1, departmentId: `${t1}-dept-airport`, memberId: 'm1', servingRole: 'HOD', userId: 'u-air-hod', joinedDeptAt: '2026-01-15' },
    { id: 'sm2', tenantId: t1, departmentId: `${t1}-dept-airport`, memberId: 'm2', servingRole: 'Member', userId: 'u-air-member', joinedDeptAt: '2026-01-16' },
    { id: 'sm3', tenantId: t1, departmentId: `${t1}-dept-finance`, memberId: 'm4', servingRole: 'HOD', userId: 'u-fin-hod', joinedDeptAt: '2026-01-12' },
    { id: 'sm4', tenantId: t1, departmentId: `${t1}-dept-bacenta`, memberId: 'm3', servingRole: 'Coordinator', userId: 'u-bac-leader-1', joinedDeptAt: '2026-02-01' },
    { id: 'sm5', tenantId: t1, departmentId: `${t1}-dept-tele`, memberId: 'm13', servingRole: 'HOD', userId: 'u-tele-hod', joinedDeptAt: '2026-01-17' },
    { id: 'sm6', tenantId: t1, departmentId: `${t1}-dept-children`, memberId: 'm12', servingRole: 'HOD', userId: 'u-child-hod', joinedDeptAt: '2026-01-18' },
    { id: 'sm7', tenantId: t1, departmentId: `${t1}-dept-campuses`, memberId: 'm7', servingRole: 'Coordinator', userId: 'u-camp-leader-1', joinedDeptAt: '2026-02-05' },
  ];

  // 5 Services for Kampala so Attendance % Graph and 3-Missed-Services engine have rich history
  const services: Service[] = [
    { id: 'srv-1', tenantId: t1, title: 'Sunday Covenant Service', serviceDate: '2026-10-25', category: ServiceCategory.SUNDAY, status: ServiceStatus.CLOSED, createdBy: 'u-air-hod', createdAt: '2026-10-25T07:00:00Z' },
    { id: 'srv-2', tenantId: t1, title: 'Sunday Harvest Celebration', serviceDate: '2026-11-01', category: ServiceCategory.SUNDAY, status: ServiceStatus.CLOSED, createdBy: 'u-air-hod', createdAt: '2026-11-01T07:00:00Z' },
    { id: 'srv-3', tenantId: t1, title: 'Midweek Word Encounter', serviceDate: '2026-11-05', category: ServiceCategory.MIDWEEK, status: ServiceStatus.CLOSED, createdBy: 'u-air-hod', createdAt: '2026-11-05T16:30:00Z' },
    { id: 'srv-4', tenantId: t1, title: 'Sunday Glory Service', serviceDate: '2026-11-08', category: ServiceCategory.SUNDAY, status: ServiceStatus.CLOSED, createdBy: 'u-air-hod', createdAt: '2026-11-08T07:00:00Z' },
    { id: 'srv-5', tenantId: t1, title: 'Sunday Micro-Church Rally', serviceDate: '2026-11-15', category: ServiceCategory.SUNDAY, status: ServiceStatus.OPEN, createdBy: 'u-air-hod', createdAt: '2026-11-15T07:00:00Z' },
    { id: 'srv-nb-1', tenantId: t2, title: 'Sunday Worship Gathering', serviceDate: '2026-11-15', category: ServiceCategory.SUNDAY, status: ServiceStatus.OPEN, createdBy: 'u-nairobi-admin', createdAt: '2026-11-15T07:00:00Z' },
  ];

  const makeAtt = (serviceId: string, memberIds: string[], servingIds: string[] = []): ServiceAttendance[] =>
    memberIds.map((mId, i) => ({
      id: `att-${serviceId}-${mId}`,
      tenantId: t1,
      serviceId,
      memberId: mId,
      isFirstTimeVisit: false,
      isServingCheckin: servingIds.includes(mId),
      servingDepartmentId: servingIds.includes(mId) ? `${t1}-dept-airport` : null,
      checkedInAt: `2026-11-15T08:${String(10 + i).padStart(2, '0')}:00Z`,
      checkedInBy: 'u-air-member',
    }));

  // Notice m14, m15, m16 attended srv-1 & srv-2, then missed srv-3, srv-4, srv-5 (3 consecutive missed services!)
  const serviceAttendance: ServiceAttendance[] = [
    ...makeAtt('srv-1', ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm9', 'm12', 'm13', 'm14', 'm15'], ['m1', 'm2']),
    ...makeAtt('srv-2', ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm12', 'm14', 'm16'], ['m1', 'm2']),
    ...makeAtt('srv-3', ['m1', 'm2', 'm3', 'm4', 'm7', 'm8', 'm9', 'm11', 'm12', 'm13'], ['m1', 'm2']),
    ...makeAtt('srv-4', ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12', 'm13'], ['m1', 'm2']),
    ...makeAtt('srv-5', ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm12', 'm13'], ['m1', 'm2']),
    {
      id: 'att-nb-1',
      tenantId: t2,
      serviceId: 'srv-nb-1',
      memberId: 'm-nb-1',
      isFirstTimeVisit: false,
      isServingCheckin: false,
      servingDepartmentId: null,
      checkedInAt: '2026-11-15T08:15:00Z',
      checkedInBy: 'u-nairobi-admin',
    },
  ];

  // Notice c4 & c5 missed srv-3, srv-4, srv-5 (3 consecutive services without attending!)
  const childAttendance: ChildAttendance[] = [
    { id: 'ca-1', tenantId: t1, serviceId: 'srv-1', childId: 'c1', checkedInAt: '2026-10-25T08:30:00Z', checkedOutAt: '2026-10-25T11:45:00Z', soulWon: false, checkedInBy: 'u-child-worker' },
    { id: 'ca-2', tenantId: t1, serviceId: 'srv-1', childId: 'c4', checkedInAt: '2026-10-25T08:35:00Z', checkedOutAt: '2026-10-25T11:45:00Z', soulWon: false, checkedInBy: 'u-child-worker' },
    { id: 'ca-3', tenantId: t1, serviceId: 'srv-2', childId: 'c1', checkedInAt: '2026-11-01T08:30:00Z', checkedOutAt: '2026-11-01T11:50:00Z', soulWon: false, checkedInBy: 'u-child-worker' },
    { id: 'ca-4', tenantId: t1, serviceId: 'srv-2', childId: 'c2', checkedInAt: '2026-11-01T08:40:00Z', checkedOutAt: '2026-11-01T11:50:00Z', soulWon: true, checkedInBy: 'u-child-worker' },
    { id: 'ca-5', tenantId: t1, serviceId: 'srv-3', childId: 'c1', checkedInAt: '2026-11-05T17:10:00Z', checkedOutAt: '2026-11-05T19:30:00Z', soulWon: false, checkedInBy: 'u-child-worker' },
    { id: 'ca-6', tenantId: t1, serviceId: 'srv-4', childId: 'c1', checkedInAt: '2026-11-08T08:25:00Z', checkedOutAt: '2026-11-08T11:45:00Z', soulWon: false, checkedInBy: 'u-child-worker' },
    { id: 'ca-7', tenantId: t1, serviceId: 'srv-4', childId: 'c2', checkedInAt: '2026-11-08T08:30:00Z', checkedOutAt: '2026-11-08T11:45:00Z', soulWon: false, checkedInBy: 'u-child-worker' },
    { id: 'ca-8', tenantId: t1, serviceId: 'srv-4', childId: 'c3', checkedInAt: '2026-11-08T08:42:00Z', checkedOutAt: '2026-11-08T11:45:00Z', soulWon: false, checkedInBy: 'u-child-worker' },
    { id: 'ca-9', tenantId: t1, serviceId: 'srv-5', childId: 'c1', checkedInAt: '2026-11-15T08:20:00Z', checkedOutAt: null, soulWon: false, checkedInBy: 'u-child-worker' },
    { id: 'ca-10', tenantId: t1, serviceId: 'srv-5', childId: 'c2', checkedInAt: '2026-11-15T08:28:00Z', checkedOutAt: null, soulWon: false, checkedInBy: 'u-child-worker' },
  ];

  const partners: Partner[] = [
    { id: 'p1', tenantId: t1, memberId: 'm9', fullName: 'Dr. Patrick Otim', phoneNumber: '+256772900111', email: 'patrick.otim@med.ug', tierOrPledge: 'Gold Church Planter', monthlyPledge: 1500000, frequency: 'Monthly', status: 'ACTIVE', createdAt: '2026-02-20T10:00:00Z' },
    { id: 'p2', tenantId: t1, memberId: 'm4', fullName: 'Sarah Namubiru', phoneNumber: '+256772100200', email: 'sarah.n@openchurch.org', tierOrPledge: 'Silver Kingdom Partner', monthlyPledge: 500000, frequency: 'Monthly', status: 'ACTIVE', createdAt: '2026-02-25T10:00:00Z' },
    { id: 'p3', tenantId: t1, memberId: 'm6', fullName: 'Ivan Mugisha', phoneNumber: '+256782994120', email: 'ivan.mugisha@tech.ug', tierOrPledge: 'Micro-Church Builder', monthlyPledge: 750000, frequency: 'Monthly', status: 'ACTIVE', createdAt: '2026-03-10T10:00:00Z' },
  ];

  const deptContributions: DeptContribution[] = [
    { id: 'dc-1', tenantId: t1, departmentId: `${t1}-dept-airport`, memberId: 'm1', amount: 120000, purpose: 'Airport Stars Welcome Badges & Umbrellas', paymentMethod: 'Mobile Money', referenceCode: 'MM90812', contributionDate: '2026-11-03', recordedBy: 'u-air-hod', createdAt: '2026-11-03T10:00:00Z' },
    { id: 'dc-2', tenantId: t1, departmentId: `${t1}-dept-tele`, memberId: 'm13', amount: 85000, purpose: 'Tele-Pastoring Airtime Pool', paymentMethod: 'Mobile Money', referenceCode: 'MM99201', contributionDate: '2026-11-09', recordedBy: 'u-tele-hod', createdAt: '2026-11-09T10:00:00Z' },
  ];

  const workplans: Workplan[] = [
    {
      id: 'wp-1',
      tenantId: t1,
      departmentId: `${t1}-dept-airport`,
      monthLabel: '2026-11',
      title: 'November First-Timer Hospitality & Check-In Tablets',
      items: [
        { id: 'wpi-1', activity: 'First-Timer Refreshments', itemName: 'Juice & Water Packs (4 Sundays)', quantity: 4, unitCost: 85000, totalCost: 340000 },
        { id: 'wpi-2', activity: 'Check-In Desk Connectivity', itemName: '4G Router Monthly Bundle', quantity: 1, unitCost: 110000, totalCost: 110000 },
      ],
      totalRequested: 450000,
      deptContributionAmount: 120000,
      totalApproved: 330000,
      status: WorkflowStatus.APPROVED,
      reviewNotes: 'Approved by Administration. Thank you for the 120k dept contribution.',
      submittedBy: 'u-air-hod',
      createdAt: '2026-11-01T09:00:00Z',
    },
    {
      id: 'wp-2',
      tenantId: t1,
      departmentId: `${t1}-dept-bacenta`,
      monthLabel: '2026-11',
      title: 'November Street Evangelism & Micro-Church Launch',
      items: [
        { id: 'wpi-3', activity: 'Ntinda & Kira Megaphone Evangelism', itemName: 'Portable Megaphones & Flyers', quantity: 2, unitCost: 220000, totalCost: 440000 },
        { id: 'wpi-4', activity: 'Bacenta Leaders Training', itemName: 'Training Manuals & Tea', quantity: 20, unitCost: 15000, totalCost: 300000 },
      ],
      totalRequested: 740000,
      deptContributionAmount: 0,
      totalApproved: 0,
      status: WorkflowStatus.SUBMITTED,
      reviewNotes: '',
      submittedBy: 'u-bac-hod',
      createdAt: '2026-11-10T11:00:00Z',
    },
  ];

  const requisitions: Requisition[] = [
    {
      id: 'req-1',
      tenantId: t1,
      departmentId: `${t1}-dept-airport`,
      workplanId: 'wp-1',
      serviceId: 'srv-4',
      requisitionNumber: 'REQ-1001',
      title: 'First-Timer Refreshments & Router Bundle',
      items: [
        { description: 'Sunday Hospitality Packs', quantity: 2, unitCost: 85000 },
        { description: '4G Check-in Data Bundle', quantity: 1, unitCost: 110000 },
      ],
      totalAmount: 280000,
      amountPaid: 280000,
      status: RequisitionStatus.PAID,
      rejectionReason: '',
      requestedBy: 'u-air-hod',
      requestedAt: '2026-11-06',
      createdAt: '2026-11-06T09:00:00Z',
    },
    {
      id: 'req-2',
      tenantId: t1,
      departmentId: `${t1}-dept-children`,
      workplanId: null,
      serviceId: 'srv-5',
      requisitionNumber: 'REQ-1002',
      title: "Children's Church Craft & Bible Colouring Books",
      items: [
        { description: 'Illustrated Bible Workbooks', quantity: 30, unitCost: 8000 },
        { description: 'Crayons & Safety Name Stickers', quantity: 5, unitCost: 24000 },
      ],
      totalAmount: 360000,
      amountPaid: 0,
      status: RequisitionStatus.PENDING_ADMIN,
      rejectionReason: '',
      requestedBy: 'u-child-hod',
      requestedAt: '2026-11-14',
      createdAt: '2026-11-14T14:00:00Z',
    },
  ];

  const fellowshipMeetings: FellowshipMeeting[] = [
    {
      id: 'fm-1',
      tenantId: t1,
      unitId: 'bac-ntinda',
      meetingDate: '2026-11-11',
      title: 'Wednesday Home Cell — Power of Prayer',
      labourersCount: 4,
      soulsWonCount: 2,
      testimony: 'Sis. Rebecca prayed for a neighbour who had migraines for 3 weeks and she was instantly healed!',
      titheCollected: 150000,
      offertoryCollected: 95000,
      submittedBy: 'u-bac-leader-1',
      createdAt: '2026-11-11T20:00:00Z',
    },
    {
      id: 'fm-2',
      tenantId: t1,
      unitId: 'camp-muk',
      meetingDate: '2026-11-13',
      title: 'MUK Friday Campus Fellowship',
      labourersCount: 6,
      soulsWonCount: 3,
      testimony: 'Three first-year engineering students gave their lives to Christ during worship.',
      titheCollected: 80000,
      offertoryCollected: 115000,
      submittedBy: 'u-camp-leader-1',
      createdAt: '2026-11-13T19:30:00Z',
    },
  ];

  const fellowshipMeetingAttendance: FellowshipMeetingAttendance[] = [
    { id: 'fma-1', tenantId: t1, meetingId: 'fm-1', memberId: 'm1', checkedInAt: '2026-11-11T18:10:00Z' },
    { id: 'fma-2', tenantId: t1, meetingId: 'fm-1', memberId: 'm2', checkedInAt: '2026-11-11T18:12:00Z' },
    { id: 'fma-3', tenantId: t1, meetingId: 'fm-1', memberId: 'm3', checkedInAt: '2026-11-11T18:00:00Z' },
    { id: 'fma-4', tenantId: t1, meetingId: 'fm-1', memberId: 'm9', checkedInAt: '2026-11-11T18:20:00Z' },
    { id: 'fma-5', tenantId: t1, meetingId: 'fm-2', memberId: 'm7', checkedInAt: '2026-11-13T17:05:00Z' },
    { id: 'fma-6', tenantId: t1, meetingId: 'fm-2', memberId: 'm11', checkedInAt: '2026-11-13T17:15:00Z' },
  ];

  const fellowshipOutreaches: FellowshipOutreach[] = [
    {
      id: 'fo-1',
      tenantId: t1,
      unitId: 'bac-ntinda',
      outreachDate: '2026-11-14',
      location: 'Ntinda Trading Centre Door-to-Door',
      labourersCount: 7,
      soulsWonCount: 5,
      testimony: 'Five shopkeepers prayed the prayer of salvation and two attended Sunday Micro-Church Rally!',
      submittedBy: 'u-bac-leader-1',
      createdAt: '2026-11-14T18:00:00Z',
    },
    {
      id: 'fo-2',
      tenantId: t1,
      unitId: 'camp-muk',
      outreachDate: '2026-11-14',
      location: 'Livingstone & Mary Stuart Hostels Evangelism',
      labourersCount: 9,
      soulsWonCount: 6,
      testimony: 'Students welcomed us into hostel rooms; 6 souls won and plugged into Friday fellowship.',
      submittedBy: 'u-camp-leader-1',
      createdAt: '2026-11-14T19:00:00Z',
    },
  ];

  const financeTransactions: FinanceTransaction[] = [
    // Service 4 Collections
    { id: 'ft-1', tenantId: t1, type: FinanceType.INCOME, category: FinanceCategory.OFFERTORY, sourceScope: FinanceScope.SERVICE, serviceId: 'srv-4', departmentId: `${t1}-dept-finance`, partnerId: null, memberId: null, fellowshipUnitId: null, requisitionId: null, amount: 1450000, paymentMethod: 'Cash', referenceCode: 'OFF-SRV4', description: 'Sunday Glory Service Offertory', isVerified: true, transactionDate: '2026-11-08', recordedBy: 'u-fin-hod', createdAt: '2026-11-08T13:00:00Z' },
    { id: 'ft-2', tenantId: t1, type: FinanceType.INCOME, category: FinanceCategory.TITHE, sourceScope: FinanceScope.SERVICE, serviceId: 'srv-4', departmentId: `${t1}-dept-finance`, partnerId: null, memberId: 'm9', fellowshipUnitId: null, requisitionId: null, amount: 980000, paymentMethod: 'Mobile Money', referenceCode: 'MM-TITHE-44', description: 'Sunday Tithes Collection', isVerified: true, transactionDate: '2026-11-08', recordedBy: 'u-fin-hod', createdAt: '2026-11-08T13:05:00Z' },
    { id: 'ft-3', tenantId: t1, type: FinanceType.INCOME, category: FinanceCategory.PARTNERSHIP, sourceScope: FinanceScope.SERVICE, serviceId: 'srv-4', departmentId: `${t1}-dept-finance`, partnerId: 'p1', memberId: 'm9', fellowshipUnitId: null, requisitionId: null, amount: 1500000, paymentMethod: 'Bank Transfer', referenceCode: 'BNK-OTIM-11', description: 'Partnership — Dr. Patrick Otim', isVerified: true, transactionDate: '2026-11-08', recordedBy: 'u-fin-hod', createdAt: '2026-11-08T13:10:00Z' },
    // Service 5 Collections
    { id: 'ft-4', tenantId: t1, type: FinanceType.INCOME, category: FinanceCategory.OFFERTORY, sourceScope: FinanceScope.SERVICE, serviceId: 'srv-5', departmentId: `${t1}-dept-finance`, partnerId: null, memberId: null, fellowshipUnitId: null, requisitionId: null, amount: 1680000, paymentMethod: 'Cash', referenceCode: 'OFF-SRV5', description: 'Sunday Micro-Church Rally Offertory', isVerified: true, transactionDate: '2026-11-15', recordedBy: 'u-fin-hod', createdAt: '2026-11-15T13:00:00Z' },
    { id: 'ft-5', tenantId: t1, type: FinanceType.INCOME, category: FinanceCategory.TITHE, sourceScope: FinanceScope.SERVICE, serviceId: 'srv-5', departmentId: `${t1}-dept-finance`, partnerId: null, memberId: 'm4', fellowshipUnitId: null, requisitionId: null, amount: 1120000, paymentMethod: 'Mobile Money', referenceCode: 'MM-TITHE-81', description: 'Sunday Tithes Collection', isVerified: true, transactionDate: '2026-11-15', recordedBy: 'u-fin-hod', createdAt: '2026-11-15T13:10:00Z' },
    { id: 'ft-6', tenantId: t1, type: FinanceType.INCOME, category: FinanceCategory.PARTNERSHIP, sourceScope: FinanceScope.SERVICE, serviceId: 'srv-5', departmentId: `${t1}-dept-finance`, partnerId: 'p2', memberId: 'm4', fellowshipUnitId: null, requisitionId: null, amount: 500000, paymentMethod: 'Mobile Money', referenceCode: 'MM-PART-502', description: 'Partnership — Sarah Namubiru', isVerified: true, transactionDate: '2026-11-15', recordedBy: 'u-fin-hod', createdAt: '2026-11-15T13:15:00Z' },
    { id: 'ft-7', tenantId: t1, type: FinanceType.INCOME, category: FinanceCategory.PARTNERSHIP, sourceScope: FinanceScope.SERVICE, serviceId: 'srv-5', departmentId: `${t1}-dept-finance`, partnerId: 'p3', memberId: 'm6', fellowshipUnitId: null, requisitionId: null, amount: 750000, paymentMethod: 'Mobile Money', referenceCode: 'MM-PART-509', description: 'Partnership — Ivan Mugisha', isVerified: true, transactionDate: '2026-11-15', recordedBy: 'u-fin-hod', createdAt: '2026-11-15T13:18:00Z' },
    // Bacenta & Campus Meeting Remittances
    { id: 'ft-8', tenantId: t1, type: FinanceType.INCOME, category: FinanceCategory.TITHE, sourceScope: FinanceScope.BACENTA_MEETING, serviceId: null, departmentId: `${t1}-dept-bacenta`, partnerId: null, memberId: null, fellowshipUnitId: 'bac-ntinda', requisitionId: null, amount: 150000, paymentMethod: 'Mobile Money', referenceCode: 'BAC-NT-T1', description: 'Ntinda Grace Bacenta Meeting Tithes', isVerified: true, transactionDate: '2026-11-11', recordedBy: 'u-bac-leader-1', createdAt: '2026-11-11T20:05:00Z' },
    { id: 'ft-9', tenantId: t1, type: FinanceType.INCOME, category: FinanceCategory.OFFERTORY, sourceScope: FinanceScope.BACENTA_MEETING, serviceId: null, departmentId: `${t1}-dept-bacenta`, partnerId: null, memberId: null, fellowshipUnitId: 'bac-ntinda', requisitionId: null, amount: 95000, paymentMethod: 'Cash', referenceCode: 'BAC-NT-O1', description: 'Ntinda Grace Bacenta Meeting Offertory', isVerified: true, transactionDate: '2026-11-11', recordedBy: 'u-bac-leader-1', createdAt: '2026-11-11T20:06:00Z' },
    { id: 'ft-10', tenantId: t1, type: FinanceType.INCOME, category: FinanceCategory.OFFERTORY, sourceScope: FinanceScope.CAMPUS_MEETING, serviceId: null, departmentId: `${t1}-dept-campuses`, partnerId: null, memberId: null, fellowshipUnitId: 'camp-muk', requisitionId: null, amount: 115000, paymentMethod: 'Mobile Money', referenceCode: 'CMP-MUK-O1', description: 'MUK Campus Fellowship Offertory', isVerified: true, transactionDate: '2026-11-13', recordedBy: 'u-camp-leader-1', createdAt: '2026-11-13T19:35:00Z' },
    // Expenses (Paid Requisition + Tele-Pastoring Visit Spend)
    { id: 'ft-11', tenantId: t1, type: FinanceType.EXPENSE, category: FinanceCategory.REQUISITION_PAYOUT, sourceScope: FinanceScope.SERVICE, serviceId: 'srv-4', departmentId: `${t1}-dept-airport`, partnerId: null, memberId: null, fellowshipUnitId: null, requisitionId: 'req-1', amount: 280000, paymentMethod: 'Mobile Money', referenceCode: 'PAY-REQ-1001', description: 'Payout: REQ-1001 First-Timer Refreshments & Router', isVerified: true, transactionDate: '2026-11-07', recordedBy: 'u-fin-hod', createdAt: '2026-11-07T15:00:00Z' },
    { id: 'ft-12', tenantId: t1, type: FinanceType.EXPENSE, category: FinanceCategory.TELE_REACHOUT_EXPENSE, sourceScope: FinanceScope.DEPARTMENT, serviceId: 'srv-5', departmentId: `${t1}-dept-tele`, partnerId: null, memberId: 'm10', fellowshipUnitId: null, requisitionId: null, amount: 65000, paymentMethod: 'Cash', referenceCode: 'TR-VIS-01', description: 'Tele-Pastoring Physical Visit — Grace Atwine (Transport & Fruit)', isVerified: true, transactionDate: '2026-11-12', recordedBy: 'u-tele-hod', createdAt: '2026-11-12T16:00:00Z' },
  ];

  const teleReachouts: TeleReachout[] = [
    {
      id: 'tr-1',
      tenantId: t1,
      memberId: 'm10',
      serviceId: 'srv-5',
      mode: ReachoutMode.PHYSICAL_VISIT,
      labourersCount: 3,
      amountSpent: 65000,
      comment: 'Visited Sis. Grace at home in Muyenga after hospital discharge; prayed together and brought groceries.',
      financeTransactionId: 'ft-12',
      reachedBy: 'u-tele-hod',
      reachoutDate: '2026-11-12',
      createdAt: '2026-11-12T16:00:00Z',
    },
    {
      id: 'tr-2',
      tenantId: t1,
      memberId: 'm11',
      serviceId: 'srv-5',
      mode: ReachoutMode.PHONE_CALL,
      labourersCount: null,
      amountSpent: 15000,
      comment: 'Called Bro. Kevin during exam week; sent 15k mobile data support for online midweek stream.',
      financeTransactionId: null,
      reachedBy: 'u-tele-member',
      reachoutDate: '2026-11-14',
      createdAt: '2026-11-14T11:30:00Z',
    },
  ];

  const absenteeFollowups: AbsenteeFollowup[] = [
    {
      id: 'af-1',
      tenantId: t1,
      personType: 'ADULT',
      memberId: 'm16',
      childId: null,
      missedServicesCount: 3,
      status: AbsenteeStatus.CONTACTED,
      comment: 'Spoke to Denis on phone — he travelled upcountry for internship and returns next Sunday.',
      followedBy: 'u-tele-member',
      updatedAt: '2026-11-16T10:00:00Z',
    },
  ];

  const soulsWon: SoulWon[] = [
    {
      id: 'sw-1',
      tenantId: t1,
      fullName: 'Ronald Mugerwa',
      phoneNumber: '+256778334455',
      guardianName: '',
      guardianPhone: '',
      isChild: false,
      sourceType: SoulSourceType.BACENTA_OUTREACH,
      sourceLabel: 'Ntinda Grace Bacenta Outreach',
      serviceId: null,
      fellowshipUnitId: 'bac-ntinda',
      wonDate: '2026-11-14',
      status: SoulStatus.WEEK_1,
      notes: 'Shopkeeper in Ntinda; eager to join foundation class.',
      createdAt: '2026-11-14T18:10:00Z',
    },
    {
      id: 'sw-2',
      tenantId: t1,
      fullName: ' Brenda Kobusingye'.trim(),
      phoneNumber: '+256706778899',
      guardianName: '',
      guardianPhone: '',
      isChild: false,
      sourceType: SoulSourceType.CAMPUS_OUTREACH,
      sourceLabel: 'MUK Hostel Evangelism',
      serviceId: null,
      fellowshipUnitId: 'camp-muk',
      wonDate: '2026-11-01',
      status: SoulStatus.WEEK_3,
      notes: 'Year 1 student at Mary Stuart Hall.',
      createdAt: '2026-11-01T17:00:00Z',
    },
    {
      id: 'sw-3',
      tenantId: t1,
      fullName: 'Julius Ssekandi',
      phoneNumber: '+256752667788',
      guardianName: '',
      guardianPhone: '',
      isChild: false,
      sourceType: SoulSourceType.SERVICE,
      sourceLabel: 'Sunday Harvest Celebration',
      serviceId: 'srv-2',
      fellowshipUnitId: null,
      wonDate: '2026-10-18',
      status: SoulStatus.INTEGRATED,
      notes: 'Completed all 4 weeks of follow-up and joined Kira Bacenta!',
      createdAt: '2026-10-18T12:00:00Z',
    },
    {
      id: 'sw-child-1',
      tenantId: t1,
      fullName: 'Abigail Otim',
      phoneNumber: '+256772900111',
      guardianName: 'Dr. Patrick Otim',
      guardianPhone: '+256772900111',
      isChild: true,
      sourceType: SoulSourceType.CHILDRENS_CHURCH,
      sourceLabel: 'Sunday Harvest Celebration (Kids)',
      serviceId: 'srv-2',
      fellowshipUnitId: null,
      wonDate: '2026-11-01',
      status: SoulStatus.WEEK_2,
      notes: 'Prayed salvation prayer in Pre-Teens class; shared devotional booklet with dad.',
      createdAt: '2026-11-01T11:30:00Z',
    },
  ];

  const soulFollowupWeeks: SoulFollowupWeek[] = [
    { id: 'sfw-1', tenantId: t1, soulId: 'sw-1', weekNumber: 1, contactMode: ReachoutMode.PHONE_CALL, attendedService: true, comment: 'Welcomed Ronald on Saturday and he attended Sunday Rally!', completedBy: 'u-tele-hod', completedAt: '2026-11-15T15:00:00Z' },
    { id: 'sfw-2', tenantId: t1, soulId: 'sw-2', weekNumber: 1, contactMode: ReachoutMode.PHONE_CALL, attendedService: true, comment: 'Shared New Believer booklet PDF via WhatsApp.', completedBy: 'u-tele-member', completedAt: '2026-11-03T15:00:00Z' },
    { id: 'sfw-3', tenantId: t1, soulId: 'sw-2', weekNumber: 2, contactMode: ReachoutMode.PHYSICAL_VISIT, attendedService: true, comment: 'Met at MUK campus canteen and prayed over semester studies.', completedBy: 'u-tele-member', completedAt: '2026-11-09T15:00:00Z' },
    { id: 'sfw-4', tenantId: t1, soulId: 'sw-2', weekNumber: 3, contactMode: ReachoutMode.PHONE_CALL, attendedService: true, comment: 'Attended Friday MUK Campus fellowship and Sunday service.', completedBy: 'u-tele-member', completedAt: '2026-11-15T16:00:00Z' },
    { id: 'sfw-5', tenantId: t1, soulId: 'sw-3', weekNumber: 1, contactMode: ReachoutMode.PHONE_CALL, attendedService: true, comment: 'Week 1 salvation call done.', completedBy: 'u-tele-hod', completedAt: '2026-10-20T14:00:00Z' },
    { id: 'sfw-6', tenantId: t1, soulId: 'sw-3', weekNumber: 2, contactMode: ReachoutMode.PHONE_CALL, attendedService: true, comment: 'Week 2 water baptism orientation.', completedBy: 'u-tele-hod', completedAt: '2026-10-27T14:00:00Z' },
    { id: 'sfw-7', tenantId: t1, soulId: 'sw-3', weekNumber: 3, contactMode: ReachoutMode.PHYSICAL_VISIT, attendedService: true, comment: 'Week 3 home visit in Kira.', completedBy: 'u-tele-hod', completedAt: '2026-11-03T14:00:00Z' },
    { id: 'sfw-8', tenantId: t1, soulId: 'sw-3', weekNumber: 4, contactMode: ReachoutMode.PHONE_CALL, attendedService: true, comment: 'Week 4 graduated into Kira Bacenta!', completedBy: 'u-tele-hod', completedAt: '2026-11-10T14:00:00Z' },
  ];

  return {
    tenants,
    departments,
    users,
    members,
    children,
    servingMembers,
    services,
    serviceAttendance,
    childAttendance,
    partners,
    deptContributions,
    workplans,
    requisitions,
    financeTransactions,
    fellowshipUnits,
    fellowshipMeetings,
    fellowshipMeetingAttendance,
    fellowshipOutreaches,
    teleReachouts,
    absenteeFollowups,
    soulsWon,
    soulFollowupWeeks,
    subscriptionPayments: [],
  };
};

