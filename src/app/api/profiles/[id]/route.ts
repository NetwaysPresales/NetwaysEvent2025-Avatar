import { NextRequest, NextResponse } from 'next/server';
import { getProfile, saveProfile, deleteProfile } from '@/lib/profiles';
import { validateSpeechConfig, validateAzureOpenAIConfig } from '@/lib/config';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const profile = await getProfile(id);
        if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

        return NextResponse.json(profile);
    } catch (error) {
        console.error('Failed to get profile', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();

        // Ensure ID matches
        if (body.id !== id) {
            return NextResponse.json({ error: 'ID mismatch' }, { status: 400 });
        }

        // Validation
        if (body.speechConfig) {
            const speechError = validateSpeechConfig(body.speechConfig);
            if (speechError) return NextResponse.json({ error: speechError }, { status: 400 });
        }
        if (body.openAIConfig) {
            const openAIError = validateAzureOpenAIConfig(body.openAIConfig);
            if (openAIError) return NextResponse.json({ error: openAIError }, { status: 400 });
        }

        await saveProfile(body);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update profile', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await deleteProfile(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete profile', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
