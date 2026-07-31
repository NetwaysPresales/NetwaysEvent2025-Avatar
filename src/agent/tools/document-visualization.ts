import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { db } from '@/lib/db';
import { searchKnowledge } from '@/lib/knowledge-search';

function selectEvidenceQuote(content: string, query: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  const queryTerms = [...new Set((query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((term) => term.length >= 3))];
  const sentences = normalized.split(/(?<=[.!?؟])\s+/u).filter(Boolean);
  if (!sentences.length) return normalized.slice(0, 600);

  let bestIndex = 0;
  let bestScore = -1;
  sentences.forEach((sentence, index) => {
    const lower = sentence.toLowerCase();
    const score = queryTerms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  const selected = [sentences[bestIndex]];
  if (selected.join(' ').length < 260 && sentences[bestIndex + 1]) selected.push(sentences[bestIndex + 1]);
  if (selected.join(' ').length < 180 && sentences[bestIndex - 1]) selected.unshift(sentences[bestIndex - 1]);
  return selected.join(' ').slice(0, 600);
}

export function createDocumentVisualizationTool(userId: string, profileId: string) {
  return new DynamicStructuredTool({
    name: 'visualize_document',
    description: 'Temporarily open one exact rendered policy page in the Sources workspace. Call this at most once per user turn, after knowledge retrieval, and only when seeing the source page materially helps the user verify or understand the answer. Select the single strongest page and keep it visible for 20-30 seconds based on reading complexity; use 20 seconds when unsure. Do not call it for greetings, simple conversation, or answers that do not benefit from documentary evidence.',
    schema: z.object({
      query: z.string().min(1).max(1000).describe('A precise phrase or policy question matching the evidence that should be shown'),
      displaySeconds: z.number().int().min(20).max(30).optional().default(20).describe('How many seconds the evidence should remain open; minimum 20 seconds'),
    }),
    func: async ({ query, displaySeconds }: { query: string; displaySeconds: number }): Promise<string> => {
      try {
        const results = await searchKnowledge({ userId, profileId, query, top: 5 });
        const pageResults = results.filter((result) => result.pageNumber);
        if (!pageResults.length) {
          return JSON.stringify({ found: false, error: 'No page-faithful source is available for this evidence.' });
        }

        const files = await db.knowledgeFile.findMany({
          where: {
            userId,
            profileId,
            id: { in: pageResults.map((result) => result.knowledgeFileId) },
            renderedPdfBlobUrl: { not: null },
          },
          select: { id: true },
        });
        const availableIds = new Set(files.map((file) => file.id));
        const evidence = pageResults.find((result) => availableIds.has(result.knowledgeFileId));
        if (!evidence?.pageNumber) {
          return JSON.stringify({ found: false, error: 'The matching source has not been rendered for visual display.' });
        }

        return JSON.stringify({
          found: true,
          knowledgeFileId: evidence.knowledgeFileId,
          filename: evidence.filename,
          pageNumber: evidence.pageNumber,
          quote: selectEvidenceQuote(evidence.content, query),
          documentUrl: `/api/profiles/${encodeURIComponent(profileId)}/knowledge/${encodeURIComponent(evidence.knowledgeFileId)}/document`,
          displayDurationMs: displaySeconds * 1000,
        });
      } catch (error) {
        console.error('[Tool] Document visualization error:', error);
        return JSON.stringify({ found: false, error: 'The document visualization service is temporarily unavailable.' });
      }
    },
  });
}
