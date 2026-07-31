import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSecret } from '@/lib/secrets';

interface IceTokenResponse {
  Urls: string[];
  Username: string;
  Password: string;
}

export async function GET() {
  try {
    await requireAuth();

    const region = process.env.AZURE_SPEECH_REGION || 'westeurope';
    const apiKey = await getSecret('AZURE_SPEECH_KEY');
    const headers = { 'Ocp-Apim-Subscription-Key': apiKey };

    const [authorizationResponse, iceResponse] = await Promise.all([
      fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
        method: 'POST',
        headers,
        cache: 'no-store',
      }),
      fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`, {
        headers,
        cache: 'no-store',
      }),
    ]);

    if (!authorizationResponse.ok || !iceResponse.ok) {
      console.error('Azure Speech credential request failed', {
        authorizationStatus: authorizationResponse.status,
        iceStatus: iceResponse.status,
      });
      return NextResponse.json({ error: 'Azure Speech is unavailable' }, { status: 502 });
    }

    const authorizationToken = await authorizationResponse.text();
    const ice = await iceResponse.json() as IceTokenResponse;
    const turnUrls = ice.Urls.filter((url) => url.startsWith('turn:') || url.startsWith('turns:'));

    return NextResponse.json({
      authorizationToken,
      region,
      ice: {
        urls: turnUrls.length > 0 ? turnUrls : ice.Urls,
        username: ice.Username,
        credential: ice.Password,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to issue Azure Speech credentials', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
