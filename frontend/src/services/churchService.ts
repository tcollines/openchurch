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
import { formatPhoneNumber, getChildAgeGroup } from '@/shared/formatters';
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
  RequisitionLineItem,
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
  WorkplanItem,
} from '@/shared/types';
import {
  buildInitialSeedDatabase,
  createDepartmentsForTenant,
  OpenChurchDatabase,
} from './seedData';
import { apiClient } from './apiClient';

export interface PastorVerificationInfo {
  sent: boolean;
  status: 'INVITE_SENT' | 'MAGIC_LINK_SENT' | 'MISSING_SERVICE_KEY' | 'FAILED' | 'BACKEND_OFFLINE';
  recipientEmail: string;
  welcomeUrl?: string;
  message: string;
}

const LEGACY_STORAGE_KEY = 'open_church_multitenant_db_v1';
const STORAGE_KEY = 'open_church_multitenant_db_v2';

type Listener = () => void;
const listeners = new Set<Listener>();

const uid = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const loadDb = (): OpenChurchDatabase => {
  try {
    // Purge legacy v1 demo cache if present
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as OpenChurchDatabase;
    }
  } catch (err) {
    console.error('Failed reading Open Church local store, initializing clean store:', err);
  }
  const clean = buildInitialSeedDatabase();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  return clean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bring stores saved before subscriptions existed up to date: every church gets a fresh 7-day trial. */
const migrateDb = (db: OpenChurchDatabase): OpenChurchDatabase => {
  let changed = false;
  if (!Array.isArray(db.subscriptionPayments)) {
    db.subscriptionPayments = [];
    changed = true;
  }
  if (!db.users.some((u) => u.email.toLowerCase() === 'tcollines004@gmail.com')) {
    db.users.unshift({
      id: 'u-platform-collines',
      tenantId: null,
      fullName: 'Collines (Network Council)',
      email: 'tcollines004@gmail.com',
      phoneNumber: '+256 770 000004',
      role: UserRole.PLATFORM_ADMIN,
      departmentId: null,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }
  for (const t of db.tenants) {
    if (!t.subscriptionStatus) {
      t.subscriptionStatus = 'TRIALING';
      t.trialEndsAt = new Date(Date.now() + 7 * DAY_MS).toISOString();
      changed = true;
    }
    if (!t.monthlyFee) {
      t.monthlyFee = 50000;
      changed = true;
    }
  }
  if (changed) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      /* ignore */
    }
  }
  return db;
};

let dbCache: OpenChurchDatabase = migrateDb(loadDb());

const saveDb = (updater: (draft: OpenChurchDatabase) => void): void => {
  updater(dbCache);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dbCache));
  } catch (err) {
    console.error('Failed persisting Open Church store:', err);
  }
  listeners.forEach((fn) => fn());
};

export const subscribeToChurchStore = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const resetDemoDatabase = (): void => {
  dbCache = migrateDb(buildInitialSeedDatabase());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dbCache));
  listeners.forEach((fn) => fn());
};

// ─── PLATFORM & MULTI-TENANT SERVICE ──────────────────────────────────────────

export const PlatformService = {
  getTenants(): Tenant[] {
    return [...dbCache.tenants].sort((a, b) => a.name.localeCompare(b.name));
  },

  getTenantById(tenantId: string | null): Tenant | null {
    if (!tenantId) return null;
    return dbCache.tenants.find((t) => t.id === tenantId) ?? null;
  },

  createTenant(input: {
    name: string;
    slug: string;
    currency: string;
    city: string;
    country: string;
    adminName: string;
    adminEmail: string;
    adminPhone: string;
    logoUrl?: string;
    shortName?: string;
    address?: string;
    phone?: string;
    email?: string;
    timezone?: string;
    launchDate?: string;
    /** Lead pastor — gets full church oversight (Administration dashboard). Skipped if same email as admin. */
    leadPastor?: { name: string; email: string; phone: string } | null;
    /** Optional department heads, created with that department's HOD login. */
    departmentHeads?: { code: DepartmentCode; name: string; email: string; phone: string }[];
  }): { tenant: Tenant; adminUser: User; users: User[] } {
    const tenantId = uid('t');
    const now = new Date().toISOString();
    const tenant: Tenant = {
      id: tenantId,
      name: input.name.trim(),
      slug: input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      logoUrl: input.logoUrl || '/logo.jpg',
      currency: input.currency || 'UGX',
      city: input.city.trim(),
      country: input.country.trim(),
      status: 'ACTIVE',
      subscriptionStatus: 'TRIALING',
      monthlyFee: 50000,
      trialEndsAt: new Date(Date.now() + 7 * DAY_MS).toISOString(),
      createdAt: now,
      shortName: input.shortName?.trim() || undefined,
      address: input.address?.trim() || undefined,
      phone: input.phone ? formatPhoneNumber(input.phone) : undefined,
      email: input.email?.trim().toLowerCase() || undefined,
      timezone: input.timezone || undefined,
      launchDate: input.launchDate || undefined,
    };
    const depts = createDepartmentsForTenant(tenantId);
    const adminDept = depts.find((d) => d.code === DepartmentCode.ADMIN)!;
    const adminUser: User = {
      id: uid('u'),
      tenantId,
      fullName: input.adminName.trim(),
      email: input.adminEmail.trim().toLowerCase(),
      phoneNumber: formatPhoneNumber(input.adminPhone),
      role: UserRole.ADMIN,
      departmentId: adminDept.id,
      fellowshipUnitId: null,
      isActive: true,
      createdAt: now,
    };

    const HOD_ROLE: Partial<Record<DepartmentCode, UserRole>> = {
      [DepartmentCode.FINANCE]: UserRole.FINANCE_HOD,
      [DepartmentCode.BACENTA]: UserRole.BACENTA_HOD,
      [DepartmentCode.AIRPORT_STARS]: UserRole.AIRPORT_HOD,
      [DepartmentCode.TELE_PASTORING]: UserRole.TELE_HOD,
      [DepartmentCode.CHILDRENS_CHURCH]: UserRole.CHILDREN_HOD,
      [DepartmentCode.CAMPUSES]: UserRole.CAMPUS_HOD,
      [DepartmentCode.ADMIN]: UserRole.ADMIN,
    };
    const taken = new Set([adminUser.email, ...dbCache.users.map((u) => u.email.toLowerCase())]);
    const extra: User[] = [];
    const makeUser = (name: string, email: string, phone: string, role: UserRole, departmentId: string) => {
      const e = email.trim().toLowerCase();
      if (!name.trim() || !e || taken.has(e)) return;
      taken.add(e);
      extra.push({
        id: uid('u'),
        tenantId,
        fullName: name.trim(),
        email: e,
        phoneNumber: formatPhoneNumber(phone || ''),
        role,
        departmentId,
        fellowshipUnitId: null,
        isActive: true,
        createdAt: now,
      });
    };
    if (input.leadPastor) {
      makeUser(input.leadPastor.name, input.leadPastor.email, input.leadPastor.phone, UserRole.ADMIN, adminDept.id);
    }
    for (const h of input.departmentHeads ?? []) {
      const dept = depts.find((d) => d.code === h.code);
      const role = HOD_ROLE[h.code];
      if (dept && role) makeUser(h.name, h.email, h.phone, role, dept.id);
    }

    saveDb((draft) => {
      draft.tenants.push(tenant);
      draft.departments.push(...depts);
      draft.users.push(adminUser, ...extra);
    });

    return { tenant, adminUser, users: [adminUser, ...extra] };
  },

  /** Merge backend-returned tenant, departments and users into the local store so fresh devices/sessions work immediately. */
  syncBackendEntities(payload: {
    tenant?: Tenant | null;
    departments?: Department[];
    users?: User[];
  }): User | null {
    let resolvedFirstUser: User | null = null;
    saveDb((draft) => {
      if (payload.tenant) {
        const normalizedTenant: Tenant = {
          ...payload.tenant,
          monthlyFee: Number(payload.tenant.monthlyFee ?? 50000),
          subscriptionStatus: (payload.tenant.subscriptionStatus || 'TRIALING') as Tenant['subscriptionStatus'],
          status: (payload.tenant.status || 'ACTIVE') as Tenant['status'],
        };
        const idx = draft.tenants.findIndex(
          (t) => t.id === normalizedTenant.id || t.slug === normalizedTenant.slug
        );
        if (idx >= 0) {
          draft.tenants[idx] = { ...draft.tenants[idx], ...normalizedTenant };
        } else {
          draft.tenants.push(normalizedTenant);
        }

        // Ensure all 7 departments exist for this tenant
        if (payload.departments && payload.departments.length > 0) {
          for (const d of payload.departments) {
            const dIdx = draft.departments.findIndex(
              (existing) =>
                existing.id === d.id ||
                (existing.tenantId === d.tenantId && existing.code === d.code)
            );
            if (dIdx >= 0) {
              draft.departments[dIdx] = d;
            } else {
              draft.departments.push(d);
            }
          }
        } else if (!draft.departments.some((d) => d.tenantId === normalizedTenant.id)) {
          draft.departments.push(...createDepartmentsForTenant(normalizedTenant.id));
        }
      }

      for (const u of payload.users ?? []) {
        const uIdx = draft.users.findIndex(
          (existing) =>
            existing.id === u.id || existing.email.toLowerCase() === u.email.toLowerCase()
        );
        if (uIdx >= 0) {
          draft.users[uIdx] = { ...draft.users[uIdx], ...u };
          if (!resolvedFirstUser) resolvedFirstUser = draft.users[uIdx];
        } else {
          draft.users.push(u);
          if (!resolvedFirstUser) resolvedFirstUser = u;
        }
      }
    });
    return resolvedFirstUser;
  },

  /** Provision church on Supabase PostgreSQL via backend API and dispatch Pastor verification invite email. */
  async provisionTenantRemote(input: {
    name: string;
    slug: string;
    currency: string;
    city: string;
    country: string;
    adminName: string;
    adminEmail: string;
    adminPhone: string;
    logoUrl?: string;
    shortName?: string;
    address?: string;
    phone?: string;
    email?: string;
    timezone?: string;
    launchDate?: string;
    leadPastor?: { name: string; email: string; phone: string } | null;
    departmentHeads?: { code: DepartmentCode; name: string; email: string; phone: string }[];
  }): Promise<{
    tenant: Tenant;
    adminUser: User;
    users: User[];
    verification: PastorVerificationInfo;
  }> {
    try {
      const res = await apiClient.post<{
        tenant: Tenant;
        departments: Department[];
        adminUser: User;
        users: User[];
        verification: PastorVerificationInfo;
      }>('/platform/tenants', input);

      const enrichedTenant: Tenant = {
        ...res.tenant,
        shortName: input.shortName?.trim() || undefined,
        address: input.address?.trim() || undefined,
        phone: input.phone ? formatPhoneNumber(input.phone) : undefined,
        email: input.email?.trim().toLowerCase() || undefined,
        timezone: input.timezone || undefined,
        launchDate: input.launchDate || undefined,
      };

      PlatformService.syncBackendEntities({
        tenant: enrichedTenant,
        departments: res.departments,
        users: res.users,
      });

      return {
        tenant: enrichedTenant,
        adminUser: res.adminUser,
        users: res.users,
        verification: res.verification,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      // If it's a validation/auth error from the backend, surface it unless it's a network failure
      if (msg && !/failed to fetch|networkerror|load failed/i.test(msg)) {
        throw err;
      }
      // Offline fallback so local preview still works if backend server isn't running
      const local = PlatformService.createTenant(input);
      const pastorEmail = (input.leadPastor?.email || input.adminEmail).trim().toLowerCase();
      return {
        ...local,
        verification: {
          sent: false,
          status: 'BACKEND_OFFLINE',
          recipientEmail: pastorEmail,
          message:
            'Saved locally, but the backend server was unreachable so the verification email was not dispatched.',
        },
      };
    }
  },

  async resendPastorInvite(
    tenantId: string,
    email?: string
  ): Promise<PastorVerificationInfo> {
    const res = await apiClient.post<{ verification: PastorVerificationInfo }>(
      `/platform/tenants/${tenantId}/resend-invite`,
      email ? { email } : {}
    );
    return res.verification;
  },

  /** Pull live multi-tenant snapshot from backend Prisma -> Supabase PostgreSQL once authenticated. */
  async hydrateFromBackendBootstrap(): Promise<void> {
    try {
      const snap = await apiClient.get<Partial<OpenChurchDatabase>>('/bootstrap');
      if (!snap || !Array.isArray(snap.tenants) || !Array.isArray(snap.users)) return;
      saveDb((draft) => {
        draft.tenants = snap.tenants!.map((t) => ({
          ...t,
          monthlyFee: Number(t.monthlyFee ?? 50000),
        }));
        if (Array.isArray(snap.departments)) draft.departments = snap.departments;
        draft.users = snap.users!;
        if (Array.isArray(snap.members)) draft.members = snap.members;
        if (Array.isArray(snap.children)) draft.children = snap.children;
        if (Array.isArray(snap.servingMembers)) draft.servingMembers = snap.servingMembers;
        if (Array.isArray(snap.services)) draft.services = snap.services;
        if (Array.isArray(snap.serviceAttendance)) draft.serviceAttendance = snap.serviceAttendance;
        if (Array.isArray(snap.childAttendance)) draft.childAttendance = snap.childAttendance;
        if (Array.isArray(snap.partners)) draft.partners = snap.partners;
        if (Array.isArray(snap.deptContributions)) draft.deptContributions = snap.deptContributions;
        if (Array.isArray(snap.workplans)) draft.workplans = snap.workplans;
        if (Array.isArray(snap.requisitions)) draft.requisitions = snap.requisitions;
        if (Array.isArray(snap.financeTransactions)) draft.financeTransactions = snap.financeTransactions;
        if (Array.isArray(snap.fellowshipUnits)) draft.fellowshipUnits = snap.fellowshipUnits;
        if (Array.isArray(snap.fellowshipMeetings)) draft.fellowshipMeetings = snap.fellowshipMeetings;
        if (Array.isArray(snap.fellowshipMeetingAttendance)) {
          draft.fellowshipMeetingAttendance = snap.fellowshipMeetingAttendance;
        }
        if (Array.isArray(snap.fellowshipOutreaches)) draft.fellowshipOutreaches = snap.fellowshipOutreaches;
        if (Array.isArray(snap.teleReachouts)) draft.teleReachouts = snap.teleReachouts;
        if (Array.isArray(snap.absenteeFollowups)) draft.absenteeFollowups = snap.absenteeFollowups;
        if (Array.isArray(snap.soulsWon)) draft.soulsWon = snap.soulsWon;
        if (Array.isArray(snap.soulFollowupWeeks)) draft.soulFollowupWeeks = snap.soulFollowupWeeks;
        if (Array.isArray(snap.subscriptionPayments)) {
          draft.subscriptionPayments = snap.subscriptionPayments.map((p) => ({
            ...p,
            amount: Number(p.amount),
          }));
        }
      });
    } catch {
      // Ignore if token expired or offline
    }
  },

  toggleTenantStatus(tenantId: string): void {
    saveDb((draft) => {
      const t = draft.tenants.find((item) => item.id === tenantId);
      if (t) {
        t.status = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      }
    });
  },

  getAllUsers(): User[] {
    return [...dbCache.users];
  },

  getUsersForTenant(tenantId: string): User[] {
    return dbCache.users.filter((u) => u.tenantId === tenantId);
  },

  createUser(input: {
    tenantId: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    role: UserRole;
    departmentId: string | null;
    fellowshipUnitId?: string | null;
  }): User {
    const newUser: User = {
      id: uid('u'),
      tenantId: input.tenantId,
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phoneNumber: formatPhoneNumber(input.phoneNumber),
      role: input.role,
      departmentId: input.departmentId,
      fellowshipUnitId: input.fellowshipUnitId ?? null,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    saveDb((draft) => {
      draft.users.push(newUser);
    });

    // Persist to Supabase PostgreSQL & automatically email their department invite link
    void apiClient
      .post<{ user: User }>('/users', input, { tenantId: input.tenantId })
      .then((res) => {
        if (res?.user) {
          saveDb((draft) => {
            const idx = draft.users.findIndex(
              (u) => u.id === newUser.id || u.email.toLowerCase() === res.user.email.toLowerCase()
            );
            if (idx >= 0) {
              draft.users[idx] = { ...draft.users[idx], ...res.user };
            }
          });
        }
      })
      .catch(() => {
        // Offline preview fallback keeps local user entry
      });

    return newUser;
  },
};

// ─── DEPARTMENTS & UNIVERSAL HOD "MORE" SERVICE ───────────────────────────────

export const DepartmentService = {
  getDepartments(tenantId: string): Department[] {
    return dbCache.departments.filter((d) => d.tenantId === tenantId);
  },

  getDepartmentByCode(tenantId: string, code: DepartmentCode): Department | null {
    return (
      dbCache.departments.find((d) => d.tenantId === tenantId && d.code === code) ?? null
    );
  },

  getServingMembers(tenantId: string, departmentId?: string): ServingMember[] {
    return dbCache.servingMembers.filter(
      (sm) => sm.tenantId === tenantId && (!departmentId || sm.departmentId === departmentId)
    );
  },

  addServingMember(input: {
    tenantId: string;
    departmentId: string;
    memberId: string;
    servingRole: 'HOD' | 'Coordinator' | 'Member';
    userId?: string | null;
  }): ServingMember {
    const existing = dbCache.servingMembers.find(
      (sm) => sm.departmentId === input.departmentId && sm.memberId === input.memberId
    );
    if (existing) return existing;

    const record: ServingMember = {
      id: uid('sm'),
      tenantId: input.tenantId,
      departmentId: input.departmentId,
      memberId: input.memberId,
      servingRole: input.servingRole,
      userId: input.userId ?? null,
      joinedDeptAt: new Date().toISOString().slice(0, 10),
    };
    saveDb((draft) => {
      draft.servingMembers.push(record);
    });
    return record;
  },

  removeServingMember(servingMemberId: string): void {
    saveDb((draft) => {
      draft.servingMembers = draft.servingMembers.filter((s) => s.id !== servingMemberId);
    });
  },

  getDeptContributions(tenantId: string, departmentId?: string): DeptContribution[] {
    return dbCache.deptContributions
      .filter(
        (dc) =>
          dc.tenantId === tenantId && (!departmentId || dc.departmentId === departmentId)
      )
      .sort((a, b) => b.contributionDate.localeCompare(a.contributionDate));
  },

  addDeptContribution(input: {
    tenantId: string;
    departmentId: string;
    memberId: string;
    amount: number;
    purpose: string;
    paymentMethod: 'Cash' | 'Mobile Money' | 'Bank Transfer';
    referenceCode?: string;
    contributionDate: string;
    recordedBy: string;
  }): DeptContribution {
    const now = new Date().toISOString();
    const record: DeptContribution = {
      id: uid('dc'),
      tenantId: input.tenantId,
      departmentId: input.departmentId,
      memberId: input.memberId,
      amount: input.amount,
      purpose: input.purpose.trim(),
      paymentMethod: input.paymentMethod,
      referenceCode: input.referenceCode?.trim() || `DC-${Date.now().toString().slice(-5)}`,
      contributionDate: input.contributionDate,
      recordedBy: input.recordedBy,
      createdAt: now,
    };

    const ledgerTx: FinanceTransaction = {
      id: uid('ft'),
      tenantId: input.tenantId,
      type: FinanceType.INCOME,
      category: FinanceCategory.DEPT_CONTRIBUTION,
      sourceScope: FinanceScope.DEPARTMENT,
      serviceId: null,
      departmentId: input.departmentId,
      partnerId: null,
      memberId: input.memberId,
      fellowshipUnitId: null,
      requisitionId: null,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      referenceCode: record.referenceCode,
      description: `Dept Contribution: ${record.purpose}`,
      isVerified: true,
      transactionDate: input.contributionDate,
      recordedBy: input.recordedBy,
      createdAt: now,
    };

    saveDb((draft) => {
      draft.deptContributions.unshift(record);
      draft.financeTransactions.unshift(ledgerTx);
    });
    return record;
  },

  getWorkplans(tenantId: string, departmentId?: string): Workplan[] {
    return dbCache.workplans
      .filter(
        (w) => w.tenantId === tenantId && (!departmentId || w.departmentId === departmentId)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createWorkplan(input: {
    tenantId: string;
    departmentId: string;
    monthLabel: string;
    title: string;
    items: Omit<WorkplanItem, 'id' | 'totalCost'>[];
    deptContributionAmount: number;
    submittedBy: string;
  }): Workplan {
    const items: WorkplanItem[] = input.items.map((item) => ({
      id: uid('wpi'),
      activity: item.activity.trim(),
      itemName: item.itemName.trim(),
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.quantity * item.unitCost,
    }));
    const totalRequested = items.reduce((sum, item) => sum + item.totalCost, 0);
    const wp: Workplan = {
      id: uid('wp'),
      tenantId: input.tenantId,
      departmentId: input.departmentId,
      monthLabel: input.monthLabel,
      title: input.title.trim(),
      items,
      totalRequested,
      deptContributionAmount: input.deptContributionAmount || 0,
      totalApproved: 0,
      status: WorkflowStatus.SUBMITTED,
      reviewNotes: '',
      submittedBy: input.submittedBy,
      createdAt: new Date().toISOString(),
    };
    saveDb((draft) => {
      draft.workplans.unshift(wp);
    });
    return wp;
  },

  reviewWorkplan(
    workplanId: string,
    decision: WorkflowStatus.APPROVED | WorkflowStatus.REJECTED,
    approvedAmount: number,
    reviewNotes: string
  ): void {
    saveDb((draft) => {
      const wp = draft.workplans.find((w) => w.id === workplanId);
      if (!wp) return;
      wp.status = decision;
      wp.totalApproved = decision === WorkflowStatus.APPROVED ? approvedAmount : 0;
      wp.reviewNotes = reviewNotes.trim();
    });
  },

  getRequisitions(tenantId: string, departmentId?: string): Requisition[] {
    return dbCache.requisitions
      .filter(
        (r) => r.tenantId === tenantId && (!departmentId || r.departmentId === departmentId)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createRequisition(input: {
    tenantId: string;
    departmentId: string;
    workplanId?: string | null;
    serviceId?: string | null;
    title: string;
    items: RequisitionLineItem[];
    requestedBy: string;
  }): Requisition {
    const totalAmount = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0
    );
    const nextNum = 1001 + dbCache.requisitions.length;
    const req: Requisition = {
      id: uid('req'),
      tenantId: input.tenantId,
      departmentId: input.departmentId,
      workplanId: input.workplanId ?? null,
      serviceId: input.serviceId ?? null,
      requisitionNumber: `REQ-${nextNum}`,
      title: input.title.trim(),
      items: input.items,
      totalAmount,
      amountPaid: 0,
      status: RequisitionStatus.PENDING_ADMIN,
      rejectionReason: '',
      requestedBy: input.requestedBy,
      requestedAt: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    saveDb((draft) => {
      draft.requisitions.unshift(req);
    });
    return req;
  },

  reviewRequisition(
    requisitionId: string,
    decision: RequisitionStatus.APPROVED | RequisitionStatus.REJECTED,
    rejectionReason = ''
  ): void {
    saveDb((draft) => {
      const req = draft.requisitions.find((r) => r.id === requisitionId);
      if (!req) return;
      req.status = decision;
      req.rejectionReason =
        decision === RequisitionStatus.REJECTED ? rejectionReason.trim() : '';
    });
  },
};

// ─── MEMBERS, CHILDREN, SERVICES & CHECK-IN SERVICE ───────────────────────────

export const AttendanceAndMemberService = {
  getMembers(tenantId: string): Member[] {
    return dbCache.members
      .filter((m) => m.tenantId === tenantId && m.isActive)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  registerMember(input: {
    tenantId: string;
    fullName: string;
    phoneNumber: string;
    gender: 'Male' | 'Female';
    residence: string;
    bacentaId?: string | null;
    campusId?: string | null;
    isFirstTimer: boolean;
  }): Member {
    const now = new Date().toISOString();
    const member: Member = {
      id: uid('m'),
      tenantId: input.tenantId,
      fullName: input.fullName.trim(),
      phoneNumber: formatPhoneNumber(input.phoneNumber),
      gender: input.gender,
      residence: input.residence.trim() || 'General',
      bacentaId: input.bacentaId ?? null,
      campusId: input.campusId ?? null,
      isFirstTimer: input.isFirstTimer,
      joinedAt: now.slice(0, 10),
      isActive: true,
      createdAt: now,
    };
    saveDb((draft) => {
      draft.members.push(member);
    });
    return member;
  },

  getChildren(tenantId: string): Child[] {
    return dbCache.children
      .filter((c) => c.tenantId === tenantId && c.isActive)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  registerChild(input: {
    tenantId: string;
    fullName: string;
    age: number;
    guardianName: string;
    guardianPhone: string;
    parentMemberId?: string | null;
  }): Child {
    const now = new Date().toISOString();
    const child: Child = {
      id: uid('c'),
      tenantId: input.tenantId,
      fullName: input.fullName.trim(),
      age: input.age,
      ageGroup: getChildAgeGroup(input.age),
      guardianName: input.guardianName.trim(),
      guardianPhone: formatPhoneNumber(input.guardianPhone),
      parentMemberId: input.parentMemberId ?? null,
      joinedAt: now.slice(0, 10),
      isActive: true,
      createdAt: now,
    };
    saveDb((draft) => {
      draft.children.push(child);
    });
    return child;
  },

  getServices(tenantId: string): Service[] {
    return dbCache.services
      .filter((s) => s.tenantId === tenantId)
      .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));
  },

  createService(input: {
    tenantId: string;
    title: string;
    serviceDate: string;
    category: ServiceCategory;
    createdBy: string;
  }): Service {
    const srv: Service = {
      id: uid('srv'),
      tenantId: input.tenantId,
      title: input.title.trim(),
      serviceDate: input.serviceDate,
      category: input.category,
      status: ServiceStatus.OPEN,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    };
    saveDb((draft) => {
      draft.services.unshift(srv);
    });
    return srv;
  },

  toggleServiceStatus(serviceId: string): void {
    saveDb((draft) => {
      const srv = draft.services.find((s) => s.id === serviceId);
      if (srv) {
        srv.status =
          srv.status === ServiceStatus.OPEN ? ServiceStatus.CLOSED : ServiceStatus.OPEN;
      }
    });
  },

  getServiceAttendance(tenantId: string, serviceId?: string): ServiceAttendance[] {
    return dbCache.serviceAttendance.filter(
      (a) => a.tenantId === tenantId && (!serviceId || a.serviceId === serviceId)
    );
  },

  checkInMember(input: {
    tenantId: string;
    serviceId: string;
    memberId: string;
    checkedInBy: string;
    isServingCheckin?: boolean;
    servingDepartmentId?: string | null;
  }): ServiceAttendance {
    const existing = dbCache.serviceAttendance.find(
      (a) => a.serviceId === input.serviceId && a.memberId === input.memberId
    );
    if (existing) {
      if (input.isServingCheckin && !existing.isServingCheckin) {
        saveDb((draft) => {
          const target = draft.serviceAttendance.find((a) => a.id === existing.id);
          if (target) {
            target.isServingCheckin = true;
            target.servingDepartmentId = input.servingDepartmentId ?? null;
          }
        });
      }
      return existing;
    }

    const member = dbCache.members.find((m) => m.id === input.memberId);
    const priorVisits = dbCache.serviceAttendance.some((a) => a.memberId === input.memberId);
    const att: ServiceAttendance = {
      id: uid('att'),
      tenantId: input.tenantId,
      serviceId: input.serviceId,
      memberId: input.memberId,
      isFirstTimeVisit: Boolean(member?.isFirstTimer && !priorVisits),
      isServingCheckin: Boolean(input.isServingCheckin),
      servingDepartmentId: input.servingDepartmentId ?? null,
      checkedInAt: new Date().toISOString(),
      checkedInBy: input.checkedInBy,
    };

    saveDb((draft) => {
      draft.serviceAttendance.push(att);
      if (priorVisits && member?.isFirstTimer) {
        const m = draft.members.find((x) => x.id === input.memberId);
        if (m) m.isFirstTimer = false;
      }
    });
    return att;
  },

  undoMemberCheckIn(serviceId: string, memberId: string): void {
    saveDb((draft) => {
      draft.serviceAttendance = draft.serviceAttendance.filter(
        (a) => !(a.serviceId === serviceId && a.memberId === memberId)
      );
    });
  },

  getChildAttendance(tenantId: string, serviceId?: string): ChildAttendance[] {
    return dbCache.childAttendance.filter(
      (ca) => ca.tenantId === tenantId && (!serviceId || ca.serviceId === serviceId)
    );
  },

  checkInChild(input: {
    tenantId: string;
    serviceId: string;
    childId: string;
    checkedInBy: string;
  }): ChildAttendance {
    const existing = dbCache.childAttendance.find(
      (c) => c.serviceId === input.serviceId && c.childId === input.childId
    );
    if (existing) return existing;

    const record: ChildAttendance = {
      id: uid('ca'),
      tenantId: input.tenantId,
      serviceId: input.serviceId,
      childId: input.childId,
      checkedInAt: new Date().toISOString(),
      checkedOutAt: null,
      soulWon: false,
      checkedInBy: input.checkedInBy,
    };
    saveDb((draft) => {
      draft.childAttendance.push(record);
    });
    return record;
  },

  checkOutChild(serviceId: string, childId: string): void {
    saveDb((draft) => {
      const target = draft.childAttendance.find(
        (c) => c.serviceId === serviceId && c.childId === childId
      );
      if (target) {
        target.checkedOutAt = target.checkedOutAt ? null : new Date().toISOString();
      }
    });
  },

  markChildSoulWon(input: {
    tenantId: string;
    serviceId: string;
    child: Child;
    serviceTitle: string;
    notes?: string;
  }): void {
    saveDb((draft) => {
      const ca = draft.childAttendance.find(
        (x) => x.serviceId === input.serviceId && x.childId === input.child.id
      );
      if (ca) ca.soulWon = true;

      const alreadyLogged = draft.soulsWon.some(
        (s) => s.isChild && s.fullName.toLowerCase() === input.child.fullName.toLowerCase()
      );
      if (!alreadyLogged) {
        draft.soulsWon.unshift({
          id: uid('sw'),
          tenantId: input.tenantId,
          fullName: input.child.fullName,
          phoneNumber: input.child.guardianPhone,
          guardianName: input.child.guardianName,
          guardianPhone: input.child.guardianPhone,
          isChild: true,
          sourceType: SoulSourceType.CHILDRENS_CHURCH,
          sourceLabel: input.serviceTitle,
          serviceId: input.serviceId,
          fellowshipUnitId: null,
          wonDate: new Date().toISOString().slice(0, 10),
          status: SoulStatus.NEW,
          notes: input.notes?.trim() || "Saved during Children's Church service.",
          createdAt: new Date().toISOString(),
        });
      }
    });
  },

  getAttendancePercentageTrend(
    tenantId: string,
    limit = 8
  ): {
    serviceId: string;
    title: string;
    date: string;
    category: ServiceCategory;
    checkedIn: number;
    childrenCount: number;
    eligibleMembers: number;
    percentage: number;
  }[] {
    const services = [...dbCache.services]
      .filter((s) => s.tenantId === tenantId)
      .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
      .slice(-limit);

    const tenantMembers = dbCache.members.filter((m) => m.tenantId === tenantId && m.isActive);

    return services.map((s) => {
      const eligible = Math.max(
        tenantMembers.filter((m) => m.joinedAt <= s.serviceDate).length,
        1
      );
      const checkedIn = dbCache.serviceAttendance.filter((a) => a.serviceId === s.id).length;
      const childrenCount = dbCache.childAttendance.filter((c) => c.serviceId === s.id).length;
      const percentage = Math.min(100, Math.round((checkedIn / eligible) * 1000) / 10);
      return {
        serviceId: s.id,
        title: s.title,
        date: s.serviceDate,
        category: s.category,
        checkedIn,
        childrenCount,
        eligibleMembers: eligible,
        percentage,
      };
    });
  },
};

// ─── FINANCE & PARTNER REGISTER SERVICE ───────────────────────────────────────

export const FinanceService = {
  getPartners(tenantId: string): Partner[] {
    return dbCache.partners
      .filter((p) => p.tenantId === tenantId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  },

  createPartner(input: {
    tenantId: string;
    memberId?: string | null;
    fullName: string;
    phoneNumber: string;
    email: string;
    tierOrPledge: string;
    monthlyPledge: number;
    frequency: 'Weekly' | 'Monthly' | 'Quarterly' | 'One-Time';
  }): Partner {
    const partner: Partner = {
      id: uid('p'),
      tenantId: input.tenantId,
      memberId: input.memberId ?? null,
      fullName: input.fullName.trim(),
      phoneNumber: formatPhoneNumber(input.phoneNumber),
      email: input.email.trim(),
      tierOrPledge: input.tierOrPledge.trim() || 'Kingdom Partner',
      monthlyPledge: input.monthlyPledge || 0,
      frequency: input.frequency,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
    saveDb((draft) => {
      draft.partners.push(partner);
    });
    return partner;
  },

  getTransactions(tenantId: string, serviceId?: string | null): FinanceTransaction[] {
    return dbCache.financeTransactions
      .filter(
        (tx) => tx.tenantId === tenantId && (!serviceId || tx.serviceId === serviceId)
      )
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  },

  recordServiceIncome(input: {
    tenantId: string;
    serviceId: string;
    category: FinanceCategory.OFFERTORY | FinanceCategory.TITHE | FinanceCategory.PARTNERSHIP;
    partnerId?: string | null;
    memberId?: string | null;
    amount: number;
    paymentMethod: 'Cash' | 'Mobile Money' | 'Bank Transfer';
    referenceCode?: string;
    description?: string;
    transactionDate: string;
    recordedBy: string;
  }): FinanceTransaction {
    if (input.category === FinanceCategory.PARTNERSHIP && !input.partnerId) {
      throw new Error('Partnership entries must be tied to a registered Partner.');
    }

    const finDept = DepartmentService.getDepartmentByCode(
      input.tenantId,
      DepartmentCode.FINANCE
    );
    const partner = input.partnerId
      ? dbCache.partners.find((p) => p.id === input.partnerId)
      : null;

    const tx: FinanceTransaction = {
      id: uid('ft'),
      tenantId: input.tenantId,
      type: FinanceType.INCOME,
      category: input.category,
      sourceScope: FinanceScope.SERVICE,
      serviceId: input.serviceId,
      departmentId: finDept?.id ?? null,
      partnerId: input.partnerId ?? null,
      memberId: input.memberId ?? partner?.memberId ?? null,
      fellowshipUnitId: null,
      requisitionId: null,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      referenceCode:
        input.referenceCode?.trim() ||
        `${input.category.slice(0, 3)}-${Date.now().toString().slice(-5)}`,
      description:
        input.description?.trim() ||
        (partner ? `Partnership — ${partner.fullName}` : `Service ${input.category}`),
      isVerified: true,
      transactionDate: input.transactionDate,
      recordedBy: input.recordedBy,
      createdAt: new Date().toISOString(),
    };

    saveDb((draft) => {
      draft.financeTransactions.unshift(tx);
    });
    return tx;
  },

  recordExpense(input: {
    tenantId: string;
    serviceId?: string | null;
    departmentId?: string | null;
    requisitionId?: string | null;
    amount: number;
    paymentMethod: 'Cash' | 'Mobile Money' | 'Bank Transfer';
    referenceCode?: string;
    description: string;
    transactionDate: string;
    recordedBy: string;
  }): FinanceTransaction {
    const tx: FinanceTransaction = {
      id: uid('ft'),
      tenantId: input.tenantId,
      type: FinanceType.EXPENSE,
      category: input.requisitionId
        ? FinanceCategory.REQUISITION_PAYOUT
        : FinanceCategory.OTHER_EXPENSE,
      sourceScope: input.serviceId ? FinanceScope.SERVICE : FinanceScope.DEPARTMENT,
      serviceId: input.serviceId ?? null,
      departmentId: input.departmentId ?? null,
      partnerId: null,
      memberId: null,
      fellowshipUnitId: null,
      requisitionId: input.requisitionId ?? null,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      referenceCode: input.referenceCode?.trim() || `EXP-${Date.now().toString().slice(-5)}`,
      description: input.description.trim(),
      isVerified: true,
      transactionDate: input.transactionDate,
      recordedBy: input.recordedBy,
      createdAt: new Date().toISOString(),
    };

    saveDb((draft) => {
      draft.financeTransactions.unshift(tx);
      if (input.requisitionId) {
        const req = draft.requisitions.find((r) => r.id === input.requisitionId);
        if (req) {
          req.amountPaid = Math.min(req.totalAmount, req.amountPaid + input.amount);
          if (req.amountPaid >= req.totalAmount) {
            req.status = RequisitionStatus.PAID;
          }
        }
      }
    });
    return tx;
  },
};

// ─── FELLOWSHIP ENGINE (BACENTAS & CAMPUSES) ──────────────────────────────────

export const FellowshipService = {
  getUnits(tenantId: string, unitType: FellowshipUnitType): FellowshipUnit[] {
    return dbCache.fellowshipUnits
      .filter((u) => u.tenantId === tenantId && u.unitType === unitType)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  getUnitById(unitId: string | null): FellowshipUnit | null {
    if (!unitId) return null;
    return dbCache.fellowshipUnits.find((u) => u.id === unitId) ?? null;
  },

  createUnit(input: {
    tenantId: string;
    unitType: FellowshipUnitType;
    name: string;
    locationOrInstitution: string;
    meetingDay: string;
    leaderName: string;
    leaderPhone: string;
    leaderEmail?: string;
    assignedMemberIds?: string[];
  }): FellowshipUnit {
    const unitId = uid(input.unitType === FellowshipUnitType.BACENTA ? 'bac' : 'camp');
    const now = new Date().toISOString();
    let leaderUserId: string | null = null;

    const dept = DepartmentService.getDepartmentByCode(
      input.tenantId,
      input.unitType === FellowshipUnitType.BACENTA
        ? DepartmentCode.BACENTA
        : DepartmentCode.CAMPUSES
    );

    if (input.leaderEmail?.trim()) {
      const existingUser = dbCache.users.find(
        (u) => u.email.toLowerCase() === input.leaderEmail!.trim().toLowerCase()
      );
      if (existingUser) {
        leaderUserId = existingUser.id;
      } else {
        leaderUserId = uid('u');
      }
    }

    const unit: FellowshipUnit = {
      id: unitId,
      tenantId: input.tenantId,
      unitType: input.unitType,
      name: input.name.trim(),
      locationOrInstitution: input.locationOrInstitution.trim(),
      meetingDay: input.meetingDay.trim() || 'Wednesday 6:00 PM',
      leaderUserId,
      leaderName: input.leaderName.trim(),
      leaderPhone: formatPhoneNumber(input.leaderPhone),
      createdAt: now,
    };

    saveDb((draft) => {
      draft.fellowshipUnits.push(unit);
      if (input.leaderEmail?.trim() && leaderUserId) {
        const existing = draft.users.find((u) => u.id === leaderUserId);
        if (existing) {
          existing.fellowshipUnitId = unitId;
        } else {
          draft.users.push({
            id: leaderUserId,
            tenantId: input.tenantId,
            fullName: input.leaderName.trim(),
            email: input.leaderEmail.trim().toLowerCase(),
            phoneNumber: formatPhoneNumber(input.leaderPhone),
            role:
              input.unitType === FellowshipUnitType.BACENTA
                ? UserRole.BACENTA_LEADER
                : UserRole.CAMPUS_LEADER,
            departmentId: dept?.id ?? null,
            fellowshipUnitId: unitId,
            isActive: true,
            createdAt: now,
          });
        }
      }

      if (input.assignedMemberIds?.length) {
        draft.members.forEach((m) => {
          if (input.assignedMemberIds!.includes(m.id)) {
            if (input.unitType === FellowshipUnitType.BACENTA) {
              m.bacentaId = unitId;
            } else {
              m.campusId = unitId;
            }
          }
        });
      }
    });

    return unit;
  },

  assignMemberToUnit(
    memberId: string,
    unitId: string,
    unitType: FellowshipUnitType
  ): void {
    saveDb((draft) => {
      const m = draft.members.find((x) => x.id === memberId);
      if (!m) return;
      if (unitType === FellowshipUnitType.BACENTA) {
        m.bacentaId = unitId;
      } else {
        m.campusId = unitId;
      }
    });
  },

  getUnitMembers(tenantId: string, unitId: string, unitType: FellowshipUnitType): Member[] {
    return dbCache.members.filter(
      (m) =>
        m.tenantId === tenantId &&
        m.isActive &&
        (unitType === FellowshipUnitType.BACENTA
          ? m.bacentaId === unitId
          : m.campusId === unitId)
    );
  },

  getMeetings(tenantId: string, unitIds?: string[]): FellowshipMeeting[] {
    return dbCache.fellowshipMeetings
      .filter(
        (m) => m.tenantId === tenantId && (!unitIds || unitIds.includes(m.unitId))
      )
      .sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
  },

  getMeetingAttendance(tenantId: string, meetingId?: string): FellowshipMeetingAttendance[] {
    return dbCache.fellowshipMeetingAttendance.filter(
      (a) => a.tenantId === tenantId && (!meetingId || a.meetingId === meetingId)
    );
  },

  submitMeetingAndAttendance(input: {
    tenantId: string;
    unitId: string;
    unitName: string;
    unitType: FellowshipUnitType;
    meetingDate: string;
    title: string;
    checkedInMemberIds: string[];
    labourersCount: number;
    soulsWonCount: number;
    newSouls?: { fullName: string; phoneNumber: string }[];
    testimony: string;
    submittedBy: string;
  }): FellowshipMeeting {
    const now = new Date().toISOString();
    const meeting: FellowshipMeeting = {
      id: uid('fm'),
      tenantId: input.tenantId,
      unitId: input.unitId,
      meetingDate: input.meetingDate,
      title: input.title.trim() || `${input.unitName} Fellowship`,
      labourersCount: Math.max(1, input.labourersCount),
      soulsWonCount: Math.max(0, input.soulsWonCount),
      testimony: input.testimony.trim(),
      titheCollected: 0,
      offertoryCollected: 0,
      submittedBy: input.submittedBy,
      createdAt: now,
    };

    const attRows: FellowshipMeetingAttendance[] = input.checkedInMemberIds.map((mId) => ({
      id: uid('fma'),
      tenantId: input.tenantId,
      meetingId: meeting.id,
      memberId: mId,
      checkedInAt: now,
    }));

    saveDb((draft) => {
      draft.fellowshipMeetings.unshift(meeting);
      draft.fellowshipMeetingAttendance.push(...attRows);
      input.newSouls?.forEach((s) => {
        if (s.fullName.trim()) {
          draft.soulsWon.unshift({
            id: uid('sw'),
            tenantId: input.tenantId,
            fullName: s.fullName.trim(),
            phoneNumber: formatPhoneNumber(s.phoneNumber),
            guardianName: '',
            guardianPhone: '',
            isChild: false,
            sourceType:
              input.unitType === FellowshipUnitType.BACENTA
                ? SoulSourceType.BACENTA_MEETING
                : SoulSourceType.CAMPUS_MEETING,
            sourceLabel: `${input.unitName} Meeting`,
            serviceId: null,
            fellowshipUnitId: input.unitId,
            wonDate: input.meetingDate,
            status: SoulStatus.NEW,
            notes: input.testimony.trim(),
            createdAt: now,
          });
        }
      });
    });

    return meeting;
  },

  getOutreaches(tenantId: string, unitIds?: string[]): FellowshipOutreach[] {
    return dbCache.fellowshipOutreaches
      .filter(
        (o) => o.tenantId === tenantId && (!unitIds || unitIds.includes(o.unitId))
      )
      .sort((a, b) => b.outreachDate.localeCompare(a.outreachDate));
  },

  submitOutreachReport(input: {
    tenantId: string;
    unitId: string;
    unitName: string;
    unitType: FellowshipUnitType;
    outreachDate: string;
    location: string;
    labourersCount: number;
    soulsWonCount: number;
    newSouls?: { fullName: string; phoneNumber: string }[];
    testimony: string;
    submittedBy: string;
  }): FellowshipOutreach {
    const now = new Date().toISOString();
    const outreach: FellowshipOutreach = {
      id: uid('fo'),
      tenantId: input.tenantId,
      unitId: input.unitId,
      outreachDate: input.outreachDate,
      location: input.location.trim(),
      labourersCount: Math.max(1, input.labourersCount),
      soulsWonCount: Math.max(0, input.soulsWonCount),
      testimony: input.testimony.trim(),
      submittedBy: input.submittedBy,
      createdAt: now,
    };

    saveDb((draft) => {
      draft.fellowshipOutreaches.unshift(outreach);
      input.newSouls?.forEach((s) => {
        if (s.fullName.trim()) {
          draft.soulsWon.unshift({
            id: uid('sw'),
            tenantId: input.tenantId,
            fullName: s.fullName.trim(),
            phoneNumber: formatPhoneNumber(s.phoneNumber),
            guardianName: '',
            guardianPhone: '',
            isChild: false,
            sourceType:
              input.unitType === FellowshipUnitType.BACENTA
                ? SoulSourceType.BACENTA_OUTREACH
                : SoulSourceType.CAMPUS_OUTREACH,
            sourceLabel: `${input.unitName} Outreach`,
            serviceId: null,
            fellowshipUnitId: input.unitId,
            wonDate: input.outreachDate,
            status: SoulStatus.NEW,
            notes: input.testimony.trim(),
            createdAt: now,
          });
        }
      });
    });

    return outreach;
  },

  submitUnitFinance(input: {
    tenantId: string;
    unitId: string;
    unitName: string;
    unitType: FellowshipUnitType;
    category: FinanceCategory.OFFERTORY | FinanceCategory.TITHE;
    amount: number;
    paymentMethod: 'Cash' | 'Mobile Money' | 'Bank Transfer';
    referenceCode?: string;
    transactionDate: string;
    recordedBy: string;
  }): FinanceTransaction {
    const dept = DepartmentService.getDepartmentByCode(
      input.tenantId,
      input.unitType === FellowshipUnitType.BACENTA
        ? DepartmentCode.BACENTA
        : DepartmentCode.CAMPUSES
    );
    const tx: FinanceTransaction = {
      id: uid('ft'),
      tenantId: input.tenantId,
      type: FinanceType.INCOME,
      category: input.category,
      sourceScope:
        input.unitType === FellowshipUnitType.BACENTA
          ? FinanceScope.BACENTA_MEETING
          : FinanceScope.CAMPUS_MEETING,
      serviceId: null,
      departmentId: dept?.id ?? null,
      partnerId: null,
      memberId: null,
      fellowshipUnitId: input.unitId,
      requisitionId: null,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      referenceCode:
        input.referenceCode?.trim() || `FLW-${Date.now().toString().slice(-5)}`,
      description: `${input.unitName} Meeting ${input.category}`,
      isVerified: true,
      transactionDate: input.transactionDate,
      recordedBy: input.recordedBy,
      createdAt: new Date().toISOString(),
    };

    saveDb((draft) => {
      draft.financeTransactions.unshift(tx);
    });
    return tx;
  },
};

// ─── TELE PASTORING, 3-MISSED SERVICES & 4-WEEK SOULS SERVICE ─────────────────

export interface AbsenteeItem {
  personId: string;
  fullName: string;
  phoneNumber: string;
  secondaryLabel: string;
  missedServicesCount: number;
  lastAttendedDate: string | null;
  followup: AbsenteeFollowup | null;
}

export const TelePastoringService = {
  /**
   * Computes members or children who spent the last 3 consecutive services without attending
   */
  getThreeServiceAbsentees(
    tenantId: string,
    personType: 'ADULT' | 'CHILD'
  ): AbsenteeItem[] {
    const sortedServices = [...dbCache.services]
      .filter((s) => s.tenantId === tenantId)
      .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));

    if (sortedServices.length < 3) return [];

    const lastThree = sortedServices.slice(0, 3);
    const lastThreeIds = new Set(lastThree.map((s) => s.id));
    const oldestOfThreeDate = lastThree[lastThree.length - 1].serviceDate;

    if (personType === 'CHILD') {
      const eligibleKids = dbCache.children.filter(
        (c) => c.tenantId === tenantId && c.isActive && c.joinedAt <= oldestOfThreeDate
      );
      return eligibleKids
        .filter((child) => {
          const attendedAny = dbCache.childAttendance.some(
            (ca) => ca.childId === child.id && lastThreeIds.has(ca.serviceId)
          );
          return !attendedAny;
        })
        .map((child) => {
          const pastVisits = dbCache.childAttendance
            .filter((ca) => ca.childId === child.id)
            .map(
              (ca) => dbCache.services.find((s) => s.id === ca.serviceId)?.serviceDate ?? ''
            )
            .filter(Boolean)
            .sort()
            .reverse();

          const followup =
            dbCache.absenteeFollowups.find(
              (f) => f.tenantId === tenantId && f.childId === child.id
            ) ?? null;

          return {
            personId: child.id,
            fullName: child.fullName,
            phoneNumber: child.guardianPhone,
            secondaryLabel: `Guardian: ${child.guardianName} (${child.ageGroup})`,
            missedServicesCount: 3,
            lastAttendedDate: pastVisits[0] ?? null,
            followup,
          };
        });
    }

    const eligibleAdults = dbCache.members.filter(
      (m) => m.tenantId === tenantId && m.isActive && m.joinedAt <= oldestOfThreeDate
    );

    return eligibleAdults
      .filter((member) => {
        const attendedAny = dbCache.serviceAttendance.some(
          (sa) => sa.memberId === member.id && lastThreeIds.has(sa.serviceId)
        );
        return !attendedAny;
      })
      .map((member) => {
        const pastVisits = dbCache.serviceAttendance
          .filter((sa) => sa.memberId === member.id)
          .map(
            (sa) => dbCache.services.find((s) => s.id === sa.serviceId)?.serviceDate ?? ''
          )
          .filter(Boolean)
          .sort()
          .reverse();

        const followup =
          dbCache.absenteeFollowups.find(
            (f) => f.tenantId === tenantId && f.memberId === member.id
          ) ?? null;

        return {
          personId: member.id,
          fullName: member.fullName,
          phoneNumber: member.phoneNumber,
          secondaryLabel: member.residence || 'General',
          missedServicesCount: 3,
          lastAttendedDate: pastVisits[0] ?? null,
          followup,
        };
      });
  },

  saveAbsenteeFollowup(input: {
    tenantId: string;
    personType: 'ADULT' | 'CHILD';
    personId: string;
    status: AbsenteeStatus;
    comment: string;
    followedBy: string;
  }): AbsenteeFollowup {
    const now = new Date().toISOString();
    let result!: AbsenteeFollowup;

    saveDb((draft) => {
      const existing = draft.absenteeFollowups.find(
        (f) =>
          f.tenantId === input.tenantId &&
          (input.personType === 'ADULT'
            ? f.memberId === input.personId
            : f.childId === input.personId)
      );
      if (existing) {
        existing.status = input.status;
        existing.comment = input.comment.trim();
        existing.followedBy = input.followedBy;
        existing.updatedAt = now;
        result = existing;
      } else {
        result = {
          id: uid('af'),
          tenantId: input.tenantId,
          personType: input.personType,
          memberId: input.personType === 'ADULT' ? input.personId : null,
          childId: input.personType === 'CHILD' ? input.personId : null,
          missedServicesCount: 3,
          status: input.status,
          comment: input.comment.trim(),
          followedBy: input.followedBy,
          updatedAt: now,
        };
        draft.absenteeFollowups.unshift(result);
      }
    });

    return result;
  },

  getReachouts(tenantId: string, memberId?: string): TeleReachout[] {
    return dbCache.teleReachouts
      .filter((r) => r.tenantId === tenantId && (!memberId || r.memberId === memberId))
      .sort((a, b) => b.reachoutDate.localeCompare(a.reachoutDate));
  },

  submitReachout(input: {
    tenantId: string;
    memberId: string;
    serviceId?: string | null;
    mode: ReachoutMode;
    labourersCount?: number | null;
    amountSpentOrSent: number;
    comment: string;
    reachoutDate: string;
    reachedBy: string;
  }): TeleReachout {
    const now = new Date().toISOString();
    const teleDept = DepartmentService.getDepartmentByCode(
      input.tenantId,
      DepartmentCode.TELE_PASTORING
    );
    const member = dbCache.members.find((m) => m.id === input.memberId);

    let financeTxId: string | null = null;
    let expenseTx: FinanceTransaction | null = null;

    if (input.amountSpentOrSent > 0) {
      financeTxId = uid('ft');
      expenseTx = {
        id: financeTxId,
        tenantId: input.tenantId,
        type: FinanceType.EXPENSE,
        category: FinanceCategory.TELE_REACHOUT_EXPENSE,
        sourceScope: input.serviceId ? FinanceScope.SERVICE : FinanceScope.DEPARTMENT,
        serviceId: input.serviceId ?? null,
        departmentId: teleDept?.id ?? null,
        partnerId: null,
        memberId: input.memberId,
        fellowshipUnitId: null,
        requisitionId: null,
        amount: input.amountSpentOrSent,
        paymentMethod: input.mode === ReachoutMode.PHONE_CALL ? 'Mobile Money' : 'Cash',
        referenceCode: `TR-${Date.now().toString().slice(-5)}`,
        description: `Tele-Pastoring ${
          input.mode === ReachoutMode.PHYSICAL_VISIT ? 'Physical Visit' : 'Phone Support'
        } — ${member?.fullName ?? 'Member'}`,
        isVerified: true,
        transactionDate: input.reachoutDate,
        recordedBy: input.reachedBy,
        createdAt: now,
      };
    }

    const reachout: TeleReachout = {
      id: uid('tr'),
      tenantId: input.tenantId,
      memberId: input.memberId,
      serviceId: input.serviceId ?? null,
      mode: input.mode,
      labourersCount:
        input.mode === ReachoutMode.PHYSICAL_VISIT
          ? Math.max(1, input.labourersCount || 1)
          : null,
      amountSpent: Math.max(0, input.amountSpentOrSent || 0),
      comment: input.comment.trim(),
      financeTransactionId: financeTxId,
      reachedBy: input.reachedBy,
      reachoutDate: input.reachoutDate,
      createdAt: now,
    };

    saveDb((draft) => {
      draft.teleReachouts.unshift(reachout);
      if (expenseTx) {
        draft.financeTransactions.unshift(expenseTx);
      }
    });

    return reachout;
  },

  getSoulsWon(tenantId: string, options?: { onlyChildren?: boolean }): SoulWon[] {
    return dbCache.soulsWon
      .filter(
        (s) =>
          s.tenantId === tenantId &&
          (options?.onlyChildren === undefined || s.isChild === options.onlyChildren)
      )
      .sort((a, b) => b.wonDate.localeCompare(a.wonDate));
  },

  addSoulWon(input: {
    tenantId: string;
    fullName: string;
    phoneNumber: string;
    guardianName?: string;
    guardianPhone?: string;
    isChild: boolean;
    sourceType: SoulSourceType;
    sourceLabel: string;
    serviceId?: string | null;
    fellowshipUnitId?: string | null;
    wonDate: string;
    notes?: string;
  }): SoulWon {
    const record: SoulWon = {
      id: uid('sw'),
      tenantId: input.tenantId,
      fullName: input.fullName.trim(),
      phoneNumber: formatPhoneNumber(input.phoneNumber),
      guardianName: input.guardianName?.trim() || '',
      guardianPhone: input.guardianPhone ? formatPhoneNumber(input.guardianPhone) : '',
      isChild: input.isChild,
      sourceType: input.sourceType,
      sourceLabel: input.sourceLabel,
      serviceId: input.serviceId ?? null,
      fellowshipUnitId: input.fellowshipUnitId ?? null,
      wonDate: input.wonDate,
      status: SoulStatus.NEW,
      notes: input.notes?.trim() || '',
      createdAt: new Date().toISOString(),
    };
    saveDb((draft) => {
      draft.soulsWon.unshift(record);
    });
    return record;
  },

  getSoulFollowupWeeks(tenantId: string, soulId?: string): SoulFollowupWeek[] {
    return dbCache.soulFollowupWeeks
      .filter((w) => w.tenantId === tenantId && (!soulId || w.soulId === soulId))
      .sort((a, b) => a.weekNumber - b.weekNumber);
  },

  recordSoulFollowupWeek(input: {
    tenantId: string;
    soulId: string;
    weekNumber: 1 | 2 | 3 | 4;
    contactMode: ReachoutMode;
    attendedService: boolean;
    comment: string;
    completedBy: string;
  }): void {
    const now = new Date().toISOString();
    saveDb((draft) => {
      const existing = draft.soulFollowupWeeks.find(
        (w) => w.soulId === input.soulId && w.weekNumber === input.weekNumber
      );
      if (existing) {
        existing.contactMode = input.contactMode;
        existing.attendedService = input.attendedService;
        existing.comment = input.comment.trim();
        existing.completedBy = input.completedBy;
        existing.completedAt = now;
      } else {
        draft.soulFollowupWeeks.push({
          id: uid('sfw'),
          tenantId: input.tenantId,
          soulId: input.soulId,
          weekNumber: input.weekNumber,
          contactMode: input.contactMode,
          attendedService: input.attendedService,
          comment: input.comment.trim(),
          completedBy: input.completedBy,
          completedAt: now,
        });
      }

      // Advance soul status up to INTEGRATED once all 4 weeks are logged
      const soul = draft.soulsWon.find((s) => s.id === input.soulId);
      if (soul) {
        const completedCount = draft.soulFollowupWeeks.filter(
          (w) => w.soulId === input.soulId
        ).length;
        if (completedCount >= 4) {
          soul.status = SoulStatus.INTEGRATED;
        } else {
          const maxWeek = Math.max(
            ...draft.soulFollowupWeeks
              .filter((w) => w.soulId === input.soulId)
              .map((w) => w.weekNumber)
          );
          const statusMap: Record<number, SoulStatus> = {
            1: SoulStatus.WEEK_1,
            2: SoulStatus.WEEK_2,
            3: SoulStatus.WEEK_3,
            4: SoulStatus.INTEGRATED,
          };
          soul.status = statusMap[maxWeek] ?? SoulStatus.WEEK_1;
        }
      }
    });
  },
};



// ─── SUBSCRIPTION (UGX 50,000 / month, 7-day trial) ──────────────────────────

export const SUBSCRIPTION_FEE = 50000;
export const TRIAL_DAYS = 7;
/** How many days before the end date the Admin starts seeing "payment due". */
export const DUE_SOON_DAYS = 3;

export type SubscriptionPhase = 'trial' | 'active' | 'due' | 'expired';

export interface SubscriptionState {
  phase: SubscriptionPhase;
  /** Still inside the free trial (phase may be 'trial', 'due' or 'expired'). */
  isTrial: boolean;
  /** When access ends (trial end or paid-until date). */
  endsAt: Date;
  /** Whole days left, never below 0. */
  daysLeft: number;
  /** Day of the 7-day trial (1–7), only meaningful while isTrial. */
  trialDay: number;
  fee: number;
}

const addOneMonth = (from: Date): Date => {
  const d = new Date(from);
  const day = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() < day) d.setDate(0); // 31 Jan → 28/29 Feb
  return d;
};

export const SubscriptionService = {
  getState(tenant: Tenant | null, now: Date = new Date()): SubscriptionState | null {
    if (!tenant) return null;
    const fee = tenant.monthlyFee || SUBSCRIPTION_FEE;
    const isTrial = (tenant.subscriptionStatus ?? 'TRIALING') === 'TRIALING';
    const endIso = isTrial ? tenant.trialEndsAt : tenant.subscriptionEndsAt;
    const endsAt = endIso
      ? new Date(endIso)
      : new Date(new Date(tenant.createdAt).getTime() + TRIAL_DAYS * DAY_MS);
    const msLeft = endsAt.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / DAY_MS));
    const trialDay = Math.min(TRIAL_DAYS, Math.max(1, TRIAL_DAYS - daysLeft + 1));

    let phase: SubscriptionPhase;
    if (tenant.subscriptionStatus === 'PAST_DUE' || tenant.subscriptionStatus === 'SUSPENDED' || msLeft <= 0) {
      phase = 'expired';
    } else if (msLeft <= DUE_SOON_DAYS * DAY_MS) {
      phase = 'due';
    } else {
      phase = isTrial ? 'trial' : 'active';
    }
    return { phase, isTrial, endsAt, daysLeft, trialDay, fee };
  },

  getPayments(tenantId: string): SubscriptionPayment[] {
    return (dbCache.subscriptionPayments ?? [])
      .filter((p) => p.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Syncs a backend-returned SubscriptionPayment (and optional updated Tenant) into the local reactive store. */
  syncPaymentAndTenant(payment: SubscriptionPayment, tenant?: Tenant | null): SubscriptionPayment {
    const normalizedPayment: SubscriptionPayment = {
      ...payment,
      amount: Number(payment.amount),
    };
    saveDb((draft) => {
      const list = [...(draft.subscriptionPayments ?? [])];
      const idx = list.findIndex(
        (p) => p.id === normalizedPayment.id || p.referenceNumber === normalizedPayment.referenceNumber
      );
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...normalizedPayment };
      } else {
        list.unshift(normalizedPayment);
      }
      draft.subscriptionPayments = list;

      if (tenant) {
        const tIdx = draft.tenants.findIndex((t) => t.id === tenant.id);
        if (tIdx >= 0) {
          draft.tenants[tIdx] = {
            ...draft.tenants[tIdx],
            ...tenant,
            monthlyFee: Number(tenant.monthlyFee ?? draft.tenants[tIdx].monthlyFee ?? 50000),
          };
        }
      }
    });
    return normalizedPayment;
  },

  /**
   * Initiates a real MarzPay Mobile Money (MTN / Airtel) or Card subscription collection via the backend.
   * Status starts as PENDING; never marks the church paid until MarzPay confirms completion.
   */
  async initiateMarzPayCollection(input: {
    method: 'MTN_MOMO' | 'AIRTEL_MONEY' | 'VISA';
    phoneNumber?: string;
  }): Promise<{
    payment: SubscriptionPayment;
    marzpayStatus: string;
    redirectUrl: string | null;
    sandboxMode: boolean;
    message: string;
  }> {
    const res = await apiClient.post<{
      payment: SubscriptionPayment;
      marzpayStatus: string;
      redirectUrl: string | null;
      sandboxMode: boolean;
      message: string;
    }>('/billing/subscription/collect', input);

    const synced = SubscriptionService.syncPaymentAndTenant(res.payment);
    return { ...res, payment: synced };
  },

  /** Polls the backend (which checks PostgreSQL + MarzPay GET /collect-money/{uuid}) for final confirmation. */
  async checkMarzPayPaymentStatus(referenceNumber: string): Promise<{
    status: SubscriptionPayment['status'];
    marzpayStatus: string;
    payment: SubscriptionPayment;
    tenant: Tenant | null;
  }> {
    const res = await apiClient.get<{
      status: SubscriptionPayment['status'];
      marzpayStatus: string;
      payment: SubscriptionPayment;
      tenant: Tenant | null;
    }>(`/billing/subscription/payments/${encodeURIComponent(referenceNumber)}/status`);

    const synced = SubscriptionService.syncPaymentAndTenant(res.payment, res.tenant);
    return { ...res, payment: synced };
  },

  /**
   * Offline fallback helper — records one month's payment locally.
   */
  recordPayment(input: {
    tenantId: string;
    method: SubscriptionPayment['paymentMethod'];
    phoneOrAccount: string;
    referenceNumber?: string;
    recordedBy?: string;
  }): SubscriptionPayment {
    const tenant = dbCache.tenants.find((t) => t.id === input.tenantId);
    if (!tenant) throw new Error('Church not found');
    const state = SubscriptionService.getState(tenant)!;
    const now = new Date();
    const start = state.phase !== 'expired' && state.endsAt > now ? state.endsAt : now;
    const end = addOneMonth(start);
    const payment: SubscriptionPayment = {
      id: uid('pay'),
      tenantId: tenant.id,
      amount: state.fee,
      currency: 'UGX',
      paymentMethod: input.method,
      referenceNumber:
        input.referenceNumber ||
        `MP${now.toISOString().slice(2, 10).replace(/-/g, '')}.${now.getHours()}${now.getMinutes()}.${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      phoneOrAccount: input.phoneOrAccount ? formatPhoneNumber(input.phoneOrAccount) : '',
      status: 'COMPLETED',
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      recordedBy: input.recordedBy,
      createdAt: now.toISOString(),
    };
    saveDb((draft) => {
      draft.subscriptionPayments = [...(draft.subscriptionPayments ?? []), payment];
      const t = draft.tenants.find((x) => x.id === tenant.id);
      if (t) {
        t.subscriptionStatus = 'ACTIVE';
        t.subscriptionEndsAt = end.toISOString();
        t.lastPaidAt = now.toISOString();
      }
    });
    return payment;
  },
};


// ─── GET STARTED (a new church's pastor finishes setup) ───────────────────────

const isOffline = (err: unknown) =>
  /failed to fetch|networkerror|load failed/i.test(err instanceof Error ? err.message : String(err));

export type ChurchProfileInput = {
  name: string;
  shortName: string;
  logoUrl?: string;
  city: string;
  country: string;
  currency: string;
  timezone: string;
  address: string;
  phone: string;
  email: string;
  launchDate: string;
};

export interface DepartmentInviteResult {
  sent: boolean;
  recipientEmail: string;
  signInUrl?: string;
  message: string;
}

export const SetupService = {
  /** Saves the church info the Network Council entered (edited by the pastor). */
  async saveChurch(tenantId: string, input: ChurchProfileInput): Promise<Tenant> {
    const clean = {
      ...input,
      name: input.name.trim(),
      shortName: input.shortName.trim(),
      city: input.city.trim(),
      address: input.address.trim(),
      phone: input.phone ? formatPhoneNumber(input.phone) : '',
      email: input.email.trim().toLowerCase(),
    };
    try {
      const res = await apiClient.patch<{ tenant: Tenant }>('/setup/church', clean);
      PlatformService.syncBackendEntities({ tenant: res.tenant });
      return res.tenant;
    } catch (err) {
      if (!isOffline(err)) throw err;
      let saved: Tenant | null = null;
      saveDb((draft) => {
        const t = draft.tenants.find((x) => x.id === tenantId);
        if (t) {
          Object.assign(t, clean, { logoUrl: clean.logoUrl || t.logoUrl });
          saved = { ...t };
        }
      });
      if (!saved) throw new Error('Church not found');
      return saved;
    }
  },

  /** Adds department heads; each signs in with Google using this email and receives an invite email. */
  async addDepartmentHeads(
    tenantId: string,
    heads: { code: DepartmentCode; name: string; email: string; phone: string }[]
  ): Promise<{ users: User[]; invites: DepartmentInviteResult[] }> {
    try {
      const res = await apiClient.post<{ users: User[]; invites?: DepartmentInviteResult[] }>(
        '/setup/department-heads',
        { heads }
      );
      PlatformService.syncBackendEntities({ users: res.users });
      return { users: res.users, invites: res.invites ?? [] };
    } catch (err) {
      if (!isOffline(err)) throw err;
      const users = heads.map((h) => {
        const dept = DepartmentService.getDepartmentByCode(tenantId, h.code);
        return PlatformService.createUser({
          tenantId,
          fullName: h.name,
          email: h.email,
          phoneNumber: h.phone,
          role: HEAD_ROLE_BY_DEPT[h.code],
          departmentId: dept?.id ?? null,
        });
      });
      const invites: DepartmentInviteResult[] = users.map((u) => ({
        sent: false,
        recipientEmail: u.email,
        signInUrl: `${window.location.origin}/login?email=${encodeURIComponent(u.email)}`,
        message: 'Saved offline — backend was unreachable so the invite email was not sent.',
      }));
      return { users, invites };
    }
  },

  /** Resends the department head welcome email for an already-added leader. */
  async resendDepartmentHeadInvite(userId: string): Promise<DepartmentInviteResult> {
    const res = await apiClient.post<{ invite: DepartmentInviteResult }>(
      `/setup/department-heads/${encodeURIComponent(userId)}/resend-invite`
    );
    return res.invite;
  },

  /** Starts the 7-day free trial from today (once). */
  async startTrial(tenantId: string): Promise<Tenant> {
    try {
      const res = await apiClient.post<{ tenant: Tenant }>('/setup/start-trial');
      PlatformService.syncBackendEntities({ tenant: res.tenant });
      return res.tenant;
    } catch (err) {
      if (!isOffline(err)) throw err;
      let saved: Tenant | null = null;
      saveDb((draft) => {
        const t = draft.tenants.find((x) => x.id === tenantId);
        if (t) {
          if (!t.setupCompletedAt) {
            t.setupCompletedAt = new Date().toISOString();
            t.subscriptionStatus = 'TRIALING';
            t.trialEndsAt = new Date(Date.now() + 7 * DAY_MS).toISOString();
          }
          saved = { ...t };
        }
      });
      if (!saved) throw new Error('Church not found');
      return saved;
    }
  },
};

export const HEAD_ROLE_BY_DEPT: Record<DepartmentCode, UserRole> = {
  [DepartmentCode.ADMIN]: UserRole.ADMIN,
  [DepartmentCode.FINANCE]: UserRole.FINANCE_HOD,
  [DepartmentCode.BACENTA]: UserRole.BACENTA_HOD,
  [DepartmentCode.AIRPORT_STARS]: UserRole.AIRPORT_HOD,
  [DepartmentCode.TELE_PASTORING]: UserRole.TELE_HOD,
  [DepartmentCode.CHILDRENS_CHURCH]: UserRole.CHILDREN_HOD,
  [DepartmentCode.CAMPUSES]: UserRole.CAMPUS_HOD,
};


// ─── NETWORK COUNCIL: subscriptions wallet ────────────────────────────────────

/** Read-only view of the local store (for summaries and dashboards). */
export const readStore = (): OpenChurchDatabase => dbCache;

export type ManualPaymentMethod = 'MTN_MOMO' | 'AIRTEL_MONEY' | 'BANK_TRANSFER' | 'CASH';

export const CouncilService = {
  /** Records a bank / MoMo Pay / cash payment for a church and unlocks it. */
  async recordManualPayment(
    tenantId: string,
    input: { months: number; method: ManualPaymentMethod; referenceNumber: string; paidOn: string }
  ): Promise<SubscriptionPayment> {
    try {
      const res = await apiClient.post<{ payment: SubscriptionPayment; tenant: Tenant }>(
        `/platform/tenants/${tenantId}/payments`,
        input
      );
      return SubscriptionService.syncPaymentAndTenant(res.payment, res.tenant);
    } catch (err) {
      if (!/failed to fetch|networkerror|load failed/i.test(err instanceof Error ? err.message : String(err))) throw err;
      const tenant = dbCache.tenants.find((t) => t.id === tenantId);
      if (!tenant) throw new Error('Church not found');
      const st = SubscriptionService.getState(tenant)!;
      const now = new Date();
      const start = st.phase !== 'expired' && st.endsAt > now ? st.endsAt : now;
      let end = start;
      for (let i = 0; i < Math.max(1, input.months); i++) end = addOneMonth(end);
      const paidAt = input.paidOn ? new Date(input.paidOn) : now;
      const payment: SubscriptionPayment = {
        id: uid('pay'),
        tenantId,
        amount: st.fee * Math.max(1, input.months),
        currency: tenant.currency || 'UGX',
        paymentMethod: (input.method === 'CASH' ? 'BANK_TRANSFER' : input.method) as SubscriptionPayment['paymentMethod'],
        referenceNumber: input.referenceNumber || `MANUAL-${Date.now().toString(36).toUpperCase()}`,
        phoneOrAccount: '',
        status: 'COMPLETED',
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        completedAt: paidAt.toISOString(),
        createdAt: paidAt.toISOString(),
      };
      return SubscriptionService.syncPaymentAndTenant(payment, {
        ...tenant,
        status: 'ACTIVE',
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: end.toISOString(),
        lastPaidAt: paidAt.toISOString(),
      });
    }
  },

  /** Suspends or reactivates a church (Network Council). */
  async toggleChurch(tenantId: string): Promise<void> {
    try {
      const res = await apiClient.patch<{ data: Tenant }>(`/platform/tenants/${tenantId}/toggle`);
      if (res?.data) PlatformService.syncBackendEntities({ tenant: { ...res.data, monthlyFee: Number(res.data.monthlyFee) } });
      else PlatformService.toggleTenantStatus(tenantId);
    } catch (err) {
      if (!/failed to fetch|networkerror|load failed/i.test(err instanceof Error ? err.message : String(err))) throw err;
      PlatformService.toggleTenantStatus(tenantId);
    }
  },
};
