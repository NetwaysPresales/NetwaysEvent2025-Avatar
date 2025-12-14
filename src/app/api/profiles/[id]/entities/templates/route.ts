/**
 * Entity Templates API Routes
 * 
 * GET: List all templates for a profile
 * POST: Create a new template
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { db, transaction } from '@/lib/db';
import { PrismaClient } from '@prisma/client';

/**
 * GET /api/profiles/[id]/entities/templates
 * List all entity templates for a profile
 */
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

    // Get all templates for this profile
    const templates = await db.entityTemplate.findMany({
      where: {
        userId: session.userId,
        profileId: id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Templates List Error:', error);
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}

/**
 * POST /api/profiles/[id]/entities/templates
 * Create a new entity template
 * 
 * Body:
 * - name: string (required)
 * - description?: string
 * - structure: EntityTemplateStructure (required)
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

    const body = await req.json();
    const { name, description, structure } = body;

    // Validate required fields
    if (!name || !structure) {
      return NextResponse.json(
        { error: 'Missing required fields: name and structure' },
        { status: 400 }
      );
    }

    // Validate structure has required fields
    if (!structure.layout || !Array.isArray(structure.sections)) {
      return NextResponse.json(
        { error: 'Invalid structure: must have layout and sections array' },
        { status: 400 }
      );
    }

    // Create template
    const template = await transaction(async (tx: PrismaClient) => {
      return await tx.entityTemplate.create({
        data: {
          userId: session.userId,
          profileId: id,
          name,
          description: description || null,
          structure,
        },
      });
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage.includes('unique') || errorMessage.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Template with this name already exists for this profile' },
        { status: 409 }
      );
    }
    console.error('[API] Entity Template Create Error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

