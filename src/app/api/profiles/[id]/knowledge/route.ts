import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getOwnedProfile, getProfile } from '@/lib/profile-service';
import { db } from '@/lib/db';
import {
  CONTAINERS,
  convertKnowledgeDocumentToPdf,
  deleteAsset,
  extractPdfPages,
  extractKnowledgeText,
  uploadAsset,
} from '@/lib/blob-storage';
import {
  chunkKnowledgeText,
  deleteKnowledgeFileChunks,
  indexKnowledgeFile,
} from '@/lib/knowledge-search';

const MAX_KNOWLEDGE_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'txt', 'md', 'json']);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    if (!await getProfile(session.userId, id)) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const knowledgeFiles = await db.knowledgeFile.findMany({
      where: { profileId: id },
      orderBy: { uploadedAt: 'asc' },
    });

    return NextResponse.json({
      files: knowledgeFiles.map((file) => ({
        id: file.id,
        filename: file.filename,
        indexed: file.azureSearchIndexed,
        chunkCount: file.chunkCount,
        pageCount: file.pageCount,
        visualizable: Boolean(file.renderedPdfBlobUrl),
        indexedAt: file.indexedAt?.toISOString() || null,
        uploadedAt: file.uploadedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Knowledge fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch knowledge files' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');
    const filename = searchParams.get('filename');
    if (!fileId && !filename) {
      return NextResponse.json({ error: 'fileId parameter is required' }, { status: 400 });
    }
    if (!await getOwnedProfile(session.userId, id)) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const knowledgeFile = await db.knowledgeFile.findFirst({
      where: {
        userId: session.userId,
        profileId: id,
        ...(fileId ? { id: fileId } : { filename: filename! }),
      },
    });
    if (!knowledgeFile) {
      return NextResponse.json({ error: 'Knowledge file not found' }, { status: 404 });
    }

    await deleteKnowledgeFileChunks(knowledgeFile.id);
    if (knowledgeFile.renderedPdfBlobUrl) {
      await deleteAsset(knowledgeFile.renderedPdfBlobUrl);
    }
    await deleteAsset(knowledgeFile.blobUrl);
    await db.knowledgeFile.delete({ where: { id: knowledgeFile.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Knowledge delete error:', error);
    return NextResponse.json({ error: 'Failed to delete knowledge file' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    if (!await getOwnedProfile(session.userId, id)) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const filename = file.name.trim();
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    if (!filename || !ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: 'Supported file types are PDF, DOCX, TXT, Markdown, and JSON' },
        { status: 400 }
      );
    }
    if (file.size <= 0 || file.size > MAX_KNOWLEDGE_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Knowledge files must be between 1 byte and 5 MB' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let content: string;
    let pdfBuffer: Buffer | null = null;
    let pages: Array<{ pageNumber: number; content: string }> | undefined;
    try {
      pdfBuffer = await convertKnowledgeDocumentToPdf(buffer, filename);
      if (pdfBuffer) {
        pages = await extractPdfPages(pdfBuffer);
        content = pages.map((page) => page.content).join('\n\n');
      } else {
        content = await extractKnowledgeText(buffer, filename);
      }
      chunkKnowledgeText(content);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Text extraction failed';
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const blobUrl = await uploadAsset(buffer, {
      userId: session.userId,
      profileId: id,
      filename,
      contentType: file.type || 'application/octet-stream',
      container: CONTAINERS.KNOWLEDGE_FILES,
    });
    let renderedPdfBlobUrl: string | null = null;
    if (pdfBuffer) {
      const pdfFilename = `${filename.replace(/\.[^.]+$/, '')}.rendered.pdf`;
      try {
        renderedPdfBlobUrl = await uploadAsset(pdfBuffer, {
          userId: session.userId,
          profileId: id,
          filename: pdfFilename,
          contentType: 'application/pdf',
          container: CONTAINERS.KNOWLEDGE_FILES,
        });
      } catch (error) {
        await deleteAsset(blobUrl).catch(() => undefined);
        throw error;
      }
    }

    let knowledgeFile;
    try {
      knowledgeFile = await db.knowledgeFile.create({
        data: {
          userId: session.userId,
          profileId: id,
          filename,
          blobUrl,
          renderedPdfBlobUrl,
          pageCount: pages?.length || null,
          azureSearchIndexed: false,
          chunkCount: 0,
          embeddingModel: 'text-embedding-3-small',
        },
      });
    } catch (error) {
      await deleteAsset(blobUrl).catch(() => undefined);
      if (renderedPdfBlobUrl) await deleteAsset(renderedPdfBlobUrl).catch(() => undefined);
      throw error;
    }

    try {
      const chunkCount = await indexKnowledgeFile({
        knowledgeFileId: knowledgeFile.id,
        userId: session.userId,
        profileId: id,
        filename,
        content,
        pages,
        uploadedAt: knowledgeFile.uploadedAt,
      });
      knowledgeFile = await db.knowledgeFile.update({
        where: { id: knowledgeFile.id },
        data: {
          azureSearchIndexed: true,
          chunkCount,
          indexedAt: new Date(),
          embeddingModel: 'text-embedding-3-small',
        },
      });
    } catch (error) {
      console.error(`[API] Failed to index knowledge file ${knowledgeFile.id}:`, error);
      return NextResponse.json({
        success: true,
        indexed: false,
        filename: knowledgeFile.filename,
        id: knowledgeFile.id,
        warning: 'The file was stored but indexing failed. Run the reindex command to retry.',
      }, { status: 202 });
    }

    return NextResponse.json({
      success: true,
      indexed: true,
      chunkCount: knowledgeFile.chunkCount,
      filename: knowledgeFile.filename,
      id: knowledgeFile.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Knowledge upload error:', error);
    return NextResponse.json({ error: 'Failed to upload knowledge file' }, { status: 500 });
  }
}
