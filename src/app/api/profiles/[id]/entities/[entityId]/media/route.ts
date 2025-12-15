/**
 * Entity Media Upload API Route
 * 
 * POST: Upload a media file for an entity field
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { db, transaction } from '@/lib/db';
import { uploadAsset, CONTAINERS, deleteAsset } from '@/lib/blob-storage';

/**
 * POST /api/profiles/[id]/entities/[entityId]/media
 * Upload a media file for an entity field
 * 
 * Form Data:
 * - file: File (required)
 * - fieldId: string (required) - Field ID from entity structure
 * - altText?: string
 * - caption?: string
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: profileId, entityId } = await params;

    // Verify profile ownership
    const profile = await getProfile(session.userId, profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Verify entity ownership
    const entity = await db.entity.findFirst({
      where: {
        id: entityId,
        userId: session.userId,
        profileId: profileId,
      },
    });

    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
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
        profileId: profileId,
        filename: filename,
        contentType: mimeType,
        container: CONTAINERS.ENTITY_MEDIA,
        instanceId: entityId, // Keep for backward compatibility with blob path
        fieldId: fieldId,
      });

      if (!uploadedBlobUrl) {
        return NextResponse.json({ error: 'Failed to upload file to blob storage' }, { status: 500 });
      }

      // At this point, uploadedBlobUrl is definitely a string
      const blobUrl: string = uploadedBlobUrl;

      // Extract blob name from URL
      const url = new URL(blobUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const blobName = pathParts.slice(1).join('/'); // Remove container name

      // Get next order index for this field
      const existingMedia = await db.entityMediaFile.findMany({
        where: {
          entityId: entityId,
          fieldId: fieldId,
        },
        orderBy: {
          orderIndex: 'desc',
        },
        take: 1,
      });

      const orderIndex = existingMedia.length > 0 ? existingMedia[0].orderIndex + 1 : 0;

      // Save media file metadata to database
      const mediaFile = await transaction(async (tx) => {
        return await tx.entityMediaFile.create({
          data: {
            entityId: entityId,
            fieldId: fieldId,
            blobUrl: blobUrl,
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

