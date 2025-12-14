/**
 * Entity Tools
 * 
 * LangChain tools for retrieving and visualizing entity data by UUID.
 * Used by the agent to access entity information and trigger UI visualization.
 */

import { tool } from '@langchain/core/tools';
import { db } from '@/lib/db';
import type {
  EntityVisualizationResult,
  EntityVisualizationData,
  EntityStructure,
  EntityFieldValue,
  EntityMediaFile,
} from '@/types/entity-visualization';

/**
 * Parse UUID from tool input
 */
function parseEntityUuid(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      return parsed;
    }
    if (typeof parsed === 'object' && parsed !== null && parsed.uuid) {
      return String(parsed.uuid).trim();
    }
  } catch {
    // Not JSON, treat as plain UUID
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Build field values with media files attached
 */
function buildFieldValues(
  structure: EntityStructure,
  data: Record<string, unknown>,
  mediaFiles: Array<{
    id: string;
    fieldId: string;
    blobUrl: string;
    fileType: string;
    mimeType: string;
    altText: string | null;
    caption: string | null;
    orderIndex: number;
  }>
): EntityFieldValue[] {
  return structure.fields.map((field) => {
    const fieldValue = data[field.id] ?? null;
    
    // For media fields, attach media files
    if (field.type === 'image' || field.type === 'video' || field.type === 'gallery') {
      const fieldMediaFiles: EntityMediaFile[] = mediaFiles
        .filter((mf) => mf.fieldId === field.id)
        .map((mf) => ({
          id: mf.id,
          url: mf.blobUrl,
          type: mf.fileType as 'image' | 'video' | 'document',
          mimeType: mf.mimeType,
          altText: mf.altText,
          caption: mf.caption,
          orderIndex: mf.orderIndex,
        }));
      
      return {
        id: field.id,
        label: field.label,
        type: field.type,
        value: fieldValue,
        display: field.display,
        mediaFiles: fieldMediaFiles.length > 0 ? fieldMediaFiles : undefined,
      };
    }
    
    return {
      id: field.id,
      label: field.label,
      type: field.type,
      value: fieldValue,
      display: field.display,
    };
  });
}

/**
 * Build formatted context for agent
 */
function buildAgentContext(
  entity: { name: string; description: string | null },
  structure: EntityStructure,
  data: Record<string, unknown>
): string {
  let context = `Entity: ${entity.name}\n`;
  if (entity.description) {
    context += `Description: ${entity.description}\n`;
  }
  context += `\nDetails:\n`;

  structure.fields.forEach((field) => {
    const value = data[field.id];
    if (value !== null && value !== undefined) {
      // Format value based on field type
      let formattedValue = String(value);
      if (field.type === 'currency' && field.display && typeof field.display === 'object' && 'format' in field.display && field.display.format === 'currency') {
        formattedValue = `$${Number(value).toLocaleString()}`;
      } else if (field.type === 'number' && field.display && typeof field.display === 'object' && 'suffix' in field.display) {
        formattedValue = `${value}${field.display.suffix}`;
      }
      context += `- ${field.label}: ${formattedValue}\n`;
    }
  });

  return context;
}

/**
 * Get entity info retrieval tool (no visualization)
 */
export function getEntityInfoTool(
  userId: string,
  profileId: string
) {
  return tool(
    async (input: string): Promise<string> => {
      try {
        // Validate user/profile context
        if (!userId || !profileId) {
          return JSON.stringify({
            found: false,
            error: 'Invalid user or profile context',
          });
        }

        // Parse UUID
        const entityUuid = parseEntityUuid(input);
        if (!entityUuid) {
          return JSON.stringify({
            found: false,
            error: 'Invalid entity UUID format. Expected a UUID string.',
          });
        }

        // Query entity with user/profile filter (CRITICAL for security)
        const entity = await db.entity.findFirst({
          where: {
            id: entityUuid,
            profileId,
            userId,
            isActive: true,
          },
          include: {
            mediaFiles: {
              orderBy: [
                { fieldId: 'asc' },
                { orderIndex: 'asc' },
              ],
              select: {
                id: true,
                fieldId: true,
                blobUrl: true,
                fileType: true,
                mimeType: true,
                altText: true,
                caption: true,
                orderIndex: true,
              },
            },
          },
        });

        if (!entity) {
          return JSON.stringify({
            found: false,
            error: `Entity with UUID "${entityUuid}" not found in this profile's entity list.`,
          });
        }

        // Validate structure
        const structure = entity.structure as EntityStructure;
        if (!structure || !structure.layout || !Array.isArray(structure.fields)) {
          return JSON.stringify({
            found: false,
            error: `Entity "${entity.name}" has invalid structure.`,
          });
        }

        const data = entity.data as Record<string, unknown>;
        if (!data || typeof data !== 'object') {
          return JSON.stringify({
            found: false,
            error: `Entity "${entity.name}" has invalid data.`,
          });
        }

        // Build agent context (formatted text for LLM to use)
        let agentContext: string;
        try {
          agentContext = buildAgentContext(entity, structure, data);
        } catch (error) {
          console.error('[Entity Info Tool] Error building agent context:', error);
          agentContext = `Entity: ${entity.name}\nDescription: ${entity.description || 'No description available'}`;
        }

        // Return formatted text for agent (no visualization)
        return agentContext;
      } catch (error) {
        console.error('[Entity Info Tool] Error:', error);
        return `Error retrieving entity: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
    {
      name: 'get_entity_info',
      description: `Retrieve detailed entity information by UUID.
        
        Input: Entity UUID (string)
        Examples:
        - get_entity_info("123e4567-e89b-12d3-a456-426614174000")
        - get_entity_info('{"uuid": "123e4567-e89b-12d3-a456-426614174000"}')
        
        Returns: Formatted text with entity name, description, and all field values.
        
        Use this tool when the user asks about a specific entity. The entity UUID is provided in the system prompt.`,
    }
  );
}

/**
 * Get entity visualization tool (triggers UI visualization)
 */
export function getEntityVisualizationTool(
  userId: string,
  profileId: string
) {
  return tool(
    async (input: string): Promise<string> => {
      try {
        // Validate user/profile context
        if (!userId || !profileId) {
          return JSON.stringify({
            found: false,
            error: 'Invalid user or profile context',
          });
        }

        // Parse UUID
        const entityUuid = parseEntityUuid(input);
        if (!entityUuid) {
          return JSON.stringify({
            found: false,
            error: 'Invalid entity UUID format. Expected a UUID string.',
          });
        }

        // Query entity with user/profile filter (CRITICAL for security)
        const entity = await db.entity.findFirst({
          where: {
            id: entityUuid,
            profileId,
            userId,
            isActive: true,
          },
          include: {
            mediaFiles: {
              orderBy: [
                { fieldId: 'asc' },
                { orderIndex: 'asc' },
              ],
              select: {
                id: true,
                fieldId: true,
                blobUrl: true,
                fileType: true,
                mimeType: true,
                altText: true,
                caption: true,
                orderIndex: true,
              },
            },
          },
        });

        if (!entity) {
          return JSON.stringify({
            found: false,
            error: `Entity with UUID "${entityUuid}" not found in this profile's entity list.`,
          });
        }

        // Validate structure
        const structure = entity.structure as EntityStructure;
        if (!structure || !structure.layout || !Array.isArray(structure.fields)) {
          return JSON.stringify({
            found: false,
            error: `Entity "${entity.name}" has invalid structure.`,
          });
        }

        const data = entity.data as Record<string, unknown>;
        if (!data || typeof data !== 'object') {
          return JSON.stringify({
            found: false,
            error: `Entity "${entity.name}" has invalid data.`,
          });
        }

        // Build field values with error handling
        let fieldValues: EntityFieldValue[];
        try {
          fieldValues = buildFieldValues(structure, data, entity.mediaFiles);
        } catch (error) {
          console.error('[Entity Visualization Tool] Error building field values:', error);
          return JSON.stringify({
            found: false,
            error: `Error processing entity fields: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }

        // Build visualization data with flat fields structure
        const visualizationData: EntityVisualizationData = {
          entityId: entity.id,
          entityName: entity.name,
          layout: structure.layout,
          fields: fieldValues,
        };

        // Build agent context (formatted text for LLM to use)
        let agentContext: string;
        try {
          agentContext = buildAgentContext(entity, structure, data);
        } catch (error) {
          console.error('[Entity Visualization Tool] Error building agent context:', error);
          agentContext = `Entity: ${entity.name}\nDescription: ${entity.description || 'No description available'}`;
        }

        // Return structured result (always visualizes - that's what this tool does!)
        const result: EntityVisualizationResult = {
          entityId: entity.id,
          entityName: entity.name,
          visualizationData,
          agentContext,
        };

        return JSON.stringify({
          found: true,
          ...result,
        });
      } catch (error) {
        console.error('[Entity Visualization Tool] Error:', error);
        return JSON.stringify({
          found: false,
          error: `Error retrieving entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    },
    {
      name: 'visualize_entity',
      description: `Retrieve entity information and trigger UI visualization.
        
        Input: Entity UUID (string)
        Examples:
        - visualize_entity("123e4567-e89b-12d3-a456-426614174000")
        - visualize_entity('{"uuid": "123e4567-e89b-12d3-a456-426614174000"}')
        
        Returns: JSON object with entity data formatted for visualization and context for the agent to discuss.
        The entity will be displayed in the UI after a short delay.
        
        Use this tool when the user wants to see an entity visually in the UI. The entity UUID is provided in the system prompt.`,
    }
  );
}
