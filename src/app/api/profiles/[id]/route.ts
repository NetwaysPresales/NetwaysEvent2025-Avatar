import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile, updateProfile, deleteProfile } from '@/lib/profile-service';
import { validateSpeechConfig, validateAzureOpenAIConfig } from '@/lib/config';
import { normalizeAvatarConfig } from '@/lib/avatar-catalog';

/**
 * GET /api/profiles/[id]
 * Get a specific profile (with ownership verification)
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();
        const { id } = await params;

        const profile = await getProfile(session.userId, id);
        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        return NextResponse.json(profile);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('Failed to get profile', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * PUT /api/profiles/[id]
 * Update a profile (with ownership verification and validation)
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();
        const { id } = await params;
        const body = await req.json();

        // Validation
        const validationErrors: string[] = [];
        if (body.speechConfig) {
            const speechError = validateSpeechConfig(body.speechConfig);
            if (speechError) validationErrors.push(`Speech config: ${speechError}`);
        }
        // Support both openaiConfig (from ProfileContext) and openAIConfig (legacy)
        const openaiConfig = body.openaiConfig || body.openAIConfig;
        if (openaiConfig) {
            const openAIError = validateAzureOpenAIConfig(openaiConfig);
            if (openAIError) validationErrors.push(`OpenAI config: ${openAIError}`);
        }

        if (validationErrors.length > 0) {
            return NextResponse.json(
                { error: 'Validation failed', details: validationErrors },
                { status: 400 }
            );
        }

        // Update profile using profile service (handles ownership verification)
        const profile = await updateProfile(session.userId, id, {
            name: body.name,
            avatarConfig: body.avatarConfig ? normalizeAvatarConfig(body.avatarConfig) : undefined,
            speechConfig: body.speechConfig,
            ttsConfig: body.ttsConfig,
            openaiConfig: openaiConfig, // Use the normalized value
            sttConfig: body.sttConfig,
            appTitle: body.appTitle,
            appDescription: body.appDescription,
            theme: body.theme,
            accentColor: body.accentColor,
            logoShowContainer: body.logoShowContainer,
            showEvidencePanel: body.showEvidencePanel,
        });

        return NextResponse.json({ profile });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (errorMessage === 'Profile not found or unauthorized') {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }
        console.error('Failed to update profile', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * DELETE /api/profiles/[id]
 * Delete a profile and all associated data (with ownership verification)
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();
        const { id } = await params;

        // Delete profile using profile service (handles ownership verification and blob cleanup)
        await deleteProfile(session.userId, id);

        return NextResponse.json({ success: true });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (errorMessage === 'Profile not found or unauthorized') {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }
        console.error('Failed to delete profile', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
