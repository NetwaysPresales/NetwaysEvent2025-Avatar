/**
 * Entity Instances API Routes (under template)
 * 
 * GET: List all instances for a template
 * POST: Create a new instance for a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { db, transaction } from '@/lib/db';
import { PrismaClient } from '@prisma/client';

/**
 * GET /api/profiles/[id]/entities/templates/[templateId]/instances
 * List all entity instances for a template
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id, templateId } = await params;

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

    // Get all instances for this template
    const instances = await db.entityInstance.findMany({
      where: {
        userId: session.userId,
        profileId: id,
        templateId: templateId,
      },
      include: {
        template: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ instances });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Instances List Error:', error);
    return NextResponse.json({ error: 'Failed to list instances' }, { status: 500 });
  }
}

/**
 * POST /api/profiles/[id]/entities/templates/[templateId]/instances
 * Create a new entity instance for a template
 * 
 * Body:
 * - name: string (required)
 * - identifier: string (required, unique per profile)
 * - description?: string
 * - data: Record<string, any> (required, matches template structure)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id, templateId } = await params;

    // Verify profile ownership
    const profile = await getProfile(session.userId, id);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify template belongs to this profile
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

    const body = await req.json();
    const { name, identifier, description, data } = body;

    // Validate required fields
    if (!name || !identifier || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: name, identifier, and data' },
        { status: 400 }
      );
    }

    // Create instance
    const instance = await transaction(async (tx: PrismaClient) => {
      return await tx.entityInstance.create({
        data: {
          userId: session.userId,
          profileId: id,
          templateId: templateId,
          name,
          identifier,
          description: description || null,
          data,
        },
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

    return NextResponse.json({ instance }, { status: 201 });
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
    console.error('[API] Entity Instance Create Error:', error);
    return NextResponse.json({ error: 'Failed to create instance' }, { status: 500 });
  }
}

