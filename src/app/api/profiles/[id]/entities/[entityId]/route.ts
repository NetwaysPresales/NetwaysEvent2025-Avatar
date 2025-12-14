/**
 * Entity API Routes
 * 
 * GET: Get a specific entity
 * PUT: Update an entity
 * DELETE: Delete an entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { db } from '@/lib/db';
import { clearCachedEntities } from '@/lib/server-cache';

/**
 * GET /api/profiles/[id]/entities/[entityId]
 * Get a specific entity
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: profileId, entityId } = await params;

    // Verify ownership
    const profile = await getProfile(session.userId, profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const entity = await db.entity.findFirst({
      where: {
        id: entityId,
        userId: session.userId,
        profileId: profileId,
      },
      include: {
        mediaFiles: {
          orderBy: [
            { fieldId: 'asc' },
            { orderIndex: 'asc' },
          ],
        },
      },
    });

    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    return NextResponse.json({ entity });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Get Error:', error);
    return NextResponse.json({ error: 'Failed to get entity' }, { status: 500 });
  }
}

/**
 * PUT /api/profiles/[id]/entities/[entityId]
 * Update an entity
 * 
 * Body:
 * - name?: string
 * - description?: string
 * - structure?: { layout: string, fields: [...] }
 * - data?: { fieldId: value, ... }
 * - isActive?: boolean
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: profileId, entityId } = await params;

    // Verify ownership
    const profile = await getProfile(session.userId, profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const existingEntity = await db.entity.findFirst({
      where: {
        id: entityId,
        userId: session.userId,
        profileId: profileId,
      },
    });

    if (!existingEntity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const body = await req.json();
    const updateData: {
      name?: string;
      description?: string | null;
      structure?: any;
      data?: any;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.structure !== undefined) updateData.structure = body.structure;
    if (body.data !== undefined) updateData.data = body.data;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    const updatedEntity = await db.entity.update({
      where: { id: entityId },
      data: updateData,
    });

    // Invalidate cache when entity is updated
    clearCachedEntities(session.userId, profileId);

    return NextResponse.json({ entity: updatedEntity });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Update Error:', error);
    return NextResponse.json({ error: 'Failed to update entity' }, { status: 500 });
  }
}

/**
 * DELETE /api/profiles/[id]/entities/[entityId]
 * Delete an entity
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: profileId, entityId } = await params;

    // Verify ownership
    const profile = await getProfile(session.userId, profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const existingEntity = await db.entity.findFirst({
      where: {
        id: entityId,
        userId: session.userId,
        profileId: profileId,
      },
      include: {
        mediaFiles: true,
      },
    });

    if (!existingEntity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Delete media files from blob storage
    const { deleteAsset } = await import('@/lib/blob-storage');
    for (const mediaFile of existingEntity.mediaFiles) {
      try {
        await deleteAsset(mediaFile.blobUrl);
      } catch (err) {
        console.error(`[API] Failed to delete media file ${mediaFile.id}:`, err);
      }
    }

    // Delete entity from database (cascade will delete associated media files records)
    await db.entity.delete({
      where: { id: entityId },
    });

    // Invalidate cache when entity is deleted
    clearCachedEntities(session.userId, profileId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete entity' }, { status: 500 });
  }
}

