import 'dotenv/config';
import { encode } from 'next-auth/jwt';
import { db } from '../src/lib/db';

const APP_URL = 'https://app-ntw-avatar-ade1b8.azurewebsites.net';
const PROFILE_IDS = [
  '6402f32f-17b6-4ccc-9054-d45a610ec2f9',
  '538d934e-d0ce-4ed6-bf42-55d00d3eb5e0',
];
const SHARED_FILENAME = 'Erth_Zayed_AI_Knowledge_Base_V1 (3).docx';

async function main() {
  const profile = await db.profile.findUnique({
    where: { id: PROFILE_IDS[0] },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!profile) throw new Error('Verification profile not found');
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is required');
  const token = await encode({
    secret,
    maxAge: 300,
    token: { sub: profile.user.id, userId: profile.user.id, email: profile.user.email, name: profile.user.name },
  });
  const headers = {
    'Content-Type': 'application/json',
    Cookie: `__Secure-next-auth.session-token=${token}`,
  };

  const updateVisibility = async (showEvidencePanel: boolean) => {
    const response = await fetch(`${APP_URL}/api/profiles/${profile.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ showEvidencePanel }),
    });
    if (!response.ok) throw new Error(`Visibility update failed (${response.status})`);
    const payload = await response.json() as { profile: { showEvidencePanel: boolean } };
    if (payload.profile.showEvidencePanel !== showEvidencePanel) throw new Error('Visibility value did not persist');
  };

  await updateVisibility(false);
  const hiddenResponse = await fetch(`${APP_URL}/api/profiles/${profile.id}`, { headers });
  const hiddenProfile = await hiddenResponse.json() as { showEvidencePanel: boolean };
  if (!hiddenResponse.ok || hiddenProfile.showEvidencePanel !== false) throw new Error('Live profile did not return hidden evidence state');
  await updateVisibility(true);

  const knowledge: Array<{ profileId: string; files: number; sharedPages: number }> = [];
  for (const profileId of PROFILE_IDS) {
    const response = await fetch(`${APP_URL}/api/profiles/${profileId}/knowledge`, { headers });
    if (!response.ok) throw new Error(`Knowledge fetch failed for ${profileId} (${response.status})`);
    const payload = await response.json() as {
      files: Array<{ filename: string; pageCount: number | null; visualizable: boolean }>;
    };
    const shared = payload.files.find((file) => file.filename === SHARED_FILENAME);
    if (!shared || shared.pageCount !== 23 || !shared.visualizable) {
      throw new Error(`Shared knowledge is not page-ready for ${profileId}`);
    }
    knowledge.push({ profileId, files: payload.files.length, sharedPages: shared.pageCount });
  }

  console.log(JSON.stringify({ visibilityRoundTrip: true, restoredVisible: true, knowledge }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
