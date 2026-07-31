import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../src/lib/db';
import {
  CONTAINERS,
  convertKnowledgeDocumentToPdf,
  deleteAsset,
  extractPdfPages,
  uploadAsset,
} from '../src/lib/blob-storage';
import { deleteKnowledgeFileChunks, indexKnowledgeFile } from '../src/lib/knowledge-search';

const FILE_PATH = 'C:\\Users\\abdullah\\Downloads\\Erth_Zayed_AI_Knowledge_Base_V1 (3).docx';
const PROFILE_IDS = [
  '6402f32f-17b6-4ccc-9054-d45a610ec2f9',
  '538d934e-d0ce-4ed6-bf42-55d00d3eb5e0',
];

async function main() {
  const filename = path.basename(FILE_PATH);
  const sourceBuffer = await readFile(FILE_PATH);
  const pdfBuffer = await convertKnowledgeDocumentToPdf(sourceBuffer, filename);
  if (!pdfBuffer) throw new Error('The shared knowledge document could not be rendered');
  const pages = await extractPdfPages(pdfBuffer);
  const content = pages.map((page) => page.content).join('\n\n');

  for (const profileId of PROFILE_IDS) {
    const profile = await db.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new Error(`Profile not found: ${profileId}`);
    const existing = await db.knowledgeFile.findFirst({
      where: { userId: profile.userId, profileId, filename },
    });
    if (existing?.azureSearchIndexed && existing.renderedPdfBlobUrl && existing.pageCount) {
      console.log(`Already indexed for ${profile.name}: ${filename}`);
      continue;
    }
    if (existing) {
      await deleteKnowledgeFileChunks(existing.id);
      await deleteAsset(existing.blobUrl).catch(() => undefined);
      if (existing.renderedPdfBlobUrl) await deleteAsset(existing.renderedPdfBlobUrl).catch(() => undefined);
      await db.knowledgeFile.delete({ where: { id: existing.id } });
    }

    const blobUrl = await uploadAsset(sourceBuffer, {
      userId: profile.userId,
      profileId,
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      container: CONTAINERS.KNOWLEDGE_FILES,
    });
    let renderedPdfBlobUrl: string | null = null;
    try {
      renderedPdfBlobUrl = await uploadAsset(pdfBuffer, {
        userId: profile.userId,
        profileId,
        filename: `${filename.replace(/\.[^.]+$/, '')}.rendered.pdf`,
        contentType: 'application/pdf',
        container: CONTAINERS.KNOWLEDGE_FILES,
      });
      let record = await db.knowledgeFile.create({
        data: {
          userId: profile.userId,
          profileId,
          filename,
          blobUrl,
          renderedPdfBlobUrl,
          pageCount: pages.length,
          azureSearchIndexed: false,
          chunkCount: 0,
          embeddingModel: 'text-embedding-3-small',
        },
      });
      const chunkCount = await indexKnowledgeFile({
        knowledgeFileId: record.id,
        userId: profile.userId,
        profileId,
        filename,
        content,
        pages,
        uploadedAt: record.uploadedAt,
      });
      record = await db.knowledgeFile.update({
        where: { id: record.id },
        data: { azureSearchIndexed: true, chunkCount, indexedAt: new Date() },
      });
      console.log(`Indexed for ${profile.name}: ${pages.length} pages, ${record.chunkCount} chunks`);
    } catch (error) {
      await deleteAsset(blobUrl).catch(() => undefined);
      if (renderedPdfBlobUrl) await deleteAsset(renderedPdfBlobUrl).catch(() => undefined);
      throw error;
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
