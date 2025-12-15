import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getCachedKnowledgeFiles } from '@/lib/knowledge-cache';

/**
 * Create a knowledge base tool that uses database knowledge files
 * 
 * @param userId - User ID
 * @param profileId - Profile ID
 * @returns Knowledge base tool
 */
export function createKnowledgeBaseTool(userId: string, profileId: string) {
  const knowledgeTool = new DynamicStructuredTool({
    name: 'knowledge_base',
    description: 'Access the dynamic knowledge base. Input can be "list" to see files, or a specific topic/filename to search for information. Always check this if you cannot answer from your system prompt.',
    schema: z.object({
      query: z.string().describe('The search query, filename, or "list" to see available files')
    }),
    func: async ({ query }: { query: string }): Promise<string> => {
      try {
        const command = (query || '').trim().toLowerCase();

        // Get cached knowledge files from database
        const cachedFiles = await getCachedKnowledgeFiles(userId, profileId);

        if (cachedFiles.length === 0) {
          return "The knowledge base is empty. Upload files to add knowledge.";
        }

        // If input asks to list files or "what do you know"
        if (command.includes('list') || command === 'files') {
          const fileList = cachedFiles.map(f => f.filename).join(', ');
          return `Available knowledge files: ${fileList}. Ask me about any topic in these files, or use a filename to read a specific file.`;
        }

        // Try exact filename match first
        let targetFile = cachedFiles.find(
          f => f.filename.toLowerCase() === command || 
               f.filename.toLowerCase() === command + '.json' || 
               f.filename.toLowerCase() === command + '.txt'
        );

        // Try partial filename match
        if (!targetFile) {
          targetFile = cachedFiles.find(
            f => f.filename.toLowerCase().includes(command) || 
                 command.includes(f.filename.toLowerCase().replace(/\.[^/.]+$/, ""))
          );
        }

        // If filename match found, return that file's content
        if (targetFile) {
          const content = targetFile.content;
          // If JSON, try to format it nicely
          if (targetFile.filename.endsWith('.json')) {
            try {
              const parsed = JSON.parse(content);
              return JSON.stringify(parsed, null, 2);
            } catch {
              return content;
            }
          }
          return content;
        }

        // If no filename match, search content for keywords
        let combinedResults = '';
        for (const file of cachedFiles) {
          const content = file.content.toLowerCase();
          if (content.includes(command)) {
            // Extract relevant snippet (first 500 chars around match)
            const index = content.indexOf(command);
            const start = Math.max(0, index - 200);
            const end = Math.min(content.length, index + command.length + 300);
            const snippet = file.content.substring(start, end);
            combinedResults += `\n\n--- Content from ${file.filename} ---\n${snippet}...`;
          }
        }

        if (combinedResults) {
          // Limit total length to avoid token limits
          return combinedResults.slice(0, 8000);
        }

        return `No relevant information found in the knowledge base for: "${query}". Available files: ${cachedFiles.map(f => f.filename).join(', ')}. Try asking about a specific topic or file.`;

      } catch (error) {
        console.error('[Tool] Knowledge Error:', error);
        return "Error accessing knowledge base. Please try again.";
      }
    }
  });
  
  return knowledgeTool;
}

