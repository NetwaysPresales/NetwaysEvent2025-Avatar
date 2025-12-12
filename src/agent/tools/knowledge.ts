import { tool } from '@langchain/core/tools';
import fs from 'fs/promises';
import path from 'path';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'src', 'knowledge');

export const knowledgeBaseTool = tool(
    async (input: string) => {
        try {
            const command = input.trim().toLowerCase();

            // If input asks to list files or "what do you know"
            if (command.includes('list') || command === 'files') {
                const files = await fs.readdir(KNOWLEDGE_DIR);
                const visible = files.filter(f => !f.startsWith('.'));
                if (visible.length === 0) return "The knowledge base is empty.";
                return `Available files: ${visible.join(', ')}. Use this tool again with a filename to read it.`;
            }

            // Otherwise, assume input matches a filename or partial filename
            const files = await fs.readdir(KNOWLEDGE_DIR);

            // Try exact match first
            let targetFile = files.find(f => f.toLowerCase() === command || f.toLowerCase() === command + '.json' || f.toLowerCase() === command + '.txt');

            // Try partial match
            if (!targetFile) {
                targetFile = files.find(f => f.toLowerCase().includes(command) || command.includes(f.toLowerCase().replace(/\.[^/.]+$/, "")));
            }

            if (targetFile) {
                const content = await fs.readFile(path.join(KNOWLEDGE_DIR, targetFile), 'utf-8');
                // If JSON, parse and stringify to minify
                if (targetFile.endsWith('.json')) {
                    try {
                        return JSON.stringify(JSON.parse(content));
                    } catch {
                        return content;
                    }
                }
                return content;
            }

            // If no file match, iterate all files and search for keywords (simple search)
            // Limit to scanning smaller files for performance? For now, scan all text/json.
            let combinedResults = '';
            for (const file of files) {
                if (file.endsWith('.json') || file.endsWith('.txt') || file.endsWith('.md')) {
                    const content = await fs.readFile(path.join(KNOWLEDGE_DIR, file), 'utf-8');
                    if (content.toLowerCase().includes(command)) {
                        combinedResults += `\n\n--- Content from ${file} ---\n${content}`;
                    }
                }
            }

            if (combinedResults) {
                // Truncate if too long?
                return combinedResults.slice(0, 8000); // 8k chars limit for context
            }

            return "No relevant files or content found in the knowledge base.";

        } catch (error) {
            console.error('[Tool] Knowledge Error:', error);
            return "Error accessing knowledge base.";
        }
    },
    {
        name: 'knowledge_base',
        description: 'Access the dynamic knowledge base. Input can be "list" to see files, or a specific topic/filename to search for information. Always check this if you cannot answer from your system prompt.'
    }
);
