
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const bgDir = path.join(process.cwd(), 'public', 'background', 'avatar');

        if (!fs.existsSync(bgDir)) {
            return NextResponse.json({ url: null });
        }

        const files = fs.readdirSync(bgDir);

        // Filter for valid media files
        const mediaFile = files.find(file =>
            /\.(mp4|webm|png|jpg|jpeg|webp)$/i.test(file)
        );

        if (!mediaFile) {
            return NextResponse.json({ url: null });
        }

        return NextResponse.json({ url: `/background/avatar/${mediaFile}` });
    } catch (error) {
        console.error('Error fetching background:', error);
        return NextResponse.json({ error: 'Failed to fetch background' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const bgDir = path.join(process.cwd(), 'public', 'background', 'avatar');

        // Ensure directory exists
        if (fs.existsSync(bgDir)) {
            const files = fs.readdirSync(bgDir);
            for (const file of files) {
                fs.unlinkSync(path.join(bgDir, file));
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete background:', error);
        return NextResponse.json({ error: 'Failed to delete background' }, { status: 500 });
    }
}
