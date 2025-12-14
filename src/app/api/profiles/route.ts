import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listProfiles, createProfile } from '@/lib/profile-service';

/**
 * GET /api/profiles
 * List all profiles for the authenticated user
 */
export async function GET() {
    try {
        const session = await requireAuth();
        const profiles = await listProfiles(session.userId);
        return NextResponse.json({ profiles });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('Failed to list profiles', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * POST /api/profiles
 * Create a new profile for the authenticated user
 */
export async function POST(req: NextRequest) {
    try {
        const session = await requireAuth();
        const body = await req.json();
        const { name } = body;

        if (!name || typeof name !== 'string') {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const profile = await createProfile({
            userId: session.userId,
            name,
        });

        return NextResponse.json({ profile });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (errorMessage === 'User not found') {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        console.error('Failed to create profile', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
