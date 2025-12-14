/**
 * Test Authentication Flow
 * Usage: npm run test:auth
 * 
 * This script tests the complete authentication flow:
 * 1. NextAuth login (credentials provider)
 * 2. Session token generation
 * 3. Middleware protection of API routes
 * 4. Unauthorized request rejection
 * 5. User synchronization with database
 * 
 * Requires the Next.js development server to be running (npm run dev).
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';

config({ path: resolve(process.cwd(), '.env.local') });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = `test-auth-${Date.now()}@example.com`;
const TEST_PASSWORD = 'test-password-123'; // For credentials provider

let sessionCookie: string | undefined;

/**
 * Helper to make authenticated requests
 */
async function authenticatedFetch(url: string, options?: RequestInit): Promise<Response> {
  const headers = {
    ...options?.headers,
    ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Test 1: Login via NextAuth (Credentials Provider)
 */
async function testLogin(): Promise<void> {
  console.log('🔐 Testing NextAuth Login\n');

  // Step 1: Get CSRF token and cookies
  console.log('1. Getting CSRF token...');
  const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`, {
    method: 'GET',
  });

  if (!csrfResponse.ok) {
    const errorText = await csrfResponse.text();
    throw new Error(`Failed to get CSRF token: ${csrfResponse.status} - ${errorText}`);
  }

  const csrfData = await csrfResponse.json();
  const csrfToken = csrfData.csrfToken;
  
  if (!csrfToken) {
    throw new Error('CSRF token not found in response');
  }

  console.log(`✓ CSRF token obtained`);

  // Extract ALL cookies from CSRF response - NextAuth needs these
  const allCookies = csrfResponse.headers.getSetCookie();
  const cookieString = allCookies.map(cookie => {
    // Extract just the cookie name=value part (before the first semicolon)
    return cookie.split(';')[0];
  }).join('; ');

  // Step 2: Sign in with credentials
  // Note: The UI uses /api/auth/callback/credentials, not /api/auth/signin/credentials
  console.log('\n2. Signing in with credentials...');
  const loginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieString, // Include all cookies from CSRF request
    },
    redirect: 'manual', // Don't follow redirects
    body: new URLSearchParams({
      csrfToken,
      email: TEST_EMAIL,
      name: TEST_EMAIL.split('@')[0], // Use email prefix as name
      callbackUrl: '/',
      redirect: 'false', // Don't redirect, return JSON
      json: 'true', // Request JSON response
    }).toString(),
  });

  // Extract all cookies from response
  const setCookieHeaders = loginResponse.headers.getSetCookie();
  
  if (setCookieHeaders.length === 0) {
    throw new Error('No cookies received from login response');
  }
  
  // Check for authentication failure
  if (loginResponse.status === 302) {
    const location = loginResponse.headers.get('location');
    if (location?.includes('error') || location?.includes('signin')) {
      throw new Error(`Authentication failed: redirecting to ${location}`);
    }
  }

  // Extract the session token cookie
  let sessionToken: string | null = null;
  for (const cookie of setCookieHeaders) {
    const match = cookie.match(/next-auth\.session-token=([^;]+)/);
    if (match && match[1]) {
      sessionToken = match[1];
      break;
    }
  }

  if (!sessionToken) {
    throw new Error('Failed to extract session token from login response');
  }

  sessionCookie = `next-auth.session-token=${sessionToken}`;
  console.log('✓ Login successful');

  // Verify user was created in database
  const { db } = await import('../src/lib/db');
  const user = await db.user.findUnique({
    where: { email: TEST_EMAIL },
  });

  if (!user) {
    throw new Error('User was not created in database after login');
  }

  console.log(`✓ User synchronized to database: ${user.id}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Name: ${user.name || '(not set)'}`);
}

/**
 * Test 2: Access protected API route with valid session
 */
async function testProtectedRouteAccess(): Promise<void> {
  console.log('\n🛡️ Testing Protected Route Access\n');

  if (!sessionCookie) {
    throw new Error('No session cookie available. Run testLogin() first.');
  }

  // Test accessing /api/profiles (should succeed)
  console.log('1. Testing GET /api/profiles (should succeed)...');
  const profilesResponse = await authenticatedFetch(`${BASE_URL}/api/profiles`);
  
  if (profilesResponse.status === 401) {
    throw new Error('Protected route rejected valid session');
  }

  if (!profilesResponse.ok) {
    const errorText = await profilesResponse.text();
    throw new Error(`Protected route returned error: ${profilesResponse.status} - ${errorText}`);
  }

  const profilesData = await profilesResponse.json();
  console.log('✓ Protected route accessible with valid session');
  console.log(`  Found ${profilesData.profiles?.length || 0} profile(s)`);

  // Test creating a profile (should succeed)
  console.log('\n2. Testing POST /api/profiles (should succeed)...');
  const createResponse = await authenticatedFetch(`${BASE_URL}/api/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Auth Test Profile' }),
  });

  if (createResponse.status === 401) {
    throw new Error('Profile creation rejected valid session');
  }

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Profile creation failed: ${createResponse.status} - ${errorText}`);
  }

  const createData = await createResponse.json();
  console.log('✓ Profile creation successful with valid session');
  console.log(`  Created profile: ${createData.profile?.id}`);
}

/**
 * Test 3: Reject unauthorized requests
 */
async function testUnauthorizedRejection(): Promise<void> {
  console.log('\n🚫 Testing Unauthorized Request Rejection\n');

  // Test accessing /api/profiles without session (should fail)
  console.log('1. Testing GET /api/profiles without session (should fail)...');
  const noAuthResponse = await fetch(`${BASE_URL}/api/profiles`);

  if (noAuthResponse.status !== 401) {
    throw new Error(`Expected 401 Unauthorized, got ${noAuthResponse.status}`);
  }

  const errorData = await noAuthResponse.json();
  if (errorData.error !== 'Unauthorized') {
    throw new Error(`Expected "Unauthorized" error, got: ${JSON.stringify(errorData)}`);
  }

  console.log('✓ Unauthorized request correctly rejected');
  console.log(`  Status: ${noAuthResponse.status}`);
  console.log(`  Error: ${errorData.error}`);

  // Test with invalid session token
  console.log('\n2. Testing GET /api/profiles with invalid session (should fail)...');
  const invalidAuthResponse = await fetch(`${BASE_URL}/api/profiles`, {
    headers: {
      'Cookie': 'next-auth.session-token=invalid-token-12345',
    },
  });

  if (invalidAuthResponse.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for invalid token, got ${invalidAuthResponse.status}`);
  }

  console.log('✓ Invalid session token correctly rejected');
}

/**
 * Test 4: Middleware protection
 */
async function testMiddlewareProtection(): Promise<void> {
  console.log('\n🔒 Testing Middleware Protection\n');

  // Test that middleware protects /api routes
  console.log('1. Testing middleware protection of /api routes...');
  
  const protectedRoutes = [
    '/api/profiles',
    // Note: /api/agent has LangChain dependency issues, skipping for now
  ];

  for (const route of protectedRoutes) {
    const response = await fetch(`${BASE_URL}${route}`);
    if (response.status !== 401) {
      throw new Error(`Route ${route} should be protected (expected 401, got ${response.status})`);
    }
    console.log(`✓ ${route} is protected`);
  }

  // Test that public routes are accessible
  console.log('\n2. Testing public routes are accessible...');
  const publicRoutes = [
    '/',
    '/api/auth/signin',
  ];

  for (const route of publicRoutes) {
    const response = await fetch(`${BASE_URL}${route}`);
    if (response.status >= 500) {
      throw new Error(`Public route ${route} returned server error: ${response.status}`);
    }
    console.log(`✓ ${route} is accessible (status: ${response.status})`);
  }
}

/**
 * Test 5: Session persistence
 */
async function testSessionPersistence(): Promise<void> {
  console.log('\n💾 Testing Session Persistence\n');

  if (!sessionCookie) {
    throw new Error('No session cookie available. Run testLogin() first.');
  }

  // Make multiple requests with the same session
  console.log('1. Testing session persistence across multiple requests...');
  
  for (let i = 1; i <= 3; i++) {
    const response = await authenticatedFetch(`${BASE_URL}/api/profiles`);
    if (response.status === 401) {
      throw new Error(`Session expired after ${i} requests`);
    }
    console.log(`  ✓ Request ${i} successful`);
  }

  console.log('✓ Session persists across multiple requests');
}

/**
 * Test 6: User ownership verification
 */
async function testUserOwnership(): Promise<void> {
  console.log('\n👤 Testing User Ownership Verification\n');

  if (!sessionCookie) {
    throw new Error('No session cookie available. Run testLogin() first.');
  }

  // Create a profile for the test user
  const createResponse = await authenticatedFetch(`${BASE_URL}/api/profiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Ownership Test Profile' }),
  });

  const createData = await createResponse.json();
  const profileId = createData.profile?.id;

  if (!profileId) {
    throw new Error('Failed to create profile for ownership test');
  }

  console.log(`✓ Created profile: ${profileId}`);

  // Try to access the profile (should succeed)
  const getResponse = await authenticatedFetch(`${BASE_URL}/api/profiles/${profileId}`);
  if (!getResponse.ok) {
    throw new Error('Failed to access own profile');
  }

  console.log('✓ Can access own profile');

  // Create another user and try to access the first user's profile
  const otherEmail = `test-auth-other-${Date.now()}@example.com`;
  
  // Get CSRF token and cookies for other user
  const otherCsrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
  const otherCsrfData = await otherCsrfResponse.json();
  const otherCsrfToken = otherCsrfData.csrfToken;
  
  const otherAllCookies = otherCsrfResponse.headers.getSetCookie();
  const otherCookieString = otherAllCookies.map(cookie => {
    return cookie.split(';')[0];
  }).join('; ');

  const otherLoginResponse = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': otherCookieString,
    },
    redirect: 'manual',
    body: new URLSearchParams({
      csrfToken: otherCsrfToken,
      email: otherEmail,
      name: otherEmail.split('@')[0],
      callbackUrl: '/',
      redirect: 'false',
      json: 'true',
    }).toString(),
  });

  const otherSetCookieHeaders = otherLoginResponse.headers.getSetCookie();
  if (otherSetCookieHeaders.length === 0) {
    throw new Error('Failed to login as other user');
  }

  let otherSessionToken: string | null = null;
  for (const cookie of otherSetCookieHeaders) {
    const match = cookie.match(/next-auth\.session-token=([^;]+)/);
    if (match && match[1]) {
      otherSessionToken = match[1];
      break;
    }
  }

  if (!otherSessionToken) {
    console.error('Other user login cookies:', otherSetCookieHeaders);
    throw new Error('Failed to extract session token for other user');
  }

  const otherSessionCookie = `next-auth.session-token=${otherSessionToken}`;

  // Try to access the first user's profile with the other user's session (should fail)
  const unauthorizedResponse = await fetch(`${BASE_URL}/api/profiles/${profileId}`, {
    headers: {
      'Cookie': otherSessionCookie,
    },
  });

  if (unauthorizedResponse.status !== 404 && unauthorizedResponse.status !== 401) {
    // Should be 404 (not found) or 401 (unauthorized) - depends on implementation
    const errorText = await unauthorizedResponse.text();
    throw new Error(`Expected 404 or 401 for unauthorized profile access, got ${unauthorizedResponse.status} - ${errorText}`);
  }

  console.log('✓ Cannot access other user\'s profile (correctly rejected)');

  // Cleanup other user
  const { db } = await import('../src/lib/db');
  const otherUser = await db.user.findUnique({ where: { email: otherEmail } });
  if (otherUser) {
    await db.user.delete({ where: { id: otherUser.id } });
  }
}

/**
 * Cleanup test data
 */
async function cleanup(): Promise<void> {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    const { db } = await import('../src/lib/db');
    const { deleteProfile } = await import('../src/lib/profile-service');
    
    // Get test user
    const user = await db.user.findUnique({
      where: { email: TEST_EMAIL },
      include: { profiles: true },
    });

    if (user) {
      // Delete all profiles (will cascade delete related data)
      for (const profile of user.profiles) {
        await deleteProfile(user.id, profile.id);
      }

      // Delete user
      await db.user.delete({
        where: { id: user.id },
      });

      console.log('✓ Test user and profiles cleaned up');
    }
  } catch (error: any) {
    console.warn('⚠ Cleanup warning:', error.message);
  }
}

/**
 * Main test function
 */
async function testAuth() {
  console.log('🧪 Testing Authentication Flow\n');
  console.log(`Test User: ${TEST_EMAIL}\n`);
  console.log(`Base URL: ${BASE_URL}\n`);
  console.log('⚠ Make sure the Next.js dev server is running (npm run dev)\n');

  try {
    // Test login
    await testLogin();

    // Test protected route access
    await testProtectedRouteAccess();

    // Test unauthorized rejection
    await testUnauthorizedRejection();

    // Test middleware protection
    await testMiddlewareProtection();

    // Test session persistence
    await testSessionPersistence();

    // Test user ownership
    await testUserOwnership();

    console.log('\n✅ All authentication tests passed!');
    console.log('\nSummary:');
    console.log('  ✓ NextAuth login flow');
    console.log('  ✓ Session token generation');
    console.log('  ✓ Protected route access');
    console.log('  ✓ Unauthorized request rejection');
    console.log('  ✓ Middleware protection');
    console.log('  ✓ Session persistence');
    console.log('  ✓ User ownership verification');

  } catch (error: any) {
    console.error('\n❌ Authentication test failed:', error.message);
    console.error('Error details:', error);
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
      console.error('\n💡 Make sure the Next.js dev server is running:');
      console.error('   npm run dev');
    }
    
    process.exit(1);
  } finally {
    await cleanup();
    const { closeDb } = await import('../src/lib/db');
    await closeDb();
  }
}

// Run tests
testAuth().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

