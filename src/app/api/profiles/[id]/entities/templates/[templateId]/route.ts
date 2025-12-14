/**
 * Entity Template API Routes (Single Template)
 * 
 * GET: Get a specific template
 * PUT: Update a template
 * DELETE: Delete a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { db, transaction } from '@/lib/db';
import { PrismaClient } from '@prisma/client';

/**
 * GET /api/profiles/[id]/entities/templates/[templateId]
 * Get a specific entity template
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

    // Get template
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

    return NextResponse.json({ template });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Template Get Error:', error);
    return NextResponse.json({ error: 'Failed to get template' }, { status: 500 });
  }
}

/**
 * PUT /api/profiles/[id]/entities/templates/[templateId]
 * Update an entity template
 * 
 * Body:
 * - name?: string
 * - description?: string
 * - structure?: EntityTemplateStructure
 */
export async function PUT(
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
    const existing = await db.entityTemplate.findFirst({
      where: {
        id: templateId,
        userId: session.userId,
        profileId: id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const body = await req.json();
    const updateData: {
      name?: string;
      description?: string | null;
      structure?: any;
    } = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.structure !== undefined) {
      // Validate structure
      if (!body.structure.layout || !Array.isArray(body.structure.sections)) {
        return NextResponse.json(
          { error: 'Invalid structure: must have layout and sections array' },
          { status: 400 }
        );
      }
      updateData.structure = body.structure;
    }

    // Update template
    const template = await transaction(async (tx: PrismaClient) => {
      return await tx.entityTemplate.update({
        where: { id: templateId },
        data: updateData,
      });
    });

    return NextResponse.json({ template });
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
    console.error('[API] Entity Template Update Error:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

/**
 * DELETE /api/profiles/[id]/entities/templates/[templateId]
 * Delete an entity template
 */
export async function DELETE(
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
    const existing = await db.entityTemplate.findFirst({
      where: {
        id: templateId,
        userId: session.userId,
        profileId: id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Delete template (cascade will delete instances)
    await transaction(async (tx: PrismaClient) => {
      await tx.entityTemplate.delete({
        where: { id: templateId },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Template Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}

