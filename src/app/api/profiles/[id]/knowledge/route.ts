import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db, transaction } from '@/lib/db';
import { uploadAsset, deleteAsset, CONTAINERS } from '@/lib/blob-storage';
import { getProfile } from '@/lib/profile-service';
import { PrismaClient } from '@prisma/client';

/**
 * GET /api/profiles/[id]/knowledge
 * List all knowledge files for a profile (with ownership verification)
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

        // Get knowledge files from database
        const files = await db.knowledgeFile.findMany({
            where: {
                profileId: id,
                userId: session.userId,
            },
            select: {
                id: true,
                filename: true,
                uploadedAt: true,
                azureSearchIndexed: true,
                chunkCount: true,
                indexedAt: true,
            },
            orderBy: {
                uploadedAt: 'desc',
            },
        });

        return NextResponse.json({ files });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('Knowledge List Error', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
}

/**
 * POST /api/profiles/[id]/knowledge
 * Upload a knowledge file to Blob Storage and save metadata to database
 * 
 * Note: Azure AI Search indexing will be added later when Azure AI Search is implemented
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

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file size (50MB max for knowledge files)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name;

        // Check if file with same name already exists for this profile
        const existing = await db.knowledgeFile.findFirst({
            where: {
                profileId: id,
                userId: session.userId,
                filename: filename,
            },
        });

        if (existing) {
            return NextResponse.json(
                { error: 'File with this name already exists for this profile' },
                { status: 409 }
            );
        }

        let uploadedBlobUrl: string | undefined;
        try {
            // Upload to Blob Storage
            uploadedBlobUrl = await uploadAsset(buffer, {
                userId: session.userId,
                profileId: id,
                filename: filename,
                contentType: file.type || 'application/octet-stream',
                container: CONTAINERS.KNOWLEDGE_FILES,
            });

            // Save metadata to database
            const knowledgeFile = await transaction(async (tx: PrismaClient) => {
                return await tx.knowledgeFile.create({
                    data: {
                        userId: session.userId,
                        profileId: id,
                        filename: filename,
                        blobUrl: uploadedBlobUrl!,
                        azureSearchIndexed: false, // Will be indexed later when Azure AI Search is implemented
                        chunkCount: 0,
                        embeddingModel: 'text-embedding-ada-002',
                    },
                });
            });

            return NextResponse.json({
                success: true,
                file: {
                    id: knowledgeFile.id,
                    filename: knowledgeFile.filename,
                    uploadedAt: knowledgeFile.uploadedAt,
                    azureSearchIndexed: knowledgeFile.azureSearchIndexed,
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
        if (errorMessage === 'Profile not found or unauthorized') {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }
        console.error('Knowledge Upload Error', error);
        return NextResponse.json({ error: 'Upload Failed' }, { status: 500 });
    }
}

/**
 * DELETE /api/profiles/[id]/knowledge
 * Delete a knowledge file from Blob Storage and database
 * 
 * Query params:
 * - fileId: UUID of the knowledge file (from database)
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const fileId = searchParams.get('fileId');

        if (!fileId) {
            return NextResponse.json({ error: 'fileId parameter required' }, { status: 400 });
        }

        // Verify ownership and get blob URL
        const knowledgeFile = await db.knowledgeFile.findFirst({
            where: {
                id: fileId,
                profileId: id,
                userId: session.userId,
            },
        });

        if (!knowledgeFile) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Delete from database and blob storage
        await transaction(async (tx: PrismaClient) => {
            // Delete from database first
            await tx.knowledgeFile.delete({
                where: { id: fileId },
            });

            // Delete from blob storage
            await deleteAsset(knowledgeFile.blobUrl);
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        console.error('Knowledge Delete Error', error);
        return NextResponse.json({ error: 'Delete Failed' }, { status: 500 });
    }
}
