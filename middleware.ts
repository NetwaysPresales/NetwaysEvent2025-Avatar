/**
 * Next.js Middleware
 * 
 * Protects API routes and adds userId to request headers.
 * Uses NextAuth JWT token verification.
 * 
 * IMPORTANT: This runs in Edge Runtime on Netlify, so we can only use
 * environment variables directly - no Node.js APIs or Key Vault.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Get NEXTAUTH_SECRET from environment variable (Edge runtime compatible)
function getNextAuthSecret(): string {
  // In Edge runtime, we can only access environment variables directly
  const secret = process.env.NEXTAUTH_SECRET;
  
  if (!secret) {
    // Fallback for development
    if (process.env.NODE_ENV === 'development') {
      return 'development-secret-change-in-production';
    }
    // In production, throw error if secret is missing
    console.error('[Middleware] NEXTAUTH_SECRET not found - authentication will fail');
    throw new Error('NEXTAUTH_SECRET environment variable is required');
  }
  
  return secret;
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
    const secret = getNextAuthSecret();
    
    // Protect API routes (except auth routes)
    if (pathname.startsWith('/api/')) {
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

