/**
 * Authentication Helper Functions
 * 
 * Provides type-safe session access for API routes and server components.
 */

import { getServerSession } from 'next-auth';
import { getAuthOptions } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { PLATFORM_ADMIN_EMAIL } from '@/lib/access-control';

/**
 * Extended session type with userId
 */
export interface SessionWithUserId {
  user: {
    email: string;
    name?: string | null;
  };
  userId: string;
  accessToken?: string;
  role: 'ADMIN' | 'USER';
}

/**
 * Get the current session with userId
 * 
 * Use this in API routes and server components to get the authenticated user.
 * 
 * @returns Session with userId, or null if not authenticated
 * 
 * @example
 * ```typescript
 * const session = await getSession();
 * if (!session) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 * const userId = session.userId;
 * ```
 */
export async function getSession(): Promise<SessionWithUserId | null> {
  const authOptions = await getAuthOptions();
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return null;
  }

  // Type guard to check if session has userId
  const extendedSession = session as unknown as SessionWithUserId;
  if (!extendedSession.userId) {
    return null;
  }

  const platformUser = await db.user.findFirst({
    where: {
      id: extendedSession.userId,
      email: extendedSession.user.email.toLowerCase(),
      isActive: true,
    },
    select: { role: true },
  });
  if (!platformUser) return null;
  return { ...extendedSession, role: platformUser.role };
}

export async function requireAdmin(): Promise<SessionWithUserId> {
  const session = await requireAuth();
  if (session.role !== 'ADMIN' || session.user.email.toLowerCase() !== PLATFORM_ADMIN_EMAIL) throw new Error('Forbidden');
  return session;
}

/**
 * Require authentication - throws error if not authenticated
 * 
 * Use this in API routes when authentication is required.
 * 
 * @returns Session with userId
 * @throws Error if not authenticated
 * 
 * @example
 * ```typescript
 * const session = await requireAuth();
 * const userId = session.userId;
 * ```
 */
export async function requireAuth(): Promise<SessionWithUserId> {
  const session = await getSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

