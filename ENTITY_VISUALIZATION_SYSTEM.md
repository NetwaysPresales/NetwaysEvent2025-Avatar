# Entity Visualization System Architecture

## Executive Summary

This document provides a **comprehensive architecture** for a **customizable entity visualization system** that allows users to define custom visualization structures, upload media content, and configure multiple entity instances. The system is fully partitioned per-user and per-preset, with entities stored in the database and media files in Azure Blob Storage.

**Key Requirements**:
- ✅ Custom visualization structure (sections, fields, layouts)
- ✅ Multiple entity instances per preset
- ✅ Media support (images, videos, text)
- ✅ Dynamic agent tool integration
- ✅ Per-user and per-preset partitioning
- ✅ UI for configuring both structure and content

---

## 1. Architecture Overview

### 1.1 System Flow

```
┌─────────────────┐
│  User Configures│
│  Entity Template│
│  (Structure)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  User Creates   │
│  Entity Instance│
│  (Content)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Media Uploaded │
│  to Blob Storage│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Entity Stored  │
│  in Database    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agent Calls    │
│  Entity Tool    │
│  (with ID)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tool Retrieves │
│  Entity Data    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  UI Displays    │
│  Visualization  │
└─────────────────┘
```

### 1.2 Key Components

1. **Entity Template**: Defines the visualization structure (sections, fields, layout)
2. **Entity Instance**: Contains the actual data for a specific entity
3. **Entity Tool**: LangChain tool that retrieves entity data by ID
4. **UI Components**: Configuration interface and visualization display

---

## 2. Database Schema

### 2.1 Entity Templates Table
**Purpose**: Stores the visualization structure definition per preset.

```sql
CREATE TABLE entity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- e.g., "Company Info", "Product Details"
  description TEXT,
  
  -- Visualization structure (JSON schema)
  structure JSONB NOT NULL, -- See structure schema below
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT entity_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT entity_templates_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT unique_template_name_per_profile UNIQUE (profile_id, name)
);

CREATE INDEX idx_entity_templates_user_profile ON entity_templates(user_id, profile_id);
CREATE INDEX idx_entity_templates_profile_id ON entity_templates(profile_id);
```

**Structure JSON Schema**:
```typescript
interface EntityTemplateStructure {
  layout: 'card' | 'sidebar' | 'modal' | 'fullscreen';
  sections: EntitySection[];
}

interface EntitySection {
  id: string;
  title: string;
  type: 'header' | 'text' | 'image' | 'video' | 'gallery' | 'metrics' | 'map' | 'custom';
  fields: EntityField[];
  order: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

interface EntityField {
  id: string;
  label: string;
  type: 'text' | 'rich_text' | 'number' | 'currency' | 'date' | 'image' | 'video' | 'url' | 'email' | 'phone' | 'boolean' | 'json';
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    format?: string;
  };
  display?: {
    format?: string; // e.g., "currency", "percentage", "date"
    prefix?: string;
    suffix?: string;
  };
  order: number;
}
```

**Example Structure**:
```json
{
  "layout": "sidebar",
  "sections": [
    {
      "id": "header",
      "title": "Company Overview",
      "type": "header",
      "fields": [
        {
          "id": "name",
          "label": "Company Name",
          "type": "text",
          "required": true,
          "order": 1
        },
        {
          "id": "logo",
          "label": "Logo",
          "type": "image",
          "order": 2
        }
      ],
      "order": 1
    },
    {
      "id": "metrics",
      "title": "Key Metrics",
      "type": "metrics",
      "fields": [
        {
          "id": "revenue",
          "label": "Annual Revenue",
          "type": "currency",
          "display": {
            "format": "currency",
            "prefix": "$"
          },
          "order": 1
        },
        {
          "id": "employees",
          "label": "Employees",
          "type": "number",
          "display": {
            "suffix": " people"
          },
          "order": 2
        }
      ],
      "order": 2,
      "collapsible": true
    },
    {
      "id": "media",
      "title": "Media Gallery",
      "type": "gallery",
      "fields": [
        {
          "id": "images",
          "label": "Images",
          "type": "image",
          "order": 1
        },
        {
          "id": "videos",
          "label": "Videos",
          "type": "video",
          "order": 2
        }
      ],
      "order": 3
    }
  ]
}
```

### 2.2 Entity Instances Table
**Purpose**: Stores the actual entity data instances.

```sql
CREATE TABLE entity_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES entity_templates(id) ON DELETE CASCADE,
  
  -- Entity identification
  name VARCHAR(255) NOT NULL, -- Display name
  identifier VARCHAR(255) NOT NULL, -- Unique identifier for agent lookup (e.g., "netways", "company-123")
  description TEXT,
  
  -- Entity data (JSON matching template structure)
  data JSONB NOT NULL,
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT entity_instances_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT entity_instances_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT entity_instances_template_id_fkey FOREIGN KEY (template_id) REFERENCES entity_templates(id) ON DELETE CASCADE,
  CONSTRAINT unique_identifier_per_profile UNIQUE (profile_id, identifier)
);

CREATE INDEX idx_entity_instances_user_profile ON entity_instances(user_id, profile_id);
CREATE INDEX idx_entity_instances_profile_id ON entity_instances(profile_id);
CREATE INDEX idx_entity_instances_template_id ON entity_instances(template_id);
CREATE INDEX idx_entity_instances_identifier ON entity_instances(profile_id, identifier) WHERE is_active = TRUE;
```

**Data JSON Schema** (matches template structure):
```json
{
  "header": {
    "name": "Netways",
    "logo": "https://blob-storage.../netways-logo.png"
  },
  "metrics": {
    "revenue": 50000000,
    "employees": 250
  },
  "media": {
    "images": [
      "https://blob-storage.../office-1.jpg",
      "https://blob-storage.../office-2.jpg"
    ],
    "videos": [
      "https://blob-storage.../company-video.mp4"
    ]
  }
}
```

### 2.3 Entity Media Files Table
**Purpose**: Tracks media files uploaded for entities (stored in Blob Storage).

```sql
CREATE TABLE entity_media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_instance_id UUID NOT NULL REFERENCES entity_instances(id) ON DELETE CASCADE,
  field_id VARCHAR(255) NOT NULL, -- References field.id in template
  blob_url VARCHAR(500) NOT NULL,
  blob_container VARCHAR(100) NOT NULL DEFAULT 'entity-media',
  blob_name VARCHAR(255) NOT NULL,
  
  -- Media metadata
  file_type VARCHAR(50) NOT NULL, -- 'image', 'video', 'document'
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT, -- bytes
  width INTEGER, -- for images/videos
  height INTEGER, -- for images/videos
  duration INTEGER, -- for videos (seconds)
  
  -- Display metadata
  alt_text TEXT,
  caption TEXT,
  order_index INTEGER DEFAULT 0,
  
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT entity_media_files_entity_instance_id_fkey FOREIGN KEY (entity_instance_id) REFERENCES entity_instances(id) ON DELETE CASCADE
);

CREATE INDEX idx_entity_media_files_entity_id ON entity_media_files(entity_instance_id);
CREATE INDEX idx_entity_media_files_field_id ON entity_media_files(entity_instance_id, field_id);
```

---

## 3. Entity Tool Implementation

### 3.1 LangChain Tool
**Purpose**: Agent calls this tool with entity identifier to retrieve visualization data.

```typescript
// agent/tools/entity-visualization.ts
import { tool } from '@langchain/core/tools';
import { db } from '@/lib/db';

export interface EntityVisualizationResult {
  entityId: string;
  entityName: string;
  templateId: string;
  visualizationData: Record<string, unknown>;
  agentContext: string; // Formatted text for agent to use in response
}

export function createEntityVisualizationTool(
  userId: string,
  profileId: string
) {
  return tool(
    async (input: string): Promise<string> => {
      try {
        // Parse input - can be entity ID or identifier
        const entityIdentifier = input.trim();

        // Query entity instance with user/profile filter (CRITICAL for security)
        const entityResult = await db.query(
          `SELECT 
            ei.id,
            ei.name,
            ei.identifier,
            ei.description,
            ei.data,
            ei.template_id,
            et.structure
          FROM entity_instances ei
          INNER JOIN entity_templates et ON ei.template_id = et.id
          WHERE ei.profile_id = $1 
            AND ei.user_id = $2
            AND ei.is_active = TRUE
            AND (ei.id::text = $3 OR ei.identifier = $3)`,
          [profileId, userId, entityIdentifier]
        );

        if (entityResult.rows.length === 0) {
          return JSON.stringify({
            found: false,
            error: `Entity "${entityIdentifier}" not found in this preset's knowledge base.`
          });
        }

        const entity = entityResult.rows[0];
        const structure = entity.structure as EntityTemplateStructure;
        const data = entity.data as Record<string, unknown>;

        // Build visualization data matching template structure
        const visualizationData: Record<string, unknown> = {
          entityId: entity.id,
          entityName: entity.name,
          templateId: entity.template_id,
          layout: structure.layout,
          sections: structure.sections.map(section => {
            const sectionData: Record<string, unknown> = {
              id: section.id,
              title: section.title,
              type: section.type,
              order: section.order,
              collapsible: section.collapsible,
              defaultCollapsed: section.defaultCollapsed,
              fields: section.fields.map(field => {
                const fieldValue = getNestedValue(data, section.id, field.id);
                
                // For media fields, fetch blob URLs
                if (field.type === 'image' || field.type === 'video') {
                  return {
                    id: field.id,
                    label: field.label,
                    type: field.type,
                    value: fieldValue,
                    mediaFiles: [] // Will be populated below
                  };
                }
                
                return {
                  id: field.id,
                  label: field.label,
                  type: field.type,
                  value: fieldValue,
                  display: field.display
                };
              })
            };
            return sectionData;
          })
        };

        // Fetch media files for this entity
        const mediaFiles = await db.query(
          `SELECT 
            field_id,
            blob_url,
            file_type,
            mime_type,
            alt_text,
            caption,
            order_index
          FROM entity_media_files
          WHERE entity_instance_id = $1
          ORDER BY field_id, order_index`,
          [entity.id]
        );

        // Attach media files to appropriate fields
        mediaFiles.rows.forEach(media => {
          const section = visualizationData.sections.find((s: any) => 
            s.fields.some((f: any) => f.id === media.field_id)
          );
          if (section) {
            const field = section.fields.find((f: any) => f.id === media.field_id);
            if (field && !field.mediaFiles) {
              field.mediaFiles = [];
            }
            if (field) {
              field.mediaFiles.push({
                url: media.blob_url,
                type: media.file_type,
                mimeType: media.mime_type,
                altText: media.alt_text,
                caption: media.caption
              });
            }
          }
        });

        // Build agent context (formatted text for LLM to use)
        const agentContext = buildAgentContext(entity, structure, data);

        // Return structured result
        const result: EntityVisualizationResult = {
          entityId: entity.id,
          entityName: entity.name,
          templateId: entity.template_id,
          visualizationData,
          agentContext
        };

        return JSON.stringify({
          found: true,
          ...result
        });

      } catch (error) {
        console.error('[Entity Tool] Error:', error);
        return JSON.stringify({
          found: false,
          error: `Error retrieving entity: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    },
    {
      name: 'show_entity',
      description: `Display entity information and visualization. 
        Input: entity identifier (ID or name) that the user mentioned.
        Returns: Entity data formatted for visualization and context for the agent to discuss.
        Use this tool when the user asks about a specific company, product, person, or other entity that has been configured in this preset.
        
        Available entities in this preset: [Will be dynamically injected]`
    }
  );
}

// Helper function to get nested values from data object
function getNestedValue(data: Record<string, unknown>, sectionId: string, fieldId: string): unknown {
  const sectionData = data[sectionId] as Record<string, unknown> | undefined;
  if (!sectionData) return null;
  return sectionData[fieldId] ?? null;
}

// Build formatted context for agent
function buildAgentContext(
  entity: any,
  structure: EntityTemplateStructure,
  data: Record<string, unknown>
): string {
  let context = `Entity: ${entity.name}\n`;
  if (entity.description) {
    context += `Description: ${entity.description}\n`;
  }
  context += `\nDetails:\n`;

  structure.sections.forEach(section => {
    const sectionData = data[section.id] as Record<string, unknown> | undefined;
    if (!sectionData) return;

    context += `\n${section.title}:\n`;
    section.fields.forEach(field => {
      const value = sectionData[field.id];
      if (value !== null && value !== undefined) {
        // Format value based on field type
        let formattedValue = String(value);
        if (field.type === 'currency' && field.display?.format === 'currency') {
          formattedValue = `$${Number(value).toLocaleString()}`;
        } else if (field.type === 'number' && field.display?.suffix) {
          formattedValue = `${value}${field.display.suffix}`;
        }
        context += `- ${field.label}: ${formattedValue}\n`;
      }
    });
  });

  return context;
}
```

### 3.2 Dynamic Entity List Injection
**Purpose**: Update tool description with available entities for better agent awareness.

```typescript
// agent/graph.ts - Update agent builder
export function buildAgent(config: {
  userId: string;
  profileId: string;
  // ... other config
}): AgentInterface {
  // ... existing code ...

  // Get available entities for this preset
  const availableEntities = await db.query(
    `SELECT identifier, name FROM entity_instances 
     WHERE profile_id = $1 AND user_id = $2 AND is_active = TRUE`,
    [config.profileId, config.userId]
  );

  // Create entity tool with dynamic description
  const entityTool = createEntityVisualizationTool(config.userId, config.profileId);
  
  // Update tool description with available entities
  if (availableEntities.rows.length > 0) {
    const entityList = availableEntities.rows
      .map(e => `- ${e.name} (ID: ${e.identifier})`)
      .join('\n');
    
    entityTool.description = `${entityTool.description}\n\nAvailable entities:\n${entityList}`;
  }

  const tools: StructuredToolInterface[] = [
    knowledgeTool,
    entityTool,
    // ... other tools
  ];

  // ... rest of agent building
}
```

---

## 4. API Routes

### 4.1 Entity Template Management

```typescript
// app/api/profiles/[id]/entities/templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/lib/db';

// GET: List templates for a profile
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: profileId } = await params;

  // Verify ownership
  const profile = await db.query(
    'SELECT * FROM profiles WHERE id = $1 AND user_id = $2',
    [profileId, session.userId]
  );

  if (profile.rows.length === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const templates = await db.query(
    'SELECT * FROM entity_templates WHERE profile_id = $1 AND user_id = $2 ORDER BY created_at DESC',
    [profileId, session.userId]
  );

  return NextResponse.json({ templates: templates.rows });
}

// POST: Create new template
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: profileId } = await params;
  const body = await req.json();

  // Verify ownership
  const profile = await db.query(
    'SELECT * FROM profiles WHERE id = $1 AND user_id = $2',
    [profileId, session.userId]
  );

  if (profile.rows.length === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Validate structure
  if (!body.structure || !body.name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const result = await db.query(
    `INSERT INTO entity_templates (user_id, profile_id, name, description, structure)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [session.userId, profileId, body.name, body.description || null, JSON.stringify(body.structure)]
  );

  return NextResponse.json({ template: result.rows[0] });
}
```

### 4.2 Entity Instance Management

```typescript
// app/api/profiles/[id]/entities/instances/route.ts

// GET: List instances
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ... authentication and ownership check ...

  const instances = await db.query(
    `SELECT ei.*, et.name as template_name
     FROM entity_instances ei
     INNER JOIN entity_templates et ON ei.template_id = et.id
     WHERE ei.profile_id = $1 AND ei.user_id = $2
     ORDER BY ei.created_at DESC`,
    [profileId, session.userId]
  );

  return NextResponse.json({ instances: instances.rows });
}

// POST: Create instance
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ... authentication ...

  const body = await req.json();

  // Verify template belongs to this profile
  const template = await db.query(
    'SELECT * FROM entity_templates WHERE id = $1 AND profile_id = $2 AND user_id = $3',
    [body.templateId, profileId, session.userId]
  );

  if (template.rows.length === 0) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const result = await db.query(
    `INSERT INTO entity_instances (user_id, profile_id, template_id, name, identifier, description, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      session.userId,
      profileId,
      body.templateId,
      body.name,
      body.identifier,
      body.description || null,
      JSON.stringify(body.data)
    ]
  );

  return NextResponse.json({ instance: result.rows[0] });
}
```

### 4.3 Media Upload

```typescript
// app/api/profiles/[id]/entities/[instanceId]/media/route.ts
import { uploadToBlobStorage } from '@/lib/blob-storage';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  // ... authentication ...

  const { id: profileId, instanceId } = await params;
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const fieldId = formData.get('fieldId') as string;

  if (!file || !fieldId) {
    return NextResponse.json({ error: 'Missing file or fieldId' }, { status: 400 });
  }

  // Verify entity instance ownership
  const instance = await db.query(
    'SELECT * FROM entity_instances WHERE id = $1 AND profile_id = $2 AND user_id = $3',
    [instanceId, profileId, session.userId]
  );

  if (instance.rows.length === 0) {
    return NextResponse.json({ error: 'Entity instance not found' }, { status: 404 });
  }

  // Upload to Blob Storage
  const blobUrl = await uploadToBlobStorage(file, {
    userId: session.userId,
    profileId: profileId,
    container: 'entity-media',
    path: `${instanceId}/${fieldId}`,
  });

  // Get file metadata
  const fileType = file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('video/') ? 'video' : 'document';

  // For images/videos, extract dimensions (would need image processing library)
  // For now, store basic metadata
  const result = await db.query(
    `INSERT INTO entity_media_files 
     (entity_instance_id, field_id, blob_url, blob_container, blob_name, file_type, mime_type, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      instanceId,
      fieldId,
      blobUrl,
      'entity-media',
      `${instanceId}/${fieldId}/${file.name}`,
      fileType,
      file.type,
      file.size
    ]
  );

  return NextResponse.json({ mediaFile: result.rows[0] });
}
```

---

## 5. UI Components

### 5.1 Entity Template Builder
**Purpose**: Visual interface for building entity template structures.

```typescript
// components/EntityTemplateBuilder/EntityTemplateBuilder.tsx
'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

export function EntityTemplateBuilder({
  template,
  onChange
}: {
  template: EntityTemplateStructure;
  onChange: (template: EntityTemplateStructure) => void;
}) {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const addSection = () => {
    const newSection: EntitySection = {
      id: `section-${Date.now()}`,
      title: 'New Section',
      type: 'text',
      fields: [],
      order: template.sections.length + 1
    };
    onChange({
      ...template,
      sections: [...template.sections, newSection]
    });
  };

  const addField = (sectionId: string) => {
    const section = template.sections.find(s => s.id === sectionId);
    if (!section) return;

    const newField: EntityField = {
      id: `field-${Date.now()}`,
      label: 'New Field',
      type: 'text',
      order: section.fields.length + 1
    };

    onChange({
      ...template,
      sections: template.sections.map(s =>
        s.id === sectionId
          ? { ...s, fields: [...s.fields, newField] }
          : s
      )
    });
  };

  return (
    <div className="entity-template-builder">
      {/* Layout selector */}
      <select
        value={template.layout}
        onChange={(e) => onChange({ ...template, layout: e.target.value as any })}
      >
        <option value="card">Card</option>
        <option value="sidebar">Sidebar</option>
        <option value="modal">Modal</option>
        <option value="fullscreen">Fullscreen</option>
      </select>

      {/* Sections */}
      <DragDropContext onDragEnd={(result) => {
        // Handle section reordering
      }}>
        <Droppable droppableId="sections">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {template.sections.map((section, index) => (
                <Draggable key={section.id} draggableId={section.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="section-editor"
                    >
                      <div {...provided.dragHandleProps}>
                        <h3>{section.title}</h3>
                        <select
                          value={section.type}
                          onChange={(e) => {
                            // Update section type
                          }}
                        >
                          <option value="header">Header</option>
                          <option value="text">Text</option>
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                          <option value="gallery">Gallery</option>
                          <option value="metrics">Metrics</option>
                          <option value="map">Map</option>
                        </select>
                      </div>

                      {/* Fields editor */}
                      {section.fields.map(field => (
                        <FieldEditor
                          key={field.id}
                          field={field}
                          onChange={(updatedField) => {
                            // Update field
                          }}
                        />
                      ))}

                      <button onClick={() => addField(section.id)}>
                        Add Field
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <button onClick={addSection}>Add Section</button>
    </div>
  );
}
```

### 5.2 Entity Instance Editor
**Purpose**: Interface for creating/editing entity instances with media upload.

```typescript
// components/EntityInstanceEditor/EntityInstanceEditor.tsx
'use client';

export function EntityInstanceEditor({
  instance,
  template,
  onChange,
  onSave
}: {
  instance: EntityInstance;
  template: EntityTemplateStructure;
  onChange: (instance: EntityInstance) => void;
  onSave: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const handleFileUpload = async (fieldId: string, file: File) => {
    setUploading({ ...uploading, [fieldId]: true });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fieldId', fieldId);

      const res = await fetch(`/api/profiles/${profileId}/entities/${instance.id}/media`, {
        method: 'POST',
        body: formData
      });

      const { mediaFile } = await res.json();
      // Update instance data with media URL
      // ...
    } finally {
      setUploading({ ...uploading, [fieldId]: false });
    }
  };

  return (
    <div className="entity-instance-editor">
      <input
        value={instance.name}
        onChange={(e) => onChange({ ...instance, name: e.target.value })}
        placeholder="Entity Name"
      />
      <input
        value={instance.identifier}
        onChange={(e) => onChange({ ...instance, identifier: e.target.value })}
        placeholder="Identifier (for agent lookup)"
      />

      {template.sections.map(section => (
        <div key={section.id} className="section">
          <h3>{section.title}</h3>
          {section.fields.map(field => (
            <FieldInput
              key={field.id}
              field={field}
              value={instance.data[section.id]?.[field.id]}
              onChange={(value) => {
                // Update instance data
              }}
              onFileUpload={(file) => handleFileUpload(field.id, file)}
            />
          ))}
        </div>
      ))}

      <button onClick={onSave}>Save Entity</button>
    </div>
  );
}
```

### 5.3 Entity Visualization Display
**Purpose**: Renders entity visualization based on template structure.

```typescript
// components/EntityVisualization/EntityVisualization.tsx
'use client';

export function EntityVisualization({
  visualizationData
}: {
  visualizationData: EntityVisualizationResult['visualizationData'];
}) {
  return (
    <div className={`entity-visualization entity-visualization--${visualizationData.layout}`}>
      {visualizationData.sections.map(section => (
        <EntitySection
          key={section.id}
          section={section}
        />
      ))}
    </div>
  );
}

function EntitySection({ section }: { section: any }) {
  return (
    <div className={`entity-section entity-section--${section.type}`}>
      <h3>{section.title}</h3>
      {section.fields.map((field: any) => (
        <EntityField key={field.id} field={field} />
      ))}
    </div>
  );
}

function EntityField({ field }: { field: any }) {
  if (field.type === 'image' && field.mediaFiles) {
    return (
      <div className="entity-field entity-field--image">
        {field.mediaFiles.map((media: any, index: number) => (
          <img
            key={index}
            src={media.url}
            alt={media.altText || field.label}
          />
        ))}
      </div>
    );
  }

  if (field.type === 'video' && field.mediaFiles) {
    return (
      <div className="entity-field entity-field--video">
        {field.mediaFiles.map((media: any, index: number) => (
          <video key={index} src={media.url} controls />
        ))}
      </div>
    );
  }

  // Render other field types
  return (
    <div className="entity-field">
      <label>{field.label}</label>
      <div>{formatFieldValue(field.value, field.type, field.display)}</div>
    </div>
  );
}
```

---

## 6. Integration with Agent

### 6.1 Agent Response Handling
**Purpose**: Parse agent tool response and trigger UI visualization.

```typescript
// hooks/useAgent.ts - Update to handle entity visualization
export function useAgent({ openAIConfig }: UseAgentProps) {
  const [currentEntity, setCurrentEntity] = useState<EntityVisualizationResult | null>(null);

  const sendMessage = async (message: string): Promise<string | null> => {
    // ... existing code ...

    const data = await res.json();
    const reply = String(data?.reply || '').trim();

    // Check if agent called show_entity tool
    if (data?.entityVisualization) {
      setCurrentEntity(data.entityVisualization);
    } else {
      setCurrentEntity(null);
    }

    return reply;
  };

  return {
    sendMessage,
    currentEntity,
    // ... other returns
  };
}
```

### 6.2 API Route Update
**Purpose**: Extract entity visualization from agent tool calls.

```typescript
// app/api/agent/route.ts - Update to extract entity visualization
export async function POST(req: NextRequest) {
  // ... existing code ...

  const result = await agent.invoke({ messages });

  // Check for entity visualization tool call
  let entityVisualization: EntityVisualizationResult | null = null;
  for (const msg of result.messages) {
    if (msg instanceof ToolMessage && msg.name === 'show_entity') {
      try {
        const parsed = JSON.parse(msg.content);
        if (parsed.found && parsed.entityId) {
          entityVisualization = {
            entityId: parsed.entityId,
            entityName: parsed.entityName,
            templateId: parsed.templateId,
            visualizationData: parsed.visualizationData,
            agentContext: parsed.agentContext
          };
        }
      } catch (e) {
        console.error('Failed to parse entity visualization:', e);
      }
    }
  }

  return new Response(
    JSON.stringify({
      reply: result.messages[result.messages.length - 1]?.content ?? '',
      entityVisualization
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
```

---

## 7. Security Considerations

### 7.1 Partition Isolation
**CRITICAL**: All queries must filter by `user_id` and `profile_id`.

```typescript
// ALWAYS include these filters
const filter = `user_id = $1 AND profile_id = $2`;
```

### 7.2 Media Access Control
- Generate SAS tokens with expiration for media files
- Verify entity ownership before serving media
- Use private blob containers with access control

---

## 8. Migration Plan

**Note**: This is integrated into the main migration plan in `ARCHITECTURE_MIGRATION_PLAN.md` as Phase 4.6 (Week 5-6). The phases below are the detailed breakdown of that phase.

### Phase 1: Database Setup (Week 5, Days 1-2)
1. Create entity_templates table
2. Create entity_instances table
3. Create entity_media_files table
4. Set up indexes

### Phase 2: Backend Implementation (Week 5, Days 3-5)
1. Implement entity tool
2. Create API routes for templates
3. Create API routes for instances
4. Implement media upload

### Phase 3: UI Implementation (Week 6, Days 1-3)
1. Build template builder component
2. Build instance editor component
3. Build visualization display component
4. Integrate with settings panel

### Phase 4: Agent Integration (Week 6, Days 4-5)
1. Update agent builder
2. Update agent response handling
3. Test end-to-end flow

---

## Summary

This architecture provides:
- ✅ **Customizable visualization structures** via templates
- ✅ **Multiple entity instances** per preset
- ✅ **Media support** (images, videos, text)
- ✅ **Dynamic agent integration** via tool calls
- ✅ **Per-user and per-preset partitioning** for security
- ✅ **Complete UI** for configuration and display

**Next Steps**: Review architecture, then begin Phase 1 implementation.

