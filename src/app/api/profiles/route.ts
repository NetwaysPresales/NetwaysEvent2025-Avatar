import { NextRequest, NextResponse } from 'next/server';
import { listProfiles, createProfile } from '@/lib/profiles';

export async function GET() {
    try {
        const profiles = await listProfiles();
        return NextResponse.json({ profiles });
    } catch (error) {
        console.error('Failed to list profiles', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name } = body;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

        const profile = await createProfile(name);
        return NextResponse.json({ profile });
    } catch (error) {
        console.error('Failed to create profile', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
