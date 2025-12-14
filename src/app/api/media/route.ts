/**
 * Unified Media API Route
 * 
 * Generic endpoint for generating authenticated SAS URLs for any blob URL.
 * 
 * GET /api/media?blobUrl=...&expiresInMinutes=60
 * 
 * Returns JSON: { url: "SAS_URL" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getMediaUrl } from '@/lib/media-service';

/**
 * GET /api/media
 * Generate a SAS URL for a blob URL
 * 
 * Query params:
 * - blobUrl: string (required) - Blob URL to generate SAS URL for
 * - expiresInMinutes: number (optional, default: 60) - Expiration time in minutes
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    
    const blobUrl = searchParams.get('blobUrl');
    const expiresInMinutes = parseInt(searchParams.get('expiresInMinutes') || '60', 10);
    
    if (!blobUrl) {
      return NextResponse.json(
        { error: 'blobUrl parameter is required' },
        { status: 400 }
      );
    }
    
    // Validate expiresInMinutes
    if (isNaN(expiresInMinutes) || expiresInMinutes < 1 || expiresInMinutes > 1440) {
      return NextResponse.json(
        { error: 'expiresInMinutes must be between 1 and 1440 (24 hours)' },
        { status: 400 }
      );
    }
    
    // Generate SAS URL (media service handles ownership verification)
    const sasUrl = await getMediaUrl(session.userId, blobUrl, {
      expiresInMinutes,
      verifyOwnership: true,
    });
    
    return NextResponse.json({ url: sasUrl });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (errorMessage.includes('Access denied') || errorMessage.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    if (errorMessage.includes('not found') || errorMessage.includes('Invalid')) {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }
    
    console.error('[API] Media URL Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate media URL' }, { status: 500 });
  }
}

