import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfileAssetUrl, uploadProfileAsset, deleteProfileAsset } from '@/lib/profile-service';

/**
 * GET /api/profiles/[id]/assets
 * Get a SAS URL for a profile asset (logo or background)
 * 
 * Query params:
 * - assetType: 'logo' | 'background'
 * - expiresInMinutes: number (optional, default: 60)
 */
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const assetType = searchParams.get('assetType') as 'logo' | 'background';
        const expiresInMinutes = parseInt(searchParams.get('expiresInMinutes') || '60', 10);

        if (!assetType || (assetType !== 'logo' && assetType !== 'background')) {
            return NextResponse.json(
                { error: 'assetType parameter required (logo or background)' },
                { status: 400 }
            );
        }

        // Generate SAS URL (profile service handles ownership verification)
        const sasUrl = await getProfileAssetUrl(session.userId, id, assetType, expiresInMinutes);

        // Check if client wants JSON (for authenticated client-side fetching)
        const acceptHeader = req.headers.get('accept');
        if (acceptHeader?.includes('application/json')) {
            return NextResponse.json({ url: sasUrl });
        }

        // Redirect to SAS URL (for direct browser access)
        return NextResponse.redirect(sasUrl);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (errorMessage === 'Profile not found or unauthorized' || errorMessage.includes('Asset of type')) {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }
        console.error('Asset Fetch Error', error);
        return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
    }
}

/**
 * POST /api/profiles/[id]/assets
 * Upload a profile asset (logo or background) to Blob Storage
 * 
 * Form data:
 * - file: File
 * - assetType: 'logo' | 'background'
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();
        const { id } = await params;
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const assetType = formData.get('assetType') as 'logo' | 'background';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!assetType || (assetType !== 'logo' && assetType !== 'background')) {
            return NextResponse.json(
                { error: 'assetType parameter required (logo or background)' },
                { status: 400 }
            );
        }

        // Validate file size
        const maxSize = assetType === 'logo' ? 5 * 1024 * 1024 : 50 * 1024 * 1024; // 5MB logo, 50MB background
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: `File too large. Maximum size: ${maxSize / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        // Validate file type
        const allowedTypes = assetType === 'logo'
            ? ['image/png', 'image/jpeg', 'image/jpg']
            : ['image/png', 'image/jpeg', 'image/jpg', 'video/mp4', 'video/webm'];

        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` },
                { status: 400 }
            );
        }

        // Upload asset using profile service (handles ownership verification, blob upload, DB update, and transaction guarantees)
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await uploadProfileAsset(
            session.userId,
            id,
            assetType,
            buffer,
            file.name,
            file.type
        );

        return NextResponse.json({
            url: result.sasUrl,
            blobUrl: result.blobUrl,
            filename: result.filename,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (errorMessage === 'Profile not found or unauthorized') {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }
        if (errorMessage.includes('Failed to upload asset')) {
            return NextResponse.json({ error: errorMessage }, { status: 500 });
        }
        console.error('Asset Upload Error', error);
        return NextResponse.json({ error: 'Upload Failed' }, { status: 500 });
    }
}

/**
 * DELETE /api/profiles/[id]/assets
 * Delete a profile asset (logo or background)
 * 
 * Query params:
 * - assetType: 'logo' | 'background'
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();
        const { id } = await params;
        const { searchParams } = new URL(req.url);
        const assetType = searchParams.get('assetType') as 'logo' | 'background';

        if (!assetType || (assetType !== 'logo' && assetType !== 'background')) {
            return NextResponse.json(
                { error: 'assetType parameter required (logo or background)' },
                { status: 400 }
            );
        }

        // Delete asset using profile service (handles ownership verification, blob deletion, and DB update)
        await deleteProfileAsset(session.userId, id, assetType);

        return NextResponse.json({ success: true });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage === 'Unauthorized') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (errorMessage === 'Profile not found or unauthorized') {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }
        console.error('Asset Delete Error', error);
        return NextResponse.json({ error: 'Delete Failed' }, { status: 500 });
    }
}
