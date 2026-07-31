import { getCachedEntities, setCachedEntities } from './server-cache';
import { db } from './db';

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
  structure: { layout: string; fields: Array<{ id: string; label: string; type: string }> };
  data: Record<string, unknown>;
}): string {
  const structure = entity.structure;
  const data = entity.data;
  
  let formatted = `Entity: ${entity.name}\n`;
  formatted += `UUID: ${entity.id}\n`;
  
  if (entity.description) {
    formatted += `Description: ${entity.description}\n`;
  }
  
  formatted += `\nFields:\n`;
  structure.fields.forEach((field) => {
    const value = data[field.id];
    if (value !== null && value !== undefined) {
      const formattedValue = String(value);
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
  getCachedEntities(userId, profileId, currentLastModified);

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
  const entityInfo = entities.map(e => formatEntityForPrompt({
    id: e.id,
    name: e.name,
    description: e.description,
    structure: e.structure as { layout: string; fields: Array<{ id: string; label: string; type: string }> },
    data: e.data as Record<string, unknown>,
  })).join('\n\n');

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

