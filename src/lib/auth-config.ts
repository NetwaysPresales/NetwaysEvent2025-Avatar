/**
 * NextAuth Configuration
 * 
 * Centralized NextAuth configuration that can be imported by both
 * route handlers and other server-side code.
 */

import { NextAuthOptions } from 'next-auth';
import AzureADB2CProvider from 'next-auth/providers/azure-ad-b2c';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getSecret } from '@/lib/secrets';
import { db } from '@/lib/db';

/**
 * Get or create user in database
 * Called on first login to sync user from Azure AD to our database
 */
async function getOrCreateUser(
  email: string,
  name: string | null,
  azureAdId: string | null
): Promise<string> {
  // Try to find existing user by email or Azure AD ID
  let user = await db.user.findFirst({
    where: {
      OR: [
        { email },
        ...(azureAdId ? [{ azureAdId }] : []),
      ],
    },
  });

  if (user) {
    // Update user if Azure AD ID is provided and not set
    if (azureAdId && !user.azureAdId) {
      user = await db.user.update({
        where: { id: user.id },
        data: { azureAdId },
      });
    }
    // Update name if provided and different
    if (name && user.name !== name) {
      user = await db.user.update({
        where: { id: user.id },
        data: { name },
      });
    }
    return user.id;
  }

  // Create new user
  const newUser = await db.user.create({
    data: {
      email,
      name,
      azureAdId,
    },
  });

  return newUser.id;
}

/**
 * Build NextAuth configuration
 */
async function buildAuthOptions(): Promise<NextAuthOptions> {
  const providers: NextAuthOptions['providers'] = [];

  // Azure AD B2C Provider (production)
  try {
    const tenantId = await getSecret('AZURE_AD_B2C_TENANT_ID').catch(() => null);
    const clientId = await getSecret('AZURE_AD_B2C_CLIENT_ID').catch(() => null);
    const clientSecret = await getSecret('AZURE_AD_B2C_CLIENT_SECRET').catch(() => null);
    const primaryUserFlow = await getSecret('AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY').catch(() => null);

    if (tenantId && clientId && clientSecret && primaryUserFlow) {
      providers.push(
        AzureADB2CProvider({
          tenantId,
          clientId,
          clientSecret,
          primaryUserFlow,
        })
      );
    }
  } catch (error) {
    console.warn('Azure AD B2C not configured, skipping provider:', error);
  }

  const allowDemoAuth = process.env.NODE_ENV === 'development'
    || process.env.ENABLE_DEMO_AUTH === 'true';

  // Credentials auth is intentionally opt-in outside local development.
  if (allowDemoAuth) {
    providers.push(
      CredentialsProvider({
        name: 'Credentials',
        credentials: {
          email: { label: 'Email', type: 'email', placeholder: 'test@example.com' },
          name: { label: 'Name', type: 'text', placeholder: 'Test User' },
        },
        async authorize(credentials) {
          try {
            if (!credentials?.email) {
              return null;
            }

            // For development: create or get user
            const userId = await getOrCreateUser(
              credentials.email,
              credentials.name || null,
              null // No Azure AD ID for credentials provider
            );

            return {
              id: userId,
              email: credentials.email,
              name: credentials.name || null,
            };
          } catch (error) {
            console.error('[NextAuth] Authorize error:', error);
            return null;
          }
        },
      })
    );
  }

  if (providers.length === 0) {
    throw new Error(
      'No authentication provider is configured. Configure Azure AD B2C or set ENABLE_DEMO_AUTH=true for a non-production demo.'
    );
  }

  // Get NEXTAUTH_SECRET and NEXTAUTH_URL
  const secret = await getSecret('NEXTAUTH_SECRET').catch(() => {
    // Fallback for development
    if (process.env.NODE_ENV === 'development') {
      console.warn('NEXTAUTH_SECRET not set, using default (NOT SECURE FOR PRODUCTION)');
      return 'development-secret-change-in-production';
    }
    throw new Error('NEXTAUTH_SECRET is required');
  });

  const nextAuthUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;

  return {
    providers,
    callbacks: {
      /**
       * JWT callback - called whenever a JWT is created or updated
       */
      async jwt({ token, account, profile, user }) {
        // Initial sign in
        if (account && user) {
          // Get or create user in database
          const email = profile?.email || user.email || token.email;
          const name = profile?.name || user.name || token.name;
          // Azure AD B2C provides 'oid' in profile, Credentials provider doesn't
          const azureAdId = 
            (profile && typeof profile === 'object' && 'oid' in profile 
              ? (profile as { oid?: string }).oid 
              : null) || account.providerAccountId || null;

          if (email) {
            const userId = await getOrCreateUser(email, name || null, azureAdId);
            
            token.userId = userId;
            token.email = email;
            token.name = name;
            
            if (account.access_token) {
              token.accessToken = account.access_token;
            }
          }
        }

        return token;
      },
      /**
       * Session callback - called whenever a session is checked
       */
      async session({ session, token }) {
        // Extend session with userId and accessToken
        const extendedSession = {
          ...session,
          userId: token.userId as string | undefined,
          accessToken: token.accessToken as string | undefined,
        };
        return extendedSession;
      },
    },
    session: {
      strategy: 'jwt',
      maxAge: 24 * 60 * 60, // 24 hours
    },
    pages: {
      signIn: '/auth/signin',
      error: '/auth/error',
    },
    secret,
    ...(nextAuthUrl && { url: nextAuthUrl }),
  };
}

// Build and cache auth options
let authOptionsCache: NextAuthOptions | null = null;
let authOptionsPromise: Promise<NextAuthOptions> | null = null;

/**
 * Get NextAuth configuration (cached)
 */
export async function getAuthOptions(): Promise<NextAuthOptions> {
  if (authOptionsCache) {
    return authOptionsCache;
  }
  
  if (!authOptionsPromise) {
    authOptionsPromise = buildAuthOptions();
  }
  
  authOptionsCache = await authOptionsPromise;
  return authOptionsCache;
}

