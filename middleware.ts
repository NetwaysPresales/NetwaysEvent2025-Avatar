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

  // Check direct environment variable first (faster and works if not using Key Vault)
  if (process.env.NEXTAUTH_SECRET) {
    cachedSecret = process.env.NEXTAUTH_SECRET;
    return cachedSecret;
  }

  try {
    cachedSecret = await getSecret('NEXTAUTH_SECRET');
    return cachedSecret;
  } catch {
    // Fallback for development
    if (process.env.NODE_ENV === 'development') {
      cachedSecret = 'development-secret-change-in-production';
      return cachedSecret;
    }
    // In production, log error but return a fallback so middleware doesn't completely break
    console.error('NEXTAUTH_SECRET not found - authentication may not work correctly');
    cachedSecret = 'fallback-secret-invalid';
    return cachedSecret;
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

  try {
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
      const baseUrl = request.nextUrl.origin;
      const signInUrl = new URL('/auth/signin', baseUrl);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  } catch (error) {
    // If middleware fails, log and redirect to signin as fallback
    console.error('[Middleware] Error:', error);
    const baseUrl = request.nextUrl.origin;
    const signInUrl = new URL('/auth/signin', baseUrl);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }
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

