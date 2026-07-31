import 'dotenv/config';
import { db } from '../src/lib/db';
import {
  CONTAINERS,
  convertKnowledgeDocumentToPdf,
  downloadBlobAsText,
  downloadBlobBuffer,
  extractPdfPages,
  uploadAsset,
} from '../src/lib/blob-storage';
import {
  ensureKnowledgeSearchIndex,
  indexKnowledgeFile,
} from '../src/lib/knowledge-search';

async function main() {
  await ensureKnowledgeSearchIndex();
  const reindexAll = process.argv.includes('--all');
  const files = await db.knowledgeFile.findMany({
    where: reindexAll ? undefined : { azureSearchIndexed: false },
    orderBy: { uploadedAt: 'asc' },
  });

  console.log(`Indexing ${files.length} knowledge file(s)...`);
  for (const file of files) {
    try {
      let content: string;
      let pages: Array<{ pageNumber: number; content: string }> | undefined;
      let renderedPdfBlobUrl = file.renderedPdfBlobUrl;
      const extension = file.filename.split('.').pop()?.toLowerCase();
      if (renderedPdfBlobUrl || extension === 'docx' || extension === 'pdf') {
        let pdfBuffer: Buffer;
        if (renderedPdfBlobUrl) {
          pdfBuffer = await downloadBlobBuffer(renderedPdfBlobUrl);
        } else {
          const sourceBuffer = await downloadBlobBuffer(file.blobUrl);
          const converted = await convertKnowledgeDocumentToPdf(sourceBuffer, file.filename);
          if (!converted) throw new Error(`No PDF renderer is available for ${file.filename}`);
          pdfBuffer = converted;
          renderedPdfBlobUrl = await uploadAsset(pdfBuffer, {
            userId: file.userId,
            profileId: file.profileId,
            filename: `${file.filename.replace(/\.[^.]+$/, '')}.rendered.pdf`,
            contentType: 'application/pdf',
            container: CONTAINERS.KNOWLEDGE_FILES,
          });
        }
        pages = await extractPdfPages(pdfBuffer);
        content = pages.map((page) => page.content).join('\n\n');
      } else {
        content = await downloadBlobAsText(file.blobUrl);
      }
      const chunkCount = await indexKnowledgeFile({
        knowledgeFileId: file.id,
        userId: file.userId,
        profileId: file.profileId,
        filename: file.filename,
        content,
        pages,
        uploadedAt: file.uploadedAt,
      });
      await db.knowledgeFile.update({
        where: { id: file.id },
        data: {
          azureSearchIndexed: true,
          chunkCount,
          indexedAt: new Date(),
          embeddingModel: 'text-embedding-3-small',
          renderedPdfBlobUrl,
          pageCount: pages?.length || null,
        },
      });
      console.log(`Indexed ${file.filename} (${chunkCount} chunks)`);
    } catch (error) {
      await db.knowledgeFile.update({
        where: { id: file.id },
        data: {
          azureSearchIndexed: false,
          chunkCount: 0,
          indexedAt: null,
        },
      });
      console.error(`Failed to index ${file.filename}:`, error);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
