/**
 * Drag and Drop Upload Component
 * 
 * Enhanced upload component with drag-and-drop, click-to-upload, and clipboard paste support.
 * Used specifically for logo and background uploads in AppearanceSettings.
 */

'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui';

export interface DragDropUploadProps {
  profileId: string;
  assetType: 'logo' | 'background';
  onUploadComplete?: (url: string, filename: string) => void;
  onError?: (error: string) => void;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  label?: string;
}

export const DragDropUpload: React.FC<DragDropUploadProps> = ({
  profileId,
  assetType,
  onUploadComplete,
  onError,
  accept,
  maxSizeMB,
  className = '',
  label,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const dragCounterRef = useRef(0);

  // Memoize constants to avoid recalculation
  const defaultMaxSize = useMemo(() => (assetType === 'logo' ? 5 : 50), [assetType]);
  const maxSize = useMemo(() => (maxSizeMB || defaultMaxSize) * 1024 * 1024, [maxSizeMB, defaultMaxSize]);
  
  const defaultAccept = useMemo(() => 
    assetType === 'logo'
      ? 'image/png,image/jpeg,image/jpg'
      : 'image/png,image/jpeg,image/jpg,video/mp4,video/webm',
    [assetType]
  );

  const acceptedTypes = useMemo(() => {
    const types = (accept || defaultAccept).split(',').map(t => t.trim());
    return types;
  }, [accept, defaultAccept]);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxSize) {
      return `File too large. Maximum size: ${maxSizeMB || defaultMaxSize}MB`;
    }

    if (!acceptedTypes.includes(file.type) && !acceptedTypes.includes('*/*')) {
      return `Invalid file type. Allowed: ${acceptedTypes.join(', ')}`;
    }

    return null;
  }, [maxSize, maxSizeMB, defaultMaxSize, acceptedTypes]);

  const uploadFile = useCallback(async (file: File) => {
    // Prevent concurrent uploads
    if (isUploading) {
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onError?.(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetType', assetType);

      const endpoint = `/api/profiles/${profileId}/assets`;

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await res.json();
      const url = data.blobUrl || data.url || '';
      const filename = data.filename || file.name;

      onUploadComplete?.(url, filename);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsUploading(false);
      // Reset file input to allow re-uploading the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [profileId, assetType, validateFile, onUploadComplete, onError, isUploading]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile(file);
  }, [uploadFile]);

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current = 0;
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  }, [uploadFile]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    // Only handle paste if the drop zone is focused or currently dragging
    if (!isFocusedRef.current && !isDragging) {
      return;
    }
    
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await uploadFile(file);
          break;
        }
      }
    }
  }, [uploadFile, isDragging]);

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
  }, []);

  useEffect(() => {
    const dropZone = dropZoneRef.current;
    if (!dropZone) return;

    dropZone.addEventListener('dragenter', handleDragEnter);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('drop', handleDrop);

    // Add paste event listener to document
    document.addEventListener('paste', handlePaste);

    return () => {
      dropZone.removeEventListener('dragenter', handleDragEnter);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('drop', handleDrop);
      document.removeEventListener('paste', handlePaste);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop, handlePaste]);

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          {label}
        </label>
      )}

      <div
        ref={dropZoneRef}
        onFocus={handleFocus}
        onBlur={handleBlur}
        tabIndex={0}
        className={`
          relative border-2 border-dashed rounded-lg p-4
          transition-all duration-200 outline-none
          ${isDragging
            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary-light)]'
            : 'border-[var(--border-color)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-tertiary)]'
          }
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept || defaultAccept}
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          id={`drag-drop-upload-${assetType}-${profileId}`}
        />

        <div className="flex flex-col items-center justify-center text-center space-y-2">
          {isUploading ? (
            <>
              <div className="w-8 h-8 border-3 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[var(--text-secondary)]">Uploading...</p>
            </>
          ) : (
            <>
              <svg
                className="w-8 h-8 text-[var(--text-tertiary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  {isDragging ? 'Drop file here' : 'Drag and drop or paste (Ctrl+V)'}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleButtonClick();
                }}
                disabled={isUploading}
                className="mt-1"
              >
                Choose File
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      {maxSizeMB && (
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Max size: {maxSizeMB}MB
        </p>
      )}
    </div>
  );
};
