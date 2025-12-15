/**
 * Entity Duplicate API Route
 * 
 * POST: Duplicate an entity (creates new entity with same structure, empty data)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { db, transaction } from '@/lib/db';
import { Prisma } from '@prisma/client';

/**
 * POST /api/profiles/[id]/entities/[entityId]/duplicate
 * Duplicate an entity
 * 
 * Body (optional):
 * - name?: string (defaults to "Original Name (Copy)")
 */
export async function POST(
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

    const sourceEntity = await db.entity.findFirst({
      where: {
        id: entityId,
        userId: session.userId,
        profileId: profileId,
      },
    });

    if (!sourceEntity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const newName = body.name?.trim() || `${sourceEntity.name} (Copy)`;

    // Create duplicate entity with same structure but empty data
    const duplicatedEntity = await transaction(async (tx) => {
      return await tx.entity.create({
        data: {
          userId: session.userId,
          profileId: profileId,
          name: newName,
          description: sourceEntity.description,
          structure: sourceEntity.structure as Prisma.InputJsonValue, // Copy structure
          data: {}, // Empty data
          isActive: sourceEntity.isActive,
        },
      });
    });

    return NextResponse.json({ entity: duplicatedEntity }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Duplicate Error:', error);
    return NextResponse.json({ error: 'Failed to duplicate entity' }, { status: 500 });
  }
}

