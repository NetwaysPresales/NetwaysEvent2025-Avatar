import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Define the knowledge base directory
const KNOWLEDGE_DIR = path.join(process.cwd(), 'src', 'knowledge');

// Helper to ensure directory exists
async function ensureDir() {
    try {
        await fs.access(KNOWLEDGE_DIR);
    } catch {
        await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
    }
}

// GET: List files
export async function GET() {
    try {
        await ensureDir();
        const files = await fs.readdir(KNOWLEDGE_DIR);
        // Filter for text-based files if needed, or just return all non-hidden
        const visibleFiles = files.filter(f => !f.startsWith('.'));

        return NextResponse.json({ files: visibleFiles });
    } catch (error) {
        console.error('[API] Knowledge List Error:', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
}

// POST: Upload file
export async function POST(req: NextRequest) {
    try {
        await ensureDir();
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        // Sanitize filename to prevent directory traversal
        const filename = path.basename(file.name);
        const filepath = path.join(KNOWLEDGE_DIR, filename);

        await fs.writeFile(filepath, buffer);
        console.log('[API] Uploaded:', filename);

        return NextResponse.json({ success: true, filename });
    } catch (error) {
        console.error('[API] Knowledge Upload Error:', error);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }
}

// DELETE: Delete file
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const filename = searchParams.get('filename');

        if (!filename) {
            return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
        }

        // Sanitize
        const safeName = path.basename(filename);
        const filepath = path.join(KNOWLEDGE_DIR, safeName);

        await fs.unlink(filepath);
        console.log('[API] Deleted:', safeName);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Knowledge Delete Error:', error);
        return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }
}
