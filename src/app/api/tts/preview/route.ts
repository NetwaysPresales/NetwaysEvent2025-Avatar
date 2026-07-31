import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getSecret } from '@/lib/secrets';
import { ALL_VOICES } from '@/lib/azure-voices';
import { createSSML } from '@/lib/ssml';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const voice = ALL_VOICES.find((option) => option.value === body?.voice);
    if (!voice) {
      return NextResponse.json({ error: 'Unsupported voice' }, { status: 400 });
    }

    const region = process.env.AZURE_SPEECH_REGION || 'westeurope';
    const apiKey = await getSecret('AZURE_SPEECH_KEY');
    const name = voice.label.split(' (')[0];
    const sample = voice.locale.startsWith('ar-')
      ? `مرحباً، أنا ${name}. هذا نموذج لصوتي العصبي من مايكروسوفت أزور.`
      : `Hello, I'm ${name}. This is a preview of my Azure neural voice.`;
    const response = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'NetwaysAvatarVoicePreview',
        },
        body: createSSML(sample, voice.value),
        cache: 'no-store',
      }
    );

    if (!response.ok || !response.body) {
      console.error('Azure voice preview failed', { status: response.status, voice: voice.value });
      return NextResponse.json({ error: 'Voice preview is unavailable' }, { status: 502 });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=86400',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Voice preview error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
