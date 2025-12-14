/**
 * Entities API Routes
 * 
 * GET: List all entities for a profile
 * POST: Create a new entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { db, transaction } from '@/lib/db';
import { PrismaClient } from '@prisma/client';
import { setCachedEntities, clearCachedEntities } from '@/lib/server-cache';

/**
 * GET /api/profiles/[id]/entities
 * List all entities for a profile
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: profileId } = await params;

    // Verify ownership
    const profile = await getProfile(session.userId, profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get all entities for this profile
    const entities = await db.entity.findMany({
      where: {
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Populate server-side cache for agent route (only active entities)
    const activeEntities = entities
      .filter(e => e.isActive)
      .map(e => ({ id: e.id, name: e.name }));
    
    // Calculate max updatedAt timestamp
    const maxUpdatedAt = activeEntities.length > 0
      ? Math.max(...entities.filter(e => e.isActive).map(e => e.updatedAt.getTime()))
      : 0;
    
    if (activeEntities.length > 0) {
      setCachedEntities(session.userId, profileId, activeEntities, maxUpdatedAt);
    }

    return NextResponse.json({ entities });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entities List Error:', error);
    return NextResponse.json({ error: 'Failed to list entities' }, { status: 500 });
  }
}

/**
 * POST /api/profiles/[id]/entities
 * Create a new entity
 * 
 * Body:
 * - name: string (required)
 * - description?: string
 * - structure: { layout: string, fields: [...] } (required)
 * - data?: { fieldId: value, ... } (optional, defaults to empty object)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: profileId } = await params;

    // Verify ownership
    const profile = await getProfile(session.userId, profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, description, structure, data } = body;

    // Validate required fields
    if (!name || !structure) {
      return NextResponse.json(
        { error: 'Missing required fields: name and structure' },
        { status: 400 }
      );
    }

    // Validate structure
    if (!structure.layout || !Array.isArray(structure.fields)) {
      return NextResponse.json(
        { error: 'Invalid structure: must have layout and fields array' },
        { status: 400 }
      );
    }

    // Create entity
    const entity = await transaction(async (tx: PrismaClient) => {
      return await tx.entity.create({
        data: {
          userId: session.userId,
          profileId: profileId,
          name: name.trim(),
          description: description?.trim() || null,
          structure,
          data: data || {},
        },
      });
    });

    // Invalidate cache when entity is created
    clearCachedEntities(session.userId, profileId);

    return NextResponse.json({ entity }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Create Error:', error);
    return NextResponse.json({ error: 'Failed to create entity' }, { status: 500 });
  }
}

