import 'dotenv/config';
import { db } from '../src/lib/db';
import { PLATFORM_ADMIN_EMAIL } from '../src/lib/access-control';
import { hashPassword } from '../src/lib/password';

const SHARED_PROFILE_IDS = [
  '6402f32f-17b6-4ccc-9054-d45a610ec2f9',
  '538d934e-d0ce-4ed6-bf42-55d00d3eb5e0',
];

const approvedAccounts = [
  { email: PLATFORM_ADMIN_EMAIL, role: 'ADMIN' as const },
  { email: 'ghyouness@netways.com', role: 'USER' as const },
  { email: 'hbeydoun@netways.com', role: 'USER' as const },
  { email: 'rtaoun@netways.com', role: 'USER' as const },
  { email: 'anas.salam@erthzayed.ae', role: 'USER' as const },
  { email: 'noura.aldhaheri@erthzayed.ae', role: 'USER' as const },
];

async function main() {
  const initialPassword = process.env.INITIAL_USER_PASSWORD;
  if (!initialPassword || initialPassword.length < 12) throw new Error('INITIAL_USER_PASSWORD must contain at least 12 characters');
  await db.$transaction(async (transaction) => {
    await transaction.user.updateMany({
      data: { isActive: false, role: 'USER' },
    });
    for (const account of approvedAccounts) {
      const passwordHash = hashPassword(initialPassword);
      await transaction.user.upsert({
        where: { email: account.email },
        create: {
          email: account.email,
          role: account.role,
          isActive: true,
          passwordHash,
        },
        update: {
          role: account.role,
          isActive: true,
          passwordHash,
        },
      });
    }
    await transaction.profile.updateMany({ data: { isShared: false } });
    await transaction.profile.updateMany({
      where: { id: { in: SHARED_PROFILE_IDS } },
      data: { isShared: true },
    });
  });
  const users = await db.user.findMany({
    select: { email: true, role: true, isActive: true, passwordHash: true },
    orderBy: { email: 'asc' },
  });
  console.log(JSON.stringify(users.map((user) => ({
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    hasPassword: Boolean(user.passwordHash),
  })), null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
