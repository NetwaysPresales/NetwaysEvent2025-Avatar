import { tool } from '@langchain/core/tools';
import fs from 'fs/promises';
import path from 'path';

/**
 * NOTE: This tool uses file system temporarily for entity lookup.
 * This will be replaced with the entity visualization system (see CONSOLIDATED_PLAN.md Part 6.5).
 * The file system dependency is acceptable for now but should be migrated to database + blob storage.
 */
const KNOWLEDGE_FILE = path.join(process.cwd(), 'src', 'knowledge', 'sca_entities.json');

interface Entity {
  name: string;
  license?: string;
  narration?: string;
  [key: string]: unknown;
}

export function localRetrieverTool() {
  return tool(
    async (input: string) => {
      let key = input.trim().toLowerCase();

      // Load entities dynamically
      let entities: Entity[] = [];
      try {
        const fileContent = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
        entities = JSON.parse(fileContent);
      } catch (err) {
        console.error('[Tool] Failed to load entities:', err);
        return 'Error loading company data.';
      }

      // Handle common variations for "4T Global Markets"
      if (key.includes('40 global') || key.includes('forty global') || key.includes('fourty global')) {
        key = '4t global markets';
      }

      // Find entity by matching name (prioritize exact matches first)
      let found = entities.find((e) => {
        const name = e.name.toLowerCase().replace(/\s*pjsc\s*/g, '').replace(/\s*llc\s*/g, '').replace(/\s*financial services\s*/g, '').trim();
        const cleanKey = key.replace(/\s*pjsc\s*/g, '').replace(/\s*llc\s*/g, '').replace(/\s*financial services\s*/g, '').trim();

        // Exact match (highest priority)
        if (name === cleanKey || name.replace(/\s+/g, ' ') === cleanKey) {
          return true;
        }
        return false;
      });

      // If no exact match, try partial matching
      if (!found) {
        found = entities.find((e) => {
          const name = e.name.toLowerCase().replace(/\s*pjsc\s*/g, '').trim();
          return name.includes(key) || key.includes(name);
        });
      }

      if (!found) {
        return 'No information available.';
      }

      // Return marker for API to extract, followed by narration for agent to speak
      return `[SHOW_ENTITY:${found.license}]\n${found.narration || found.name}`;
    },
    {
      name: 'get_company_info',
      description:
        'Get company information. Input: company name in English lowercase (e.g., "noor capital", "abu dhabi commercial bank", "4t global markets"). Note: "40 global markets" and "forty global markets" map to "4T Global Markets". Output: company details with [SHOW_ENTITY:...] marker.'
    }
  );
}


