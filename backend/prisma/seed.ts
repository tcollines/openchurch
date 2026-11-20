import bcrypt from 'bcryptjs';
import { DepartmentCode, PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const DEPARTMENTS: { code: DepartmentCode; name: string; description: string }[] = [
  {
    code: 'ADMIN',
    name: 'Administration',
    description: 'Overall church oversight, attendance %, budgets, finance & serving members',
  },
  {
    code: 'FINANCE',
    name: 'Finance Department',
    description: 'Per-service Offertory, Tithe, Partner-linked Partnership & payouts',
  },
  {
    code: 'BACENTA',
    name: 'Bacenta Ministry',
    description: 'Micro-church home fellowships, outreach reports, attendance & meeting offerings',
  },
  {
    code: 'AIRPORT_STARS',
    name: 'Airport Stars',
    description: 'Service creation, rapid member check-in & first-timer registration',
  },
  {
    code: 'TELE_PASTORING',
    name: 'Tele Pastoring',
    description: '3-missed-services retention, physical/phone reachouts & 4-week soul care',
  },
  {
    code: 'CHILDRENS_CHURCH',
    name: "Children's Church",
    description: 'Service check-in, child salvations & 3-missed-services guardian follow-up',
  },
  {
    code: 'CAMPUSES',
    name: 'Campuses Ministry',
    description: 'University & school campus fellowships, outreach reports & offerings',
  },
];

async function main() {
  console.log('Seeding Open Church into Supabase PostgreSQL via Prisma...');
  const passwordHash = await bcrypt.hash('openchurch123', 10);

  // 1. Network Council Super-Admins
  const councilUsers = [
    {
      fullName: 'Apostle Grace Overseer',
      email: 'council@openchurch.org',
      phoneNumber: '+256770000001',
    },
    {
      fullName: 'Collines (Network Council)',
      email: 'tcollines004@gmail.com',
      phoneNumber: '+256770000004',
    },
  ];

  for (const c of councilUsers) {
    await prisma.user.upsert({
      where: { email: c.email },
      update: { role: 'PLATFORM_ADMIN', fullName: c.fullName },
      create: {
        fullName: c.fullName,
        email: c.email,
        passwordHash,
        phoneNumber: c.phoneNumber,
        role: 'PLATFORM_ADMIN',
      },
    });
  }

  // 2. Kampala Central Church Tenant with 7-Day Trial & 50,000 UGX Subscription
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const kampala = await prisma.tenant.upsert({
    where: { slug: 'kampala-central' },
    update: {
      subscriptionStatus: 'TRIALING',
      monthlyFee: 50000,
      trialEndsAt: sevenDaysFromNow,
    },
    create: {
      name: '1000 Micro Church — Kampala Central',
      slug: 'kampala-central',
      currency: 'UGX',
      city: 'Kampala',
      country: 'Uganda',
      subscriptionStatus: 'TRIALING',
      monthlyFee: 50000,
      trialEndsAt: sevenDaysFromNow,
    },
  });

  // 3. Seed all 7 Core Departments
  for (const d of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { tenantId_code: { tenantId: kampala.id, code: d.code } },
      update: {},
      create: {
        tenantId: kampala.id,
        code: d.code,
        name: d.name,
        description: d.description,
      },
    });
  }

  const deptList = await prisma.department.findMany({
    where: { tenantId: kampala.id },
  });
  const byCode = (code: DepartmentCode) =>
    deptList.find((d) => d.code === code)?.id ?? null;

  // 4. Seed Initial Bacenta & Campus (Idempotent)
  let ntindaBacenta = await prisma.fellowshipUnit.findFirst({
    where: { tenantId: kampala.id, name: 'Ntinda Grace Bacenta' },
  });
  if (!ntindaBacenta) {
    ntindaBacenta = await prisma.fellowshipUnit.create({
      data: {
        tenantId: kampala.id,
        unitType: 'BACENTA',
        name: 'Ntinda Grace Bacenta',
        locationOrInstitution: 'Ntinda Ministers Village',
        meetingDay: 'Wednesday 6:00 PM',
        leaderName: 'Bro. Samuel Okello',
        leaderPhone: '+256772310401',
      },
    });
  }

  let mukCampus = await prisma.fellowshipUnit.findFirst({
    where: { tenantId: kampala.id, name: 'Makerere University (MUK) Campus' },
  });
  if (!mukCampus) {
    mukCampus = await prisma.fellowshipUnit.create({
      data: {
        tenantId: kampala.id,
        unitType: 'CAMPUS',
        name: 'Makerere University (MUK) Campus',
        locationOrInstitution: 'Makerere University Main Hall',
        meetingDay: 'Friday 5:00 PM',
        leaderName: 'Bro. Joshua Kato',
        leaderPhone: '+256754112233',
      },
    });
  }

  // 5. Seed Department Users (Default password: openchurch123)
  const roleAccounts: {
    fullName: string;
    email: string;
    phone: string;
    role: UserRole;
    deptCode: DepartmentCode;
    unitId?: string;
  }[] = [
    { fullName: 'Pastor Daniel Ssebuga', email: 'admin@kampala.openchurch.org', phone: '+256772100100', role: 'ADMIN', deptCode: 'ADMIN' },
    { fullName: 'Sarah Namubiru', email: 'finance.hod@kampala.openchurch.org', phone: '+256772100200', role: 'FINANCE_HOD', deptCode: 'FINANCE' },
    { fullName: 'Timothy Kiggundu', email: 'finance@kampala.openchurch.org', phone: '+256772100201', role: 'FINANCE_OFFICER', deptCode: 'FINANCE' },
    { fullName: 'Elder Moses Byaruhanga', email: 'bacenta.hod@kampala.openchurch.org', phone: '+256772100300', role: 'BACENTA_HOD', deptCode: 'BACENTA' },
    { fullName: 'Bro. Samuel Okello', email: 'ntinda.bacenta@kampala.openchurch.org', phone: '+256772310401', role: 'BACENTA_LEADER', deptCode: 'BACENTA', unitId: ntindaBacenta.id },
    { fullName: 'Rebecca Kyomugisha', email: 'airport.hod@kampala.openchurch.org', phone: '+256772100400', role: 'AIRPORT_HOD', deptCode: 'AIRPORT_STARS' },
    { fullName: 'Brian Wasswa', email: 'checkin@kampala.openchurch.org', phone: '+256772100401', role: 'AIRPORT_MEMBER', deptCode: 'AIRPORT_STARS' },
    { fullName: 'Pastor Ruth Nakato', email: 'tele.hod@kampala.openchurch.org', phone: '+256772100500', role: 'TELE_HOD', deptCode: 'TELE_PASTORING' },
    { fullName: 'Lydia Nansubuga', email: 'tele@kampala.openchurch.org', phone: '+256772100501', role: 'TELE_PASTOR', deptCode: 'TELE_PASTORING' },
    { fullName: 'Martha Asiimwe', email: 'children.hod@kampala.openchurch.org', phone: '+256772100600', role: 'CHILDREN_HOD', deptCode: 'CHILDRENS_CHURCH' },
    { fullName: 'Joy Babirye', email: 'children@kampala.openchurch.org', phone: '+256772100601', role: 'CHILDREN_WORKER', deptCode: 'CHILDRENS_CHURCH' },
    { fullName: 'Pastor Allan Tumwine', email: 'campuses.hod@kampala.openchurch.org', phone: '+256772100700', role: 'CAMPUS_HOD', deptCode: 'CAMPUSES' },
    { fullName: 'Bro. Joshua Kato', email: 'muk.campus@kampala.openchurch.org', phone: '+256754112233', role: 'CAMPUS_LEADER', deptCode: 'CAMPUSES', unitId: mukCampus.id },
  ];

  for (const acc of roleAccounts) {
    await prisma.user.upsert({
      where: { email: acc.email },
      update: {},
      create: {
        tenantId: kampala.id,
        fullName: acc.fullName,
        email: acc.email,
        passwordHash,
        phoneNumber: acc.phone,
        role: acc.role,
        departmentId: byCode(acc.deptCode),
        fellowshipUnitId: acc.unitId ?? null,
      },
    });
  }

  console.log('Seed complete! Default password for all accounts: openchurch123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

