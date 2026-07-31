import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { downloadBlobBuffer } from '@/lib/blob-storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: profileId, fileId } = await params;
    const file = await db.knowledgeFile.findFirst({
      where: { id: fileId, profileId, userId: session.userId },
      select: { renderedPdfBlobUrl: true },
    });
    if (!file) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    if (!file.renderedPdfBlobUrl) {
      return NextResponse.json({ error: 'This document has no page-faithful PDF rendering' }, { status: 409 });
    }

    const buffer = await downloadBlobBuffer(file.renderedPdfBlobUrl);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': 'inline',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Document rendering fetch error:', error);
    return NextResponse.json({ error: 'Failed to load document rendering' }, { status: 500 });
  }
}
