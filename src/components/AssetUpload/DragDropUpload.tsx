/**
 * Drag and Drop Upload Component
 * 
 * Enhanced upload component with drag-and-drop, click-to-upload, and clipboard paste support.
 * Supports logo, background, and knowledge file uploads with configurable accepted file types.
 * Displays accepted file types and validates both MIME types and file extensions.
 */

'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui';

export interface DragDropUploadProps {
  endpoint: string;
  accept: string;
  onUploadComplete?: (url: string, filename: string) => void;
  onError?: (error: string) => void;
  maxSizeMB?: number;
  className?: string;
  label?: string;
  showAcceptedTypes?: boolean;
  useBlobUrl?: boolean;
  formDataFields?: Record<string, string>;
}

export const DragDropUpload: React.FC<DragDropUploadProps> = ({
  endpoint,
  accept,
  onUploadComplete,
  onError,
  maxSizeMB,
  className = '',
  label,
  showAcceptedTypes = true,
  useBlobUrl = false,
  formDataFields,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);
  const dragCounterRef = useRef(0);

  // Memoize constants to avoid recalculation
  const maxSize = useMemo(() => (maxSizeMB || 50) * 1024 * 1024, [maxSizeMB]);

  const acceptedTypes = useMemo(() => {
    const types = accept.split(',').map(t => t.trim());
    return types;
  }, [accept]);

  // Format accepted types for display (deduplicated)
  const displayAcceptedTypes = useMemo(() => {
    const extensionSet = new Set<string>();
    
    acceptedTypes
      .filter(type => type !== '*/*')
      .forEach(type => {
        // Convert MIME types to file extensions for display
        if (type.startsWith('.')) {
          extensionSet.add(type.toUpperCase());
        } else if (type.includes('/')) {
          const parts = type.split('/');
          if (parts[1] === '*') {
            extensionSet.add(parts[0].toUpperCase());
          } else {
            // Map common MIME types to extensions
            const mimeMap: Record<string, string> = {
              'image/png': '.PNG',
              'image/jpeg': '.JPG',
              'image/jpg': '.JPG',
              'video/mp4': '.MP4',
              'video/webm': '.WEBM',
              'application/pdf': '.PDF',
              'text/plain': '.TXT',
              'text/markdown': '.MD',
            };
            const extension = mimeMap[type] || type.split('/')[1].toUpperCase();
            extensionSet.add(extension);
          }
        } else {
          extensionSet.add(type.toUpperCase());
        }
      });
    
    return Array.from(extensionSet).join(', ');
  }, [acceptedTypes]);

  const validateFile = useCallback((file: File): string | null => {
    if (file.size > maxSize) {
      return `File too large. Maximum size: ${maxSizeMB || 50}MB`;
    }

    // Check if wildcard is allowed
    if (acceptedTypes.includes('*/*')) {
      return null;
    }

    // Check MIME type
    if (acceptedTypes.includes(file.type)) {
      return null;
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    const hasMatchingExtension = acceptedTypes.some(type => {
      if (type.startsWith('.')) {
        return type.toLowerCase() === fileExtension;
      }
      return false;
    });

    if (hasMatchingExtension) {
      return null;
    }

    return `Invalid file type. Allowed: ${displayAcceptedTypes || acceptedTypes.join(', ')}`;
  }, [maxSize, maxSizeMB, acceptedTypes, displayAcceptedTypes]);

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
      
      // Append any additional form data fields
      if (formDataFields) {
        Object.entries(formDataFields).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await res.json();
      // Use blobUrl if useBlobUrl is true, otherwise use filename
      // Check for nested mediaFile.blobUrl (entity media) or direct blobUrl
      const url = useBlobUrl 
        ? (data.mediaFile?.blobUrl || data.blobUrl || data.url || '')
        : (data.filename || file.name);
      const filename = data.filename || data.mediaFile?.filename || file.name;

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
  }, [endpoint, formDataFields, validateFile, onUploadComplete, onError, isUploading, useBlobUrl]);

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
          accept={accept}
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          id={`drag-drop-upload-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`}
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
                variant="primary"
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

      <div className="mt-1 space-y-0.5">
        {maxSizeMB && (
          <p className="text-xs text-[var(--text-tertiary)]">
            Max size: {maxSizeMB}MB
          </p>
        )}
        {showAcceptedTypes && displayAcceptedTypes && (
          <p className="text-xs text-[var(--text-tertiary)]">
            Accepted: {displayAcceptedTypes}
          </p>
        )}
      </div>
    </div>
  );
};
