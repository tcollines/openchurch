import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Ensuring Network Council owner account in Supabase PostgreSQL...');
  const passwordHash = await bcrypt.hash('openchurch123', 10);

  await prisma.user.upsert({
    where: { email: 'tcollines004@gmail.com' },
    update: {
      role: 'PLATFORM_ADMIN',
      fullName: 'Collines (Network Council)',
      tenantId: null,
      isActive: true,
    },
    create: {
      fullName: 'Collines (Network Council)',
      email: 'tcollines004@gmail.com',
      passwordHash,
      phoneNumber: '+256770000004',
      role: 'PLATFORM_ADMIN',
      tenantId: null,
      isActive: true,
    },
  });

  console.log('Network Council account ready (tcollines004@gmail.com). Zero demo churches seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
