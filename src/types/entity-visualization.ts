/**
 * Entity Visualization Types
 * 
 * Type definitions for entity visualization data structures
 */

/**
 * Entity field types supported for visualization
 */
export type EntityFieldType =
  | 'text'
  | 'rich_text'
  | 'number'
  | 'currency'
  | 'date'
  | 'image'
  | 'video'
  | 'url'
  | 'email'
  | 'phone'
  | 'boolean'
  | 'json';

/**
 * Entity layout options
 */
export type EntityLayout = 'card' | 'sidebar' | 'modal' | 'fullscreen';

/**
 * Entity field definition
 */
export interface EntityField {
  id: string;
  label: string;
  type: EntityFieldType;
  order: number;
  required?: boolean;
  display?: {
    format?: string;
    prefix?: string;
    suffix?: string;
  };
}

/**
 * Entity structure (from database)
 */
export interface EntityStructure {
  layout: EntityLayout;
  fields: EntityField[];
}

/**
 * Media file associated with an entity field
 */
export interface EntityMediaFile {
  id: string;
  url: string;
  type: 'image' | 'video' | 'document';
  mimeType: string;
  altText: string | null;
  caption: string | null;
  orderIndex: number;
}

/**
 * Field value with metadata for visualization
 */
export interface EntityFieldValue {
  id: string;
  label: string;
  type: EntityFieldType;
  value: unknown;
  display?: Record<string, unknown>;
  mediaFiles?: EntityMediaFile[];
}

/**
 * Complete entity visualization data
 */
export interface EntityVisualizationData {
  entityId: string;
  entityName: string;
  layout: EntityLayout;
  fields: EntityFieldValue[];
}

/**
 * Entity visualization result (returned by tool)
 */
export interface EntityVisualizationResult {
  entityId: string;
  entityName: string;
  visualizationData: EntityVisualizationData;
  agentContext: string;
}

/**
 * Entity visualization result with visualization flag (from API)
 */
export interface EntityVisualizationResponse extends EntityVisualizationResult {
  visualize: boolean;
}

