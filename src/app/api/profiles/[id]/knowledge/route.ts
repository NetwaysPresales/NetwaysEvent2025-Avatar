import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getProfileDir } from '@/lib/profiles';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const profileDir = await getProfileDir(id);
        const knowledgeDir = path.join(profileDir, 'knowledge');

        // Ensure dir exists (it should via createProfile but just in case)
        await fs.mkdir(knowledgeDir, { recursive: true });

        const files = await fs.readdir(knowledgeDir);
        const visibleFiles = files.filter(f => !f.startsWith('.'));

        return NextResponse.json({ files: visibleFiles });
    } catch (error) {
        console.error('Knowledge List Error', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = path.basename(file.name);

        const profileDir = await getProfileDir(id);
        const filePath = path.join(profileDir, 'knowledge', filename);

        await fs.writeFile(filePath, buffer);

        return NextResponse.json({ success: true, filename });
    } catch (error) {
        console.error('Knowledge Upload Error', error);
        return NextResponse.json({ error: 'Upload Failed' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const filename = searchParams.get('filename');

        if (!filename) return NextResponse.json({ error: 'No filename' }, { status: 400 });

        const profileDir = await getProfileDir(id);
        const filePath = path.join(profileDir, 'knowledge', path.basename(filename));

        await fs.unlink(filePath);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Knowledge Delete Error', error);
        return NextResponse.json({ error: 'Delete Failed' }, { status: 500 });
    }
}
