/**
 * Entity Settings Component
 * 
 * Manages entities for visualization (simplified - no templates/instances)
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { EntityEditor } from './EntityEditor';

interface EntitySettingsProps {
  profileId: string;
}

interface Entity {
  id: string;
  name: string;
  description: string | null;
  structure: {
    layout: 'card' | 'sidebar' | 'modal' | 'fullscreen';
    fields: Array<{
      id: string;
      label: string;
      type: 'text' | 'rich_text' | 'number' | 'currency' | 'date' | 'image' | 'video' | 'url' | 'email' | 'phone' | 'boolean' | 'json';
      order: number;
      required?: boolean;
      display?: Record<string, unknown>;
    }>;
  };
  data: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  mediaFiles?: Array<{
    id: string;
    fieldId: string;
    blobUrl: string;
    fileType: string;
    altText: string | null;
    caption: string | null;
  }>;
}

export const EntitySettings: React.FC<EntitySettingsProps> = ({ profileId }) => {
  const theme = useTheme();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntity, setEditingEntity] = useState<Entity | null | undefined>(undefined); // undefined = closed, null = new, Entity = editing

  // Load entities
  const loadEntities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/profiles/${profileId}/entities`);
      if (res.ok) {
        const data = await res.json();
        setEntities(data.entities || []);
      }
    } catch (error) {
      console.error('Failed to load entities:', error);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  const handleDuplicate = useCallback(async (entity: Entity) => {
    try {
      const res = await fetch(`/api/profiles/${profileId}/entities/${entity.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        // Open editor with duplicated entity
        setEditingEntity(data.entity);
        loadEntities();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to duplicate entity');
      }
    } catch (error) {
      console.error('Failed to duplicate entity:', error);
      alert('Failed to duplicate entity');
    }
  }, [profileId, loadEntities]);

  const handleDelete = useCallback(async (entityId: string) => {
    if (!confirm('Are you sure you want to delete this entity? All associated media files will also be deleted.')) {
      return;
    }

    try {
      const res = await fetch(`/api/profiles/${profileId}/entities/${entityId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadEntities();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete entity');
      }
    } catch (error) {
      console.error('Failed to delete entity:', error);
      alert('Failed to delete entity');
    }
  }, [profileId, loadEntities]);

  const [entityValidation, setEntityValidation] = useState({ isValid: false, isSaving: false });
  const editorRef = useRef<{ save: () => Promise<void>; isValid: () => boolean; isSaving: () => boolean } | null>(null);

  const handleSave = useCallback(async () => {
    if (!entityValidation.isValid || entityValidation.isSaving) return;
    if (editorRef.current) {
      await editorRef.current.save();
    }
  }, [entityValidation]);

  const handleValidationChange = useCallback((isValid: boolean, isSaving: boolean) => {
    setEntityValidation(prev => {
      // Avoid unnecessary state updates that can trigger extra renders
      if (prev.isValid === isValid && prev.isSaving === isSaving) {
        return prev;
      }
      return { isValid, isSaving };
    });
  }, []);

  const handleEditorSave = useCallback(async (entityData: {
    name: string;
    description: string;
    structure: { layout: string; fields: Array<{ id: string; label: string; type: string; order: number; required?: boolean; display?: Record<string, unknown> }> };
    data: Record<string, unknown>;
  }) => {
    try {
      const url = editingEntity
        ? `/api/profiles/${profileId}/entities/${editingEntity.id}`
        : `/api/profiles/${profileId}/entities`;
      const method = editingEntity ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entityData),
      });

      if (res.ok) {
        setEditingEntity(undefined);
        loadEntities();
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to save entity');
      }
    } catch (error) {
      console.error('Failed to save entity:', error);
      alert('Failed to save entity');
    }
  }, [profileId, editingEntity, loadEntities]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className={`text-sm theme-transition ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Loading entities...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className={`text-lg font-semibold theme-transition ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
              Entities
            </h3>
            <p className={`text-sm mt-1 theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
              Create entities that the agent can visualize and discuss. Define fields and fill in data all in one place.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setEditingEntity(null)}
            className="whitespace-nowrap"
          >
            + New Entity
          </Button>
        </div>

        {entities.length === 0 ? (
          <div className={`p-8 rounded-lg border-2 border-dashed text-center theme-transition ${theme === 'light' ? 'bg-zinc-50 border-zinc-300' : 'bg-zinc-800/50 border-zinc-700'}`}>
            <p className={`text-sm theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
              No entities yet. Click &quot;New Entity&quot; above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {entities.map((entity) => (
              <div
                key={entity.id}
                className={`p-4 rounded-lg border theme-transition ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-800/50 border-zinc-700'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className={`font-medium theme-transition ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
                      {entity.name}
                    </h4>
                    {entity.description && (
                      <p className={`text-sm mt-1 theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        {entity.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <p className={`text-xs theme-transition ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        Layout: {entity.structure?.layout || 'sidebar'} • Fields: {entity.structure?.fields?.length || 0}
                      </p>
                      <p className={`text-xs theme-transition ${entity.isActive ? (theme === 'light' ? 'text-green-600' : 'text-green-400') : (theme === 'light' ? 'text-zinc-400' : 'text-zinc-500')}`}>
                        {entity.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="secondary"
                      onClick={() => setEditingEntity(entity)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleDuplicate(entity)}
                    >
                      Duplicate
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleDelete(entity.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entity Editor Modal */}
      {editingEntity !== undefined && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`theme-transition ${theme === 'light' ? 'bg-white border-zinc-300' : 'bg-zinc-900 border-zinc-800'} border rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col my-8 overflow-hidden`}>
            <div className={`flex-shrink-0 theme-transition ${theme === 'light' ? 'bg-white' : 'bg-zinc-900'} border-b ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'} px-6 py-4 flex items-center justify-between rounded-t-2xl`}>
              <h3 className={`text-xl font-semibold theme-transition ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
                {editingEntity ? 'Edit Entity' : 'Create Entity'}
              </h3>
              <button
                onClick={() => setEditingEntity(undefined)}
                className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <EntityEditor
                ref={editorRef}
                profileId={profileId}
                entity={editingEntity || null}
                onSave={handleEditorSave}
                onCancel={() => setEditingEntity(undefined)}
                onValidationChange={handleValidationChange}
              />
            </div>
            <div className={`flex-shrink-0 border-t ${theme === 'light' ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900'} px-6 py-4 rounded-b-2xl`}>
              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setEditingEntity(undefined)}
                  disabled={entityValidation.isSaving}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={!entityValidation.isValid || entityValidation.isSaving}
                >
                  {entityValidation.isSaving ? 'Saving...' : editingEntity ? 'Update Entity' : 'Create Entity'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
