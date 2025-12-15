/**
 * Entity Duplicate API Route
 * 
 * POST: Duplicate an entity (creates new entity with same structure, empty data)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { db, transaction } from '@/lib/db';

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

    const sourceEntity = await db.entity.findUnique({
      where: {
        id: entityId,
      },
    });

    if (!sourceEntity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    // Verify ownership
    if (sourceEntity.userId !== session.userId || sourceEntity.profileId !== profileId) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const baseName = body.name?.trim() || `${sourceEntity.name} (Copy)`;
    
    // Validate source entity has required fields
    if (!sourceEntity.name || !sourceEntity.name.trim()) {
      return NextResponse.json({ error: 'Source entity has invalid name' }, { status: 400 });
    }

    // Ensure structure and data are valid JSON objects
    // Handle Prisma JsonNull and null values
    let structure = sourceEntity.structure;
    if (structure === null || structure === undefined || typeof structure !== 'object' || Array.isArray(structure)) {
      console.warn('[API] Source entity has invalid structure, using default');
      structure = { layout: 'grid', fields: [] };
    } else {
      // Ensure structure has required fields
      if (!structure.layout || !Array.isArray(structure.fields)) {
        console.warn('[API] Source entity structure missing required fields, using default');
        structure = { layout: 'grid', fields: [] };
      }
    }
    
    let data = sourceEntity.data;
    if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) {
      console.warn('[API] Source entity has invalid data, using default');
      data = {};
    }
    
    // Retry helper for database queries
    async function retryQuery<T>(
      queryFn: () => Promise<T>,
      retries = 3,
      delay = 100
    ): Promise<T> {
      for (let i = 0; i < retries; i++) {
        try {
          return await queryFn();
        } catch (error) {
          if (
            error instanceof Error &&
            (error.message.includes('Connection terminated') ||
              error.message.includes('timeout') ||
              error.message.includes('Connection terminated unexpectedly')) &&
            i < retries - 1
          ) {
            console.warn(`[DB Retry] Attempt ${i + 1} failed, retrying in ${delay}ms...`, error.message);
            await new Promise((res) => setTimeout(res, delay));
            delay *= 2; // Exponential backoff
          } else {
            throw error;
          }
        }
      }
      throw new Error('Max retries reached for database query.');
    }

    // Ensure the name is unique within the profile
    // Check if a name conflict exists and append a number if needed
    let newName = baseName;
    let counter = 1;
    while (true) {
      const existing = await retryQuery(() =>
        db.entity.findFirst({
          where: {
            profileId: profileId,
            name: newName,
          },
        })
      );
      
      if (!existing) {
        break; // Name is unique, we can use it
      }
      
      // Name exists, try with a number suffix
      newName = `${baseName} (${counter})`;
      counter++;
      
      // Safety check to prevent infinite loop
      if (counter > 100) {
        newName = `${baseName} (${Date.now()})`;
        break;
      }
    }

    // Validate final name
    if (!newName || !newName.trim()) {
      return NextResponse.json({ error: 'Failed to generate valid entity name' }, { status: 500 });
    }

    // Validate all required fields before creating
    if (!session.userId) {
      return NextResponse.json({ error: 'User ID is missing' }, { status: 500 });
    }
    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID is missing' }, { status: 500 });
    }
    if (!newName.trim()) {
      return NextResponse.json({ error: 'Entity name is missing' }, { status: 500 });
    }
    if (!structure || typeof structure !== 'object' || Array.isArray(structure)) {
      return NextResponse.json({ error: 'Invalid structure' }, { status: 500 });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 500 });
    }

    // Log values for debugging
    console.log('[API] Duplicate Entity - Values:', {
      userId: session.userId,
      profileId: profileId,
      name: newName.trim(),
      nameLength: newName.trim().length,
      description: sourceEntity.description ? String(sourceEntity.description).trim() : null,
      structureType: typeof structure,
      structureIsArray: Array.isArray(structure),
      structureKeys: structure && typeof structure === 'object' ? Object.keys(structure) : 'N/A',
      structureValue: JSON.stringify(structure).substring(0, 200),
      dataType: typeof data,
      dataIsArray: Array.isArray(data),
      dataKeys: data && typeof data === 'object' ? Object.keys(data) : 'N/A',
      dataValue: JSON.stringify(data).substring(0, 200),
      isActive: sourceEntity.isActive ?? true,
    });

    // Create duplicate entity with same structure but empty data
    // Convert Prisma Json types to plain JavaScript objects (if needed)
    // This ensures compatibility with Prisma's create operation
    const plainStructure = JSON.parse(JSON.stringify(structure));
    const plainData = JSON.parse(JSON.stringify(data || {}));
    
    // Use direct db.create instead of transaction for single operation
    // Match the EXACT pattern from POST route (including description and data handling)
    const duplicatedEntity = await db.entity.create({
      data: {
        userId: session.userId,
        profileId: profileId,
        name: newName.trim(),
        description: sourceEntity.description?.trim() || null,
        structure: plainStructure,
        data: plainData,
        isActive: sourceEntity.isActive ?? true,
      },
    });

    // Invalidate cache when entity is duplicated
    const { clearCachedEntities } = await import('@/lib/server-cache');
    clearCachedEntities(session.userId, profileId);

    return NextResponse.json({ entity: duplicatedEntity }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Log full error details for debugging
    console.error('[API] Entity Duplicate Error:', error);
    if (error instanceof Error) {
      console.error('[API] Error stack:', error.stack);
      // Check for Prisma errors
      if ('code' in error) {
        console.error('[API] Prisma error code:', (error as { code: string }).code);
      }
    }
    
    return NextResponse.json({ 
      error: 'Failed to duplicate entity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

