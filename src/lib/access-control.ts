import { db } from './db';

export const PLATFORM_ADMIN_EMAIL = 'amm.alsaadi@gmail.com';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getActivePlatformUser(email: string) {
  return db.user.findUnique({
    where: { email: normalizeEmail(email) },
  }).then((user) => user?.isActive ? user : null);
}
