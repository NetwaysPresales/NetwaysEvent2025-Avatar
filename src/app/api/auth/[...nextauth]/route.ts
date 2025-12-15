/**
 * NextAuth.js Authentication Route Handler
 * 
 * Implements authentication with Azure AD B2C (production) and
 * Credentials provider (development/testing).
 * 
 * Uses JWT strategy for stateless sessions suitable for Azure App Service.
 */

import NextAuth from 'next-auth';
import { getAuthOptions } from '@/lib/auth-config';

// Cache the NextAuth handler once options are loaded
type NextAuthHandler = (req: Request, context: { params: Promise<{ nextauth: string[] }> }) => Promise<Response>;

let nextAuthHandler: NextAuthHandler | null = null;
let handlerPromise: Promise<NextAuthHandler> | null = null;

async function getHandler(): Promise<NextAuthHandler> {
  if (nextAuthHandler) {
    return nextAuthHandler;
  }
  
  if (!handlerPromise) {
    handlerPromise = (async (): Promise<NextAuthHandler> => {
      const authOptions = await getAuthOptions();
      return NextAuth(authOptions);
    })();
  }
  
  nextAuthHandler = await handlerPromise;
  return nextAuthHandler;
}

async function handler(req: Request, context: { params: Promise<{ nextauth: string[] }> }): Promise<Response> {
  const handlerFn = await getHandler();
  return handlerFn(req, context);
}

export { handler as GET, handler as POST };

