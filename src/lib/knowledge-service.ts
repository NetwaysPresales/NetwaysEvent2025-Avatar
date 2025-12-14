/**
 * Knowledge Service
 * 
 * Temporary "hack" implementation: Reads knowledge files from cache (preloaded when session starts)
 * and injects them directly into the system prompt.
 * 
 * TODO: Replace with Azure AI Search integration when ready.
 * This makes it easy to swap out - just replace the buildSystemPromptWithKnowledge
 * function with a call to the proper knowledge base tool.
 */

import { getCachedKnowledgeFiles } from './knowledge-cache';
import { getCachedKnowledgeFiles as getServerCachedKnowledgeFiles, setCachedKnowledgeFiles as setServerCachedKnowledgeFiles, getCachedEntities, setCachedEntities } from './server-cache';
import { db } from './db';
import { downloadBlobAsText } from './blob-storage';

/**
 * Build system prompt with knowledge files injected
 * 
 * Reads all cached knowledge files for a profile and appends their content to the system prompt.
 * Files should be preloaded using preloadKnowledgeFiles() when avatar session starts.
 * 
 * @param userId - User ID
 * @param profileId - Profile ID
 * @param baseSystemPrompt - Base system prompt from profile config
 * @returns Enhanced system prompt with knowledge file contents
 */
export async function buildSystemPromptWithKnowledge(
  userId: string,
  profileId: string,
  baseSystemPrompt: string
): Promise<string> {
  // First, get current max uploadedAt timestamp from database to check for changes
  const knowledgeFilesMeta = await db.knowledgeFile.findMany({
    where: {
      userId,
      profileId,
    },
    select: {
      uploadedAt: true,
    },
    orderBy: {
      uploadedAt: 'desc',
    },
    take: 1,
  });

  const currentLastModified = knowledgeFilesMeta.length > 0
    ? knowledgeFilesMeta[0].uploadedAt.getTime()
    : 0;

  // Try server-side cache first (fastest), with timestamp validation
  let cachedFiles = getServerCachedKnowledgeFiles(userId, profileId, currentLastModified);

  // If not in server cache, try disk cache (from preload)
  if (!cachedFiles) {
    cachedFiles = await getCachedKnowledgeFiles(userId, profileId);
    
    // If found in disk cache, also populate server cache for next time
    if (cachedFiles && cachedFiles.length > 0) {
      setServerCachedKnowledgeFiles(userId, profileId, cachedFiles, currentLastModified);
    }
  }

  // If still not found, fetch from database and cache
  if (!cachedFiles || cachedFiles.length === 0) {
    const knowledgeFiles = await db.knowledgeFile.findMany({
      where: {
        userId,
        profileId,
      },
      orderBy: {
        uploadedAt: 'asc',
      },
    });

    if (knowledgeFiles.length === 0) {
      return baseSystemPrompt;
    }

    // Recalculate lastModified from full list
    const maxUploadedAt = Math.max(...knowledgeFiles.map(f => f.uploadedAt.getTime()));

    // Download and cache
    cachedFiles = await Promise.all(
      knowledgeFiles.map(async (file) => {
        try {
          const content = await downloadBlobAsText(file.blobUrl);
          let formattedContent = content;
          if (file.filename.endsWith('.json')) {
            try {
              const parsed = JSON.parse(content);
              formattedContent = JSON.stringify(parsed, null, 2);
            } catch {
              // Use raw content if parsing fails
            }
          }
          return { filename: file.filename, content: formattedContent };
        } catch (error) {
          console.error(`[Knowledge Service] Failed to download ${file.filename}:`, error);
          return { filename: file.filename, content: '' };
        }
      })
    );

    // Cache for next time with timestamp
    if (cachedFiles.length > 0) {
      setServerCachedKnowledgeFiles(userId, profileId, cachedFiles, maxUploadedAt);
    }
  }

  if (cachedFiles.length === 0) {
    return baseSystemPrompt;
  }

  // Build knowledge sections from cached files
  const knowledgeSections = cachedFiles.map(
    (file) => `\n\n--- Knowledge File: ${file.filename} ---\n${file.content}\n--- End of ${file.filename} ---`
  );

  // Combine base prompt with knowledge files
  const enhancedPrompt = `${baseSystemPrompt}

KNOWLEDGE BASE CONTENT:
The following knowledge files have been loaded for this profile. Use this information to answer user questions accurately:
${knowledgeSections.join('\n')}

IMPORTANT: When answering questions, prioritize information from the knowledge base files above. If the user asks about something that might be in these files, reference the specific file and information.`;

  return enhancedPrompt;
}

/**
 * Build system prompt with entity identifiers injected
 * 
 * Injects available entity identifiers into system prompt so agent knows what entities exist.
 * 
 * @param userId - User ID
 * @param profileId - Profile ID
 * @param baseSystemPrompt - Base system prompt
 * @returns Enhanced system prompt with entity identifiers
 */
/**
 * Build formatted entity information for agent context
 */
function formatEntityForPrompt(entity: {
  id: string;
  name: string;
  description: string | null;
  structure: any;
  data: any;
}): string {
  const structure = entity.structure as { layout: string; fields: Array<{ id: string; label: string; type: string }> };
  const data = entity.data as Record<string, unknown>;
  
  let formatted = `Entity: ${entity.name}\n`;
  formatted += `UUID: ${entity.id}\n`;
  
  if (entity.description) {
    formatted += `Description: ${entity.description}\n`;
  }
  
  formatted += `\nFields:\n`;
  structure.fields.forEach((field) => {
    const value = data[field.id];
    if (value !== null && value !== undefined) {
      let formattedValue = String(value);
      formatted += `- ${field.label} (${field.type}): ${formattedValue}\n`;
    }
  });
  
  return formatted;
}

export async function buildSystemPromptWithEntities(
  userId: string,
  profileId: string,
  baseSystemPrompt: string
): Promise<string> {
  // First, get current max updatedAt timestamp from database to check for changes
  const entitiesMeta = await db.entity.findMany({
    where: {
      userId,
      profileId,
      isActive: true,
    },
    select: {
      updatedAt: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 1,
  });

  const currentLastModified = entitiesMeta.length > 0
    ? entitiesMeta[0].updatedAt.getTime()
    : 0;

  // Try server-side cache first (fastest), with timestamp validation
  let cachedEntities = getCachedEntities(userId, profileId, currentLastModified);

  // Fetch full entity data from database (always fetch full data for prompt injection)
  const entities = await db.entity.findMany({
    where: {
      userId,
      profileId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
      structure: true,
      data: true,
      updatedAt: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  // Recalculate lastModified from full list
  const maxUpdatedAt = entities.length > 0
    ? Math.max(...entities.map(e => e.updatedAt.getTime()))
    : 0;

  // Update cache with minimal data (for tool lookups)
  if (entities.length > 0) {
    setCachedEntities(userId, profileId, entities.map(e => ({ id: e.id, name: e.name })), maxUpdatedAt);
  }

  if (entities.length === 0) {
    return baseSystemPrompt;
  }

  // Build entity information for agent
  const entityInfo = entities.map(e => formatEntityForPrompt(e)).join('\n\n');

  // Build entity list with UUIDs for tool calls
  const entityUuidList = entities.map(e => `- ${e.name} (UUID: ${e.id})`).join('\n');

  const enhancedPrompt = `${baseSystemPrompt}

AVAILABLE ENTITIES:
The following entities are configured for this profile. When the user mentions an entity by name, use the entity's UUID to call the tools.

${entityUuidList}

ENTITY INFORMATION:
${entityInfo}

ENTITY TOOLS (USE UUIDs, NOT NAMES):
- get_entity_info(entityUuid) - Retrieve detailed entity information by UUID (returns formatted text)
- visualize_entity(entityUuid) - Show entity in the UI and retrieve its information by UUID

CRITICAL: 
- ALWAYS use the UUID (not the name) when calling entity tools
- Find the entity UUID from the list above by matching the entity name
- Example: If user asks about "Netways", find "Netways" in the list above, get its UUID, then call get_entity_info("uuid-here")`;

  return enhancedPrompt;
}

