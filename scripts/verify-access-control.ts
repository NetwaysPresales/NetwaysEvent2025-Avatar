import 'dotenv/config';
import { encode } from 'next-auth/jwt';
import { db } from '../src/lib/db';

const APP_URL = 'https://app-ntw-avatar-ade1b8.azurewebsites.net';

async function cookieFor(user: { id: string; email: string; name: string | null; role: 'ADMIN' | 'USER' }, secret: string) {
  const token = await encode({
    secret,
    maxAge: 300,
    token: { sub: user.id, userId: user.id, email: user.email, name: user.name, role: user.role },
  });
  return `__Secure-next-auth.session-token=${token}`;
}

async function main() {
  const secret = process.env.NEXTAUTH_SECRET;
  const initialPassword = process.env.INITIAL_USER_PASSWORD;
  if (!secret) throw new Error('NEXTAUTH_SECRET is required');
  if (!initialPassword) throw new Error('INITIAL_USER_PASSWORD is required');
  const [admin, approvedUser, disabledUser] = await Promise.all([
    db.user.findUnique({ where: { email: 'amm.alsaadi@gmail.com' } }),
    db.user.findUnique({ where: { email: 'ghyouness@netways.com' } }),
    db.user.findUnique({ where: { email: 'azure-smoke-test@netways.local' } }),
  ]);
  if (!admin || !approvedUser || !disabledUser) throw new Error('Verification users are missing');
  const adminCookie = await cookieFor(admin, secret);
  const userCookie = await cookieFor(approvedUser, secret);
  const disabledCookie = await cookieFor(disabledUser, secret);

  const adminAccountsResponse = await fetch(`${APP_URL}/api/admin/accounts`, { headers: { Cookie: adminCookie } });
  const adminAccounts = await adminAccountsResponse.json() as { accounts: Array<{ role: string; isActive: boolean }> };
  if (!adminAccountsResponse.ok || adminAccounts.accounts.filter((account) => account.isActive).length !== 6) {
    throw new Error('Admin account list did not return six active accounts');
  }
  if (adminAccounts.accounts.filter((account) => account.role === 'ADMIN' && account.isActive).length !== 1) {
    throw new Error('There must be exactly one active administrator');
  }

  const userAdminResponse = await fetch(`${APP_URL}/api/admin/accounts`, { headers: { Cookie: userCookie } });
  if (userAdminResponse.status !== 403) throw new Error(`Normal user admin API status was ${userAdminResponse.status}`);
  const disabledProfileResponse = await fetch(`${APP_URL}/api/profiles`, { headers: { Cookie: disabledCookie } });
  if (disabledProfileResponse.status !== 401) throw new Error(`Disabled user profile API status was ${disabledProfileResponse.status}`);

  const userProfilesResponse = await fetch(`${APP_URL}/api/profiles`, { headers: { Cookie: userCookie } });
  const userProfiles = await userProfilesResponse.json() as {
    profiles: Array<{ id: string; name: string; appTitle: string | null; appDescription: string | null; logoBlobUrl: string | null }>;
  };
  const sharedProfileIds = new Set(['6402f32f-17b6-4ccc-9054-d45a610ec2f9', '538d934e-d0ce-4ed6-bf42-55d00d3eb5e0']);
  if (!userProfilesResponse.ok || [...sharedProfileIds].some((id) => !userProfiles.profiles.some((profile) => profile.id === id))) {
    throw new Error('Approved user does not see both shared profiles');
  }
  const adminProfilesResponse = await fetch(`${APP_URL}/api/profiles`, { headers: { Cookie: adminCookie } });
  const adminProfiles = await adminProfilesResponse.json() as { profiles: unknown[] };
  if (!adminProfilesResponse.ok || adminProfiles.profiles.length < 2) throw new Error('Administrator profiles are missing');

  const expectedBranding = new Map([
    ['6402f32f-17b6-4ccc-9054-d45a610ec2f9', 'Zayd'],
    ['538d934e-d0ce-4ed6-bf42-55d00d3eb5e0', 'Layla'],
  ]);
  for (const [profileId, expectedAvatarName] of expectedBranding) {
    const brandedProfile = userProfiles.profiles.find((profile) => profile.id === profileId);
    if (!brandedProfile || !brandedProfile.name.startsWith(`${expectedAvatarName} |`) || !brandedProfile.appTitle?.startsWith(`${expectedAvatarName} |`) || !brandedProfile.appDescription || !brandedProfile.logoBlobUrl) {
      throw new Error(`Branding mismatch for ${expectedAvatarName}: ${JSON.stringify(brandedProfile)}`);
    }
    const logoResponse = await fetch(`${APP_URL}/api/profiles/${profileId}/assets?assetType=logo`, { headers: { Cookie: userCookie } });
    if (!logoResponse.ok || logoResponse.headers.get('content-type') !== 'image/png') {
      throw new Error(`Shared logo failed for ${expectedAvatarName}`);
    }
  }

  const laylaProfileId = '538d934e-d0ce-4ed6-bf42-55d00d3eb5e0';
  const sharedKnowledgeResponse = await fetch(`${APP_URL}/api/profiles/${laylaProfileId}/knowledge`, { headers: { Cookie: userCookie } });
  const sharedKnowledge = await sharedKnowledgeResponse.json() as { files: Array<{ id: string; visualizable: boolean }> };
  if (!sharedKnowledgeResponse.ok || sharedKnowledge.files.length < 3) throw new Error('Shared knowledge is not readable');
  const visualFile = sharedKnowledge.files.find((file) => file.visualizable);
  if (!visualFile) throw new Error('Shared profile has no visualizable document');
  const sharedDocumentResponse = await fetch(`${APP_URL}/api/profiles/${laylaProfileId}/knowledge/${visualFile.id}/document`, { headers: { Cookie: userCookie } });
  if (!sharedDocumentResponse.ok || sharedDocumentResponse.headers.get('content-type') !== 'application/pdf') {
    throw new Error('Shared document rendering is not readable');
  }
  const sharedMutationResponse = await fetch(`${APP_URL}/api/profiles/${laylaProfileId}`, {
    method: 'PUT',
    headers: { Cookie: userCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Unauthorized rename' }),
  });
  if (sharedMutationResponse.status !== 404) throw new Error(`Shared profile mutation status was ${sharedMutationResponse.status}`);

  const speechTokenResponse = await fetch(`${APP_URL}/api/speech/token`, { headers: { Cookie: userCookie } });
  const speechToken = await speechTokenResponse.json() as { authorizationToken?: string; ice?: { urls?: string[] } };
  if (!speechTokenResponse.ok || !speechToken.authorizationToken || !speechToken.ice?.urls?.length) {
    throw new Error(`Normal-user Speech token failed (${speechTokenResponse.status})`);
  }

  const agentResponse = await fetch(`${APP_URL}/api/agent`, {
    method: 'POST',
    headers: { Cookie: userCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: laylaProfileId, userText: 'Briefly introduce yourself.', detectedLocale: 'en-US', detectedLanguage: 'English' }),
  });
  const agentBody = await agentResponse.text();
  if (!agentResponse.ok || !agentBody.includes('"event":"conversation"') || !agentBody.includes('"event":"content"')) {
    throw new Error(`Normal-user shared agent failed (${agentResponse.status}): ${agentBody.slice(0, 1000)}`);
  }

  const jsonCitationResponse = await fetch(`${APP_URL}/api/agent`, {
    method: 'POST',
    headers: { Cookie: userCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: laylaProfileId, userText: 'What is the organizational role of Erth Zayed Philanthropies? Answer in one sentence.', detectedLocale: 'en-US', detectedLanguage: 'English' }),
  });
  const jsonCitationBody = await jsonCitationResponse.text();
  const jsonCitationContent = jsonCitationBody
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.replace(/^data:\s*/, '')) as { event: string; data?: unknown })
    .filter((event) => event.event === 'content')
    .map((event) => String(event.data || ''))
    .join('');
  if (!jsonCitationResponse.ok || !jsonCitationContent.includes('#policy-citation') || jsonCitationContent.includes('AI_Avatar_Knowledge_Base.json')) {
    throw new Error(`JSON citation rendering failed (${jsonCitationResponse.status}): ${jsonCitationBody.slice(0, 1500)}`);
  }

  const credentialsSignIn = async (email: string, password: string) => {
    const csrfResponse = await fetch(`${APP_URL}/api/auth/csrf`);
    const csrfPayload = await csrfResponse.json() as { csrfToken: string };
    const csrfCookie = csrfResponse.headers.get('set-cookie')?.split(';')[0];
    if (!csrfCookie) throw new Error('CSRF cookie was not returned');
    const body = new URLSearchParams({
      csrfToken: csrfPayload.csrfToken,
      email,
      password,
      name: email.split('@')[0],
      callbackUrl: APP_URL,
      json: 'true',
    });
    const response = await fetch(`${APP_URL}/api/auth/callback/credentials?json=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: csrfCookie },
      body,
      redirect: 'manual',
    });
    return response.headers.get('set-cookie')?.includes('session-token=') === true;
  };
  const validPasswordAccepted = await credentialsSignIn(approvedUser.email, initialPassword);
  const wrongPasswordAccepted = await credentialsSignIn(approvedUser.email, 'WrongPassword!123');
  const unknownEmailAccepted = await credentialsSignIn('not-allowed@example.com', initialPassword);
  if (!validPasswordAccepted || wrongPasswordAccepted || unknownEmailAccepted) {
    throw new Error('Credential allowlist/password verification failed');
  }

  console.log(JSON.stringify({
    activeAccounts: 6,
    activeAdmins: 1,
    normalUserAdminStatus: userAdminResponse.status,
    disabledUserApiStatus: disabledProfileResponse.status,
    totalProfileCountForUser: userProfiles.profiles.length,
    sharedProfilesPresent: 2,
    sharedBrandingVerified: true,
    sharedKnowledgeFiles: sharedKnowledge.files.length,
    sharedDocumentStatus: sharedDocumentResponse.status,
    sharedMutationStatus: sharedMutationResponse.status,
    normalUserSpeechTokenStatus: speechTokenResponse.status,
    normalUserAgentStatus: agentResponse.status,
    jsonCitationStatus: jsonCitationResponse.status,
    adminProfileCount: adminProfiles.profiles.length,
    validPasswordAccepted,
    wrongPasswordAccepted,
    unknownEmailAccepted,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
