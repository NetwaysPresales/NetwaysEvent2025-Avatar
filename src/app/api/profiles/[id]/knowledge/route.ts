/**
 * Knowledge Files API Routes
 * 
 * GET: Fetch all knowledge files with content (for client-side caching)
 * POST: Upload a new knowledge file
 * DELETE: Delete a knowledge file
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { db } from '@/lib/db';
import { downloadBlobAsText } from '@/lib/blob-storage';
import { setCachedKnowledgeFiles, clearCachedKnowledgeFiles } from '@/lib/server-cache';

export async function GET(
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

    // Get all knowledge files for this profile
    const knowledgeFiles = await db.knowledgeFile.findMany({
      where: {
        userId: session.userId,
        profileId: id,
      },
      orderBy: {
        uploadedAt: 'asc',
      },
    });

    if (knowledgeFiles.length === 0) {
      return NextResponse.json({ files: [] });
    }

    // Download content for each file
    const filesWithContent = await Promise.all(
      knowledgeFiles.map(async (file) => {
        try {
          const content = await downloadBlobAsText(file.blobUrl);
          
          // Format JSON files nicely
          let formattedContent = content;
          if (file.filename.endsWith('.json')) {
            try {
              const parsed = JSON.parse(content);
              formattedContent = JSON.stringify(parsed, null, 2);
            } catch {
              // If parsing fails, use raw content
            }
          }

          return {
            id: file.id,
            filename: file.filename,
            content: formattedContent,
            uploadedAt: file.uploadedAt.toISOString(),
          };
        } catch (error) {
          console.error(`[API] Failed to download knowledge file ${file.filename}:`, error);
          return {
            id: file.id,
            filename: file.filename,
            content: '',
            uploadedAt: file.uploadedAt.toISOString(),
            error: 'Failed to load content',
          };
        }
      })
    );

    // Populate server-side cache for agent route
    const filesForCache = filesWithContent
      .filter(f => !f.error)
      .map(f => ({ filename: f.filename, content: f.content }));
    
    // Calculate max uploadedAt timestamp
    const maxUploadedAt = knowledgeFiles.length > 0
      ? Math.max(...knowledgeFiles.map(f => f.uploadedAt.getTime()))
      : 0;
    
    if (filesForCache.length > 0) {
      setCachedKnowledgeFiles(session.userId, id, filesForCache, maxUploadedAt);
    }

    return NextResponse.json({ files: filesWithContent });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Knowledge fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge files' }, { status: 500 });
  }
}

/**
 * DELETE /api/profiles/[id]/knowledge
 * Delete a knowledge file and invalidate cache
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get('filename');

    if (!filename) {
      return NextResponse.json({ error: 'filename parameter is required' }, { status: 400 });
    }

    // Verify ownership
    const profile = await getProfile(session.userId, id);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Find and delete the knowledge file
    const knowledgeFile = await db.knowledgeFile.findFirst({
      where: {
        userId: session.userId,
        profileId: id,
        filename: filename,
      },
    });

    if (!knowledgeFile) {
      return NextResponse.json({ error: 'Knowledge file not found' }, { status: 404 });
    }

    // Delete from blob storage
    const { deleteAsset } = await import('@/lib/blob-storage');
    try {
      await deleteAsset(knowledgeFile.blobUrl);
    } catch (error) {
      console.error(`[API] Failed to delete blob for ${filename}:`, error);
      // Continue with database deletion even if blob deletion fails
    }

    // Delete from database
    await db.knowledgeFile.delete({
      where: { id: knowledgeFile.id },
    });

    // Invalidate server-side cache
    clearCachedKnowledgeFiles(session.userId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Knowledge delete error:', error);
    return NextResponse.json({ error: 'Failed to delete knowledge file' }, { status: 500 });
  }
}

/**
 * POST /api/profiles/[id]/knowledge
 * Upload a new knowledge file and invalidate cache
 */
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

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Upload to blob storage
    const { uploadAsset, CONTAINERS } = await import('@/lib/blob-storage');
    const blobUrl = await uploadAsset(Buffer.from(await file.arrayBuffer()), {
      userId: session.userId,
      profileId: id,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      container: CONTAINERS.KNOWLEDGE_FILES,
    });

    // Save to database
    const knowledgeFile = await db.knowledgeFile.create({
      data: {
        userId: session.userId,
        profileId: id,
        filename: file.name,
        blobUrl,
        azureSearchIndexed: false,
        chunkCount: 0,
      },
    });

    // Invalidate server-side cache when new file is uploaded
    clearCachedKnowledgeFiles(session.userId, id);

    return NextResponse.json({
      success: true,
      filename: knowledgeFile.filename,
      id: knowledgeFile.id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Knowledge upload error:', error);
    return NextResponse.json({ error: 'Failed to upload knowledge file' }, { status: 500 });
  }
}
