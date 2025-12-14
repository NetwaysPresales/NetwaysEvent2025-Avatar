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
import { AssetUpload } from '@/components/AssetUpload';

interface KnowledgeSettingsProps {
  profileId: string;
}

export const KnowledgeSettings: React.FC<KnowledgeSettingsProps> = ({
  profileId,
}) => {
  const { fetchKnowledgeFiles, deleteKnowledgeFile } = useProfile();
  const theme = useTheme();
  const [knowledgeFiles, setKnowledgeFiles] = useState<string[]>([]);
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

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) return;
    if (!profileId) return;

    try {
      await deleteKnowledgeFile(profileId, filename);
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
        <AssetUpload
          profileId={profileId}
          assetType="knowledge"
          onUploadComplete={() => loadFiles()}
          maxSizeMB={50}
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
                key={file}
                className={`flex items-center justify-between p-3 rounded-lg border ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800'}`}
              >
                <span className="text-sm text-[var(--text-primary)] truncate">{file}</span>
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

