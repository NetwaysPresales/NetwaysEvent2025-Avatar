/**
 * POST /api/profiles/[id]/knowledge/preload
 * Preload all knowledge files for a profile into cache
 * 
 * Called when avatar session starts to download and cache knowledge files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { preloadKnowledgeFiles } from '@/lib/knowledge-cache';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Verify ownership
    const profile = await getProfile(session.userId, id);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Preload knowledge files into cache
    const cachedFiles = await preloadKnowledgeFiles(session.userId, id);

    return NextResponse.json({
      success: true,
      cachedCount: cachedFiles.length,
      files: cachedFiles.map((f) => f.filename),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Knowledge preload error:', error);
    return NextResponse.json({ error: 'Preload failed' }, { status: 500 });
  }
}

