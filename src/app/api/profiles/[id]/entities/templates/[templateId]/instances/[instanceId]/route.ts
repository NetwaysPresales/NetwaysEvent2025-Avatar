/**
 * Entity Instance API Routes (Single Instance, under template)
 * 
 * GET: Get a specific instance
 * PUT: Update an instance
 * DELETE: Delete an instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { db, transaction } from '@/lib/db';
import { PrismaClient } from '@prisma/client';

/**
 * GET /api/profiles/[id]/entities/templates/[templateId]/instances/[instanceId]
 * Get a specific entity instance
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string; instanceId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id, templateId, instanceId } = await params;

    // Verify profile ownership
    const profile = await getProfile(session.userId, id);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify template ownership
    const template = await db.entityTemplate.findFirst({
      where: {
        id: templateId,
        userId: session.userId,
        profileId: id,
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get instance (must belong to this template)
    const instance = await db.entityInstance.findFirst({
      where: {
        id: instanceId,
        templateId: templateId,
        userId: session.userId,
        profileId: id,
      },
      include: {
        template: true,
        mediaFiles: {
          orderBy: [
            { fieldId: 'asc' },
            { orderIndex: 'asc' },
          ],
        },
      },
    });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    return NextResponse.json({ instance });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Instance Get Error:', error);
    return NextResponse.json({ error: 'Failed to get instance' }, { status: 500 });
  }
}

/**
 * PUT /api/profiles/[id]/entities/templates/[templateId]/instances/[instanceId]
 * Update an entity instance
 * 
 * Body:
 * - name?: string
 * - identifier?: string
 * - description?: string
 * - data?: Record<string, any>
 * - isActive?: boolean
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string; instanceId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id, templateId, instanceId } = await params;

    // Verify profile ownership
    const profile = await getProfile(session.userId, id);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify template ownership
    const template = await db.entityTemplate.findFirst({
      where: {
        id: templateId,
        userId: session.userId,
        profileId: id,
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Verify instance ownership and template match
    const existing = await db.entityInstance.findFirst({
      where: {
        id: instanceId,
        templateId: templateId,
        userId: session.userId,
        profileId: id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const body = await req.json();
    const updateData: {
      name?: string;
      identifier?: string;
      description?: string | null;
      data?: any;
      isActive?: boolean;
    } = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.identifier !== undefined) updateData.identifier = body.identifier;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.data !== undefined) updateData.data = body.data;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Update instance
    const instance = await transaction(async (tx: PrismaClient) => {
      return await tx.entityInstance.update({
        where: { id: instanceId },
        data: updateData,
        include: {
          template: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    return NextResponse.json({ instance });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage.includes('unique') || errorMessage.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Entity with this identifier already exists for this profile' },
        { status: 409 }
      );
    }
    console.error('[API] Entity Instance Update Error:', error);
    return NextResponse.json({ error: 'Failed to update instance' }, { status: 500 });
  }
}

/**
 * DELETE /api/profiles/[id]/entities/templates/[templateId]/instances/[instanceId]
 * Delete an entity instance
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string; instanceId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id, templateId, instanceId } = await params;

    // Verify profile ownership
    const profile = await getProfile(session.userId, id);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify template ownership
    const template = await db.entityTemplate.findFirst({
      where: {
        id: templateId,
        userId: session.userId,
        profileId: id,
      },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Verify instance ownership and template match
    const existing = await db.entityInstance.findFirst({
      where: {
        id: instanceId,
        templateId: templateId,
        userId: session.userId,
        profileId: id,
      },
      include: {
        mediaFiles: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Delete instance (cascade will delete media files)
    await transaction(async (tx: PrismaClient) => {
      // Delete media files from blob storage
      const { deleteAsset } = await import('@/lib/blob-storage');
      for (const mediaFile of existing.mediaFiles) {
        try {
          await deleteAsset(mediaFile.blobUrl);
        } catch (err) {
          console.error(`[API] Failed to delete media file ${mediaFile.id}:`, err);
        }
      }

      // Delete instance from database
      await tx.entityInstance.delete({
        where: { id: instanceId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Instance Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete instance' }, { status: 500 });
  }
}

