import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import { getProfileDir } from '@/lib/profiles';

// Helper to determine mime type
const getMimeType = (filename: string) => {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.mp4') return 'video/mp4';
    if (ext === '.webm') return 'video/webm';
    return 'application/octet-stream';
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const filename = searchParams.get('file');

        if (!filename) return NextResponse.json({ error: 'File param required' }, { status: 400 });

        const profileDir = await getProfileDir(id);
        const filePath = path.join(profileDir, 'assets', path.basename(filename));

        if (!existsSync(filePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const stats = await fs.stat(filePath);
        const stream = createReadStream(filePath);

        return new NextResponse(stream as any, {
            headers: {
                'Content-Type': getMimeType(filename),
                'Content-Length': stats.size.toString(),
            },
        });
    } catch (error) {
        console.error('Asset Fetch Error', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const cleanName = path.basename(file.name).replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${Date.now()}-${cleanName}`;

        const profileDir = await getProfileDir(id);
        const filePath = path.join(profileDir, 'assets', filename);

        await fs.writeFile(filePath, buffer);

        // Return the asset URL that can be used with GET
        const assetUrl = `/api/profiles/${id}/assets?file=${filename}`;
        return NextResponse.json({ url: assetUrl, filename });
    } catch (error) {
        console.error('Asset Upload Error', error);
        return NextResponse.json({ error: 'Upload Failed' }, { status: 500 });
    }
}
