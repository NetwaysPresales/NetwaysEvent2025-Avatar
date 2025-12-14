/**
 * Entity Media Upload API Route (under template/instance)
 * 
 * POST: Upload a media file for an entity instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { db, transaction } from '@/lib/db';
import { uploadAsset, CONTAINERS } from '@/lib/blob-storage';
import { PrismaClient } from '@prisma/client';

/**
 * POST /api/profiles/[id]/entities/templates/[templateId]/instances/[instanceId]/media
 * Upload a media file for an entity instance
 * 
 * Form Data:
 * - file: File (required)
 * - fieldId: string (required) - Field ID from template
 * - altText?: string
 * - caption?: string
 */
export async function POST(
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
    const instance = await db.entityInstance.findFirst({
      where: {
        id: instanceId,
        templateId: templateId,
        userId: session.userId,
        profileId: id,
      },
    });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fieldId = formData.get('fieldId') as string;
    const altText = formData.get('altText') as string | null;
    const caption = formData.get('caption') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!fieldId) {
      return NextResponse.json({ error: 'fieldId is required' }, { status: 400 });
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Determine file type
    const mimeType = file.type || 'application/octet-stream';
    let fileType: 'image' | 'video' | 'document' = 'document';
    if (mimeType.startsWith('image/')) {
      fileType = 'image';
    } else if (mimeType.startsWith('video/')) {
      fileType = 'video';
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;

    let uploadedBlobUrl: string | undefined;
    try {
      // Upload to Blob Storage
      uploadedBlobUrl = await uploadAsset(buffer, {
        userId: session.userId,
        profileId: id,
        filename: filename,
        contentType: mimeType,
        container: CONTAINERS.ENTITY_MEDIA,
        instanceId: instanceId,
        fieldId: fieldId,
      });

      // Extract blob name from URL
      const url = new URL(uploadedBlobUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const blobName = pathParts.slice(1).join('/'); // Remove container name

      // Get next order index for this field
      const existingMedia = await db.entityMediaFile.findMany({
        where: {
          entityInstanceId: instanceId,
          fieldId: fieldId,
        },
        orderBy: {
          orderIndex: 'desc',
        },
        take: 1,
      });

      const orderIndex = existingMedia.length > 0 ? existingMedia[0].orderIndex + 1 : 0;

      // Save media file metadata to database
      const mediaFile = await transaction(async (tx: PrismaClient) => {
        return await tx.entityMediaFile.create({
          data: {
            entityInstanceId: instanceId,
            fieldId: fieldId,
            blobUrl: uploadedBlobUrl,
            blobContainer: CONTAINERS.ENTITY_MEDIA,
            blobName: blobName,
            fileType: fileType,
            mimeType: mimeType,
            fileSize: BigInt(file.size),
            altText: altText || null,
            caption: caption || null,
            orderIndex: orderIndex,
          },
        });
      });

      return NextResponse.json({
        success: true,
        mediaFile: {
          id: mediaFile.id,
          fieldId: mediaFile.fieldId,
          blobUrl: mediaFile.blobUrl,
          fileType: mediaFile.fileType,
          mimeType: mediaFile.mimeType,
          altText: mediaFile.altText,
          caption: mediaFile.caption,
          orderIndex: mediaFile.orderIndex,
        },
      });
    } catch (error) {
      // If DB update failed, clean up the uploaded blob
      if (uploadedBlobUrl) {
        const { deleteAsset } = await import('@/lib/blob-storage');
        deleteAsset(uploadedBlobUrl).catch((err) =>
          console.error(`Failed to clean up orphaned blob ${uploadedBlobUrl}:`, err)
        );
      }
      throw error;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Entity Media Upload Error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

