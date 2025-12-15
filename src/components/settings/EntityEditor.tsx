/**
 * Entity Editor Component
 * 
 * Single component for creating/editing entities (structure + data)
 */

'use client';

import React, { useState, useCallback, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { DragDropUpload } from '@/components/AssetUpload/DragDropUpload';

interface EntityEditorProps {
  profileId: string;
  entity?: {
    id: string;
    name: string;
    description: string | null;
    structure: EntityStructure;
    data: Record<string, unknown>;
    mediaFiles?: Array<{
      id: string;
      fieldId: string;
      blobUrl: string;
      fileType: string;
      altText: string | null;
      caption: string | null;
    }>;
  } | null;
  onSave: (entity: {
    name: string;
    description: string;
    structure: EntityStructure;
    data: Record<string, unknown>;
  }) => Promise<void>;
  onCancel: () => void;
  onValidationChange?: (isValid: boolean, isSaving: boolean) => void;
}

export interface EntityEditorRef {
  save: () => Promise<void>;
  isValid: () => boolean;
  isSaving: () => boolean;
}

interface EntityStructure {
  layout: 'card' | 'sidebar' | 'modal' | 'fullscreen';
  fields: EntityField[];
}

interface EntityField {
  id: string;
  label: string;
  type: 'text' | 'rich_text' | 'number' | 'currency' | 'date' | 'image' | 'video' | 'url' | 'email' | 'phone' | 'boolean' | 'json';
  order: number;
  required?: boolean;
  display?: {
    format?: string;
    prefix?: string;
    suffix?: string;
  };
}

const FIELD_TYPES: Array<{ value: string; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'rich_text', label: 'Rich Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'json', label: 'JSON' },
];

const LAYOUT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'card', label: 'Card' },
  { value: 'sidebar', label: 'Sidebar' },
  { value: 'modal', label: 'Modal' },
  { value: 'fullscreen', label: 'Fullscreen' },
];

/**
 * Component for previewing entity media with authenticated URLs
 */
const EntityMediaPreview: React.FC<{
  blobUrl: string;
  fileType: string;
  altText: string | null;
  caption: string | null;
  theme: 'light' | 'dark';
}> = ({ blobUrl, fileType, altText, caption, theme }) => {
  const authenticatedUrl = useMediaUrl(blobUrl);

  return (
    <div
      className={`p-2 rounded border theme-transition ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/50 border-zinc-700'}`}
    >
      {authenticatedUrl ? (
        <>
          {fileType === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={authenticatedUrl}
              alt={altText || ''}
              className="w-full h-32 object-cover rounded"
              onError={(e) => {
                console.error('[EntityEditor] Failed to load image:', authenticatedUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <video
              src={authenticatedUrl}
              className="w-full h-32 object-cover rounded"
              controls
              onError={(e) => {
                console.error('[EntityEditor] Failed to load video:', authenticatedUrl);
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </>
      ) : (
        <div className={`w-full h-32 flex items-center justify-center text-xs ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>
          Loading...
        </div>
      )}
      {caption && (
        <p className={`text-xs mt-1 theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
          {caption}
        </p>
      )}
    </div>
  );
};

export const EntityEditor = forwardRef<EntityEditorRef, EntityEditorProps>(({
  profileId,
  entity,
  onSave,
  onValidationChange,
}, ref) => {
  const theme = useTheme();
  const [name, setName] = useState(entity?.name || '');
  const [description, setDescription] = useState(entity?.description || '');
  const [layout, setLayout] = useState<EntityStructure['layout']>(entity?.structure.layout || 'sidebar');
  const [fields, setFields] = useState<EntityField[]>(entity?.structure.fields || []);
  const [data, setData] = useState<Record<string, unknown>>(entity?.data || {});
  const [mediaFiles, setMediaFiles] = useState<Record<string, Array<{ id: string; blobUrl: string; fileType: string; altText: string | null; caption: string | null }>>>(() => {
    const mediaMap: Record<string, Array<{ id: string; blobUrl: string; fileType: string; altText: string | null; caption: string | null }>> = {};
    entity?.mediaFiles?.forEach((mf) => {
      if (!mediaMap[mf.fieldId]) {
        mediaMap[mf.fieldId] = [];
      }
      mediaMap[mf.fieldId].push({
        id: mf.id,
        blobUrl: mf.blobUrl,
        fileType: mf.fileType,
        altText: mf.altText,
        caption: mf.caption,
      });
    });
    return mediaMap;
  });
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addField = useCallback(() => {
    const newField: EntityField = {
      id: generateId(),
      label: '',
      type: 'text',
      order: fields.length + 1,
      required: false,
    };
    setFields([...fields, newField]);
  }, [fields]);

  const updateField = useCallback((fieldId: string, updates: Partial<EntityField>) => {
    setFields(fields.map(f => 
      f.id === fieldId ? { ...f, ...updates } : f
    ));
  }, [fields]);

  const deleteField = useCallback((fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId).map((f, idx) => ({
      ...f,
      order: idx + 1,
    })));
    // Remove data for deleted field
    const newData = { ...data };
    delete newData[fieldId];
    setData(newData);
  }, [fields, data]);

  const moveField = useCallback((fieldId: string, direction: 'up' | 'down') => {
    const index = fields.findIndex(f => f.id === fieldId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;

    const newFields = [...fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    newFields.forEach((f, idx) => {
      f.order = idx + 1;
    });
    setFields(newFields);
  }, [fields]);

  const updateFieldValue = useCallback((fieldId: string, value: unknown) => {
    setData(prev => ({
      ...prev,
      [fieldId]: value,
    }));
  }, []);

  // Simple JSON import for entity definition (structure + data)
  const handleImportJson = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file later
    event.target.value = '';

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Optional: name and description
      if (typeof parsed.name === 'string') {
        setName(parsed.name);
      }
      if (typeof parsed.description === 'string') {
        setDescription(parsed.description);
      }

      // Optional: layout
      const importedLayout = parsed.structure?.layout;
      if (importedLayout && ['card', 'sidebar', 'modal', 'fullscreen'].includes(importedLayout)) {
        setLayout(importedLayout as EntityStructure['layout']);
      }

      // Fields
      type ImportedField = {
        id?: unknown;
        label?: unknown;
        type?: unknown;
        order?: unknown;
        required?: unknown;
        display?: unknown;
      };

      const importedFields: ImportedField[] = Array.isArray(parsed.structure?.fields)
        ? (parsed.structure.fields as ImportedField[])
        : [];
      if (importedFields.length > 0) {
        const normalizeType = (t: unknown): EntityField['type'] => {
          if (typeof t !== 'string') return 'text';
          switch (t) {
            case 'text':
            case 'rich_text':
            case 'number':
            case 'currency':
            case 'date':
            case 'image':
            case 'video':
            case 'url':
            case 'email':
            case 'phone':
            case 'boolean':
            case 'json':
              return t;
            // Friendly aliases from demo JSON
            case 'textarea':
              return 'rich_text';
            case 'checkbox':
              return 'boolean';
            default:
              return 'text';
          }
        };

        const newFields: EntityField[] = importedFields.map((f, idx) => ({
          id: typeof f.id === 'string' ? f.id : generateId(),
          label: typeof f.label === 'string' ? f.label : '',
          type: normalizeType(f.type),
          order: typeof f.order === 'number' ? f.order : idx + 1,
          required: Boolean(f.required),
          display: f.display && typeof f.display === 'object' ? f.display : undefined,
        }));

        setFields(newFields);
      }

      // Data (optional)
      if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
        setData(parsed.data as Record<string, unknown>);
      }
    } catch (error) {
      console.error('[EntityEditor] Failed to import entity JSON:', error);
      alert('Failed to import JSON. Please make sure the file is valid entity JSON.');
    }
  }, []);

  const loadMediaFiles = useCallback(async (entityId: string) => {
    try {
      const res = await fetch(`/api/profiles/${profileId}/entities/${entityId}`);
      if (res.ok) {
        const entityData = await res.json();
        const mediaMap: Record<string, Array<{ id: string; blobUrl: string; fileType: string; altText: string | null; caption: string | null }>> = {};
        entityData.entity.mediaFiles?.forEach((mf: { id: string; fieldId: string; blobUrl: string; fileType: string; altText: string | null; caption: string | null }) => {
          if (!mediaMap[mf.fieldId]) {
            mediaMap[mf.fieldId] = [];
          }
          mediaMap[mf.fieldId].push({
            id: mf.id,
            blobUrl: mf.blobUrl,
            fileType: mf.fileType,
            altText: mf.altText,
            caption: mf.caption,
          });
        });
        setMediaFiles(mediaMap);
      }
    } catch (error) {
      console.error('Failed to load media files:', error);
    }
  }, [profileId]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      alert('Name is required');
      return;
    }

    if (fields.length === 0) {
      alert('At least one field is required');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || '',
        structure: {
          layout,
          fields,
        },
        data,
      });
    } catch (error) {
      console.error('Failed to save entity:', error);
      alert('Failed to save entity');
    } finally {
      setIsSaving(false);
    }
  }, [name, description, layout, fields, data, onSave]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
    isValid: () => name.trim().length > 0 && fields.length > 0,
    isSaving: () => isSaving,
  }), [handleSave, name, fields.length, isSaving]);

  // Notify parent of validation state changes
  useEffect(() => {
    if (onValidationChange) {
      const isValid = name.trim().length > 0 && fields.length > 0;
      onValidationChange(isValid, isSaving);
    }
  }, [name, fields.length, isSaving, onValidationChange]);

  return (
    <>
      <div className="space-y-6">
        {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label className={`block text-sm font-medium mb-2 theme-transition ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>
            Entity Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Netways"
          />
        </div>
        <div>
          <label className={`block text-sm font-medium mb-2 theme-transition ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
          />
        </div>
        <div>
          <label className={`block text-sm font-medium mb-2 theme-transition ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>
            Layout
          </label>
          <Select
            value={layout}
            onChange={(e) => setLayout(e.target.value as EntityStructure['layout'])}
            options={LAYOUT_OPTIONS}
          />
        </div>
      </div>

      {/* Fields Definition */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-lg font-semibold theme-transition ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
              Fields
            </h3>
            <p className={`text-sm mt-1 theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
              Define the fields for this entity. Each field needs a name and type.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </Button>
            <Button
              variant="secondary"
              onClick={addField}
            >
              + Add Field
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportJson}
            />
          </div>
        </div>

        {fields.length === 0 ? (
          <div className={`p-8 rounded-lg border-2 border-dashed text-center theme-transition ${theme === 'light' ? 'bg-zinc-50 border-zinc-300' : 'bg-zinc-800/50 border-zinc-700'}`}>
            <p className={`text-sm theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
              No fields yet. Click &quot;Add Field&quot; to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field, fieldIdx) => (
              <div
                key={field.id}
                className={`rounded-lg border overflow-hidden theme-transition ${theme === 'light' ? 'bg-white border-[var(--accent-primary)]' : 'bg-zinc-800/50 border-[var(--accent-primary)]'}`}
              >
                {/* Field Definition Section - Distinct background with gradient */}
                <div className={`p-4 theme-transition ${theme === 'light' ? 'bg-gradient-to-br from-zinc-50 via-zinc-50 to-zinc-100/50' : 'bg-gradient-to-br from-zinc-900/70 via-zinc-800/60 to-zinc-900/50'}`}>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-wider mb-2 theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        Field Name
                      </label>
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                        placeholder="e.g., Company Name"
                        className="text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-wider mb-2 theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        Field Type
                      </label>
                      <Select
                        value={field.type}
                        onChange={(e) => updateField(field.id, { type: e.target.value as EntityField['type'] })}
                        options={FIELD_TYPES}
                        className="text-sm font-medium"
                      />
                    </div>
                  </div>
                  
                  {/* Centered Controls - More prominent with separators */}
                  <div className="flex items-center justify-center gap-6 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={field.required || false}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        className="rounded w-4 h-4 cursor-pointer"
                      />
                      <span className={`text-xs font-semibold theme-transition ${theme === 'light' ? 'text-zinc-700 group-hover:text-zinc-900' : 'text-zinc-300 group-hover:text-zinc-100'}`}>
                        Required
                      </span>
                    </label>
                    <div className={`h-4 w-px theme-transition ${theme === 'light' ? 'bg-zinc-300' : 'bg-zinc-600'}`} />
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => moveField(field.id, 'up')}
                        disabled={fieldIdx === 0}
                        className={`p-1.5 rounded transition-all ${fieldIdx === 0 ? 'opacity-30 cursor-not-allowed' : ''} ${theme === 'light' ? 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'}`}
                        title="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveField(field.id, 'down')}
                        disabled={fieldIdx === fields.length - 1}
                        className={`p-1.5 rounded transition-all ${fieldIdx === fields.length - 1 ? 'opacity-30 cursor-not-allowed' : ''} ${theme === 'light' ? 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'}`}
                        title="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <div className={`h-4 w-px theme-transition ${theme === 'light' ? 'bg-zinc-300' : 'bg-zinc-600'}`} />
                    <button
                      onClick={() => deleteField(field.id)}
                      className={`p-1.5 rounded transition-all ${theme === 'light' ? 'text-red-500 hover:text-red-700 hover:bg-red-100' : 'text-red-400 hover:text-red-300 hover:bg-red-900/30'}`}
                      title="Delete field"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Display Options (for currency/number) */}
                  {(field.type === 'currency' || field.type === 'number') && (
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t-2">
                      <Input
                        value={field.display?.prefix || ''}
                        onChange={(e) => updateField(field.id, {
                          display: { ...field.display, prefix: e.target.value },
                        })}
                        placeholder="Prefix (e.g., $)"
                        className="text-sm"
                      />
                      <Input
                        value={field.display?.suffix || ''}
                        onChange={(e) => updateField(field.id, {
                          display: { ...field.display, suffix: e.target.value },
                        })}
                        placeholder="Suffix (e.g., USD)"
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Data Input Section - Clean white/dark background to distinguish from definition */}
                <div className={`p-4 space-y-2 theme-transition ${theme === 'light' ? 'bg-white' : 'bg-zinc-800/50'}`}>
                  <label className={`block text-sm font-semibold theme-transition ${theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'}`}>
                    Value
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  
                  {field.type === 'image' || field.type === 'video' ? (
                    <div className="space-y-3">
                      {entity?.id ? (
                        <DragDropUpload
                          endpoint={`/api/profiles/${profileId}/entities/${entity.id}/media`}
                          accept={field.type === 'image' ? '.jpg,.jpeg,.png,.gif,.webp' : '.mp4,.webm,.mov'}
                          formDataFields={{ fieldId: field.id }}
                          useBlobUrl={true}
                          onUploadComplete={async (blobUrl) => {
                            if (blobUrl && entity?.id) {
                              await loadMediaFiles(entity.id);
                            }
                          }}
                        />
                      ) : (
                        <div className={`p-4 rounded-lg border text-center theme-transition ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-800/50 border-zinc-700'}`}>
                          <p className={`text-sm theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                            Save the entity first to upload media files
                          </p>
                        </div>
                      )}
                      {mediaFiles[field.id] && mediaFiles[field.id].length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                          {mediaFiles[field.id].map((media) => (
                            <EntityMediaPreview
                              key={media.id}
                              blobUrl={media.blobUrl}
                              fileType={media.fileType}
                              altText={media.altText}
                              caption={media.caption}
                              theme={theme}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : field.type === 'rich_text' ? (
                    <Textarea
                      value={String(data[field.id] || '')}
                      onChange={(e) => updateFieldValue(field.id, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                      rows={5}
                    />
                  ) : field.type === 'boolean' ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(data[field.id])}
                        onChange={(e) => updateFieldValue(field.id, e.target.checked)}
                        className="rounded"
                      />
                      <span className={`text-sm theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        {field.label}
                      </span>
                    </label>
                  ) : field.type === 'number' || field.type === 'currency' ? (
                    <Input
                      type="number"
                      value={String(data[field.id] || '')}
                      onChange={(e) => updateFieldValue(field.id, parseFloat(e.target.value) || 0)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  ) : field.type === 'date' ? (
                    <Input
                      type="date"
                      value={String(data[field.id] || '')}
                      onChange={(e) => updateFieldValue(field.id, e.target.value)}
                    />
                  ) : (
                    <Input
                      type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
                      value={String(data[field.id] || '')}
                      onChange={(e) => updateFieldValue(field.id, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </>
  );
});

EntityEditor.displayName = 'EntityEditor';

