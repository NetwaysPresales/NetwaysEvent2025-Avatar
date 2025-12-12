
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Only images and videos are allowed.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Target directory: public/background/avatar
        const uploadDir = path.join(process.cwd(), 'public', 'background', 'avatar');

        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        } else {
            // Clean directory - OVERWRITE LOGIC
            const files = fs.readdirSync(uploadDir);
            for (const f of files) {
                fs.unlinkSync(path.join(uploadDir, f));
            }
        }

        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${Date.now()}-${cleanName}`;

        const filePath = path.join(uploadDir, filename);
        await writeFile(filePath, buffer);

        const publicUrl = `/background/avatar/${filename}`;

        return NextResponse.json({ url: publicUrl });
    } catch (error) {
        console.error('Error uploading background:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
