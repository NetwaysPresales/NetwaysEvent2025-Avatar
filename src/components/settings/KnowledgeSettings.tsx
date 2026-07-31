/**
 * Knowledge Settings Component
 * 
 * Handles knowledge base file management
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { DragDropUpload } from '@/components/AssetUpload/DragDropUpload';
import type { KnowledgeFileSummary } from '@/context/ProfileContext';

interface KnowledgeSettingsProps {
  profileId: string;
}

export const KnowledgeSettings: React.FC<KnowledgeSettingsProps> = ({
  profileId,
}) => {
  const { fetchKnowledgeFiles, deleteKnowledgeFile } = useProfile();
  const theme = useTheme();
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFileSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadFiles = useCallback(async () => {
    if (!profileId) return;
    setIsLoading(true);
    try {
      const files = await fetchKnowledgeFiles(profileId);
      setKnowledgeFiles(files);
    } catch (err) {
      console.error('Failed to fetch knowledge files', err);
    } finally {
      setIsLoading(false);
    }
  }, [profileId, fetchKnowledgeFiles]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDeleteFile = async (file: KnowledgeFileSummary) => {
    if (!confirm(`Are you sure you want to delete "${file.filename}"?`)) return;
    if (!profileId) return;

    try {
      await deleteKnowledgeFile(profileId, file.id);
      await loadFiles();
    } catch (err) {
      console.error('Failed to delete file', err);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--accent-primary)] uppercase tracking-wider mb-4">
        Knowledge Files
      </h3>

      <div className="space-y-4">
        <DragDropUpload
          endpoint={`/api/profiles/${profileId}/knowledge`}
          accept=".pdf,.docx,.txt,.md,.json"
          onUploadComplete={() => loadFiles()}
          maxSizeMB={5}
          useBlobUrl={false}
          showAcceptedTypes={true}
        />

        {isLoading ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            Loading files...
          </div>
        ) : knowledgeFiles.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-tertiary)]">
            No knowledge files uploaded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {knowledgeFiles.map((file) => (
              <div
                key={file.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800'}`}
              >
                <div className="min-w-0">
                  <div className="text-sm text-[var(--text-primary)] truncate">{file.filename}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {file.indexed ? `Indexed in ${file.chunkCount} chunks` : 'Indexing required'}
                  </div>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteFile(file)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

