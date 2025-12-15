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

// NextAuth handler for App Router
// Initialize handlers with cached options
let nextAuthHandler: ((req: Request, context: { params: Promise<{ nextauth: string[] }> }) => Promise<Response>) | null = null;

async function getHandler() {
  if (!nextAuthHandler) {
    const options = await getAuthOptions();
    nextAuthHandler = NextAuth(options);
  }
  return nextAuthHandler;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const handler = await getHandler();
  if (!handler) {
    return new Response('NextAuth handler not initialized', { status: 500 });
  }
  return handler(req, context);
}

export async function POST(
  req: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const handler = await getHandler();
  if (!handler) {
    return new Response('NextAuth handler not initialized', { status: 500 });
  }
  return handler(req, context);
}

