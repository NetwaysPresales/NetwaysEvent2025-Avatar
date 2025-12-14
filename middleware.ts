/**
 * Next.js Middleware
 * 
 * Protects API routes and adds userId to request headers.
 * Uses NextAuth JWT token verification.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSecret } from './src/lib/secrets';

// Cache the secret to avoid repeated async calls
let cachedSecret: string | null = null;

async function getNextAuthSecret(): Promise<string> {
  if (cachedSecret) {
    return cachedSecret;
  }

  try {
    cachedSecret = await getSecret('NEXTAUTH_SECRET');
    return cachedSecret;
  } catch {
    // Fallback for development
    if (process.env.NODE_ENV === 'development') {
      return 'development-secret-change-in-production';
    }
    throw new Error('NEXTAUTH_SECRET is required');
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip auth for public routes
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/auth/')
  ) {
    return NextResponse.next();
  }

  // Protect API routes (except auth routes)
  if (pathname.startsWith('/api/')) {
    const secret = await getNextAuthSecret();
    const token = await getToken({
      req: request,
      secret,
    });

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Add userId to request headers for API routes
    const requestHeaders = new Headers(request.headers);
    if (token.userId) {
      requestHeaders.set('x-user-id', token.userId as string);
    }
    if (token.email) {
      requestHeaders.set('x-user-email', token.email as string);
    }

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Protect routes that require authentication (root, /avatar, etc.)
  const secret = await getNextAuthSecret();
  const token = await getToken({
    req: request,
    secret,
  });

  if (!token) {
    // Redirect to sign in page
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

