/**
 * Asset Upload Component
 * 
 * Reusable component for uploading profile assets (logo, background, knowledge files).
 * Handles file validation, upload progress, and error states.
 */

'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui';

export interface AssetUploadProps {
  profileId: string;
  assetType: 'logo' | 'background' | 'knowledge';
  onUploadComplete?: (url: string, filename: string) => void;
  onError?: (error: string) => void;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  label?: string;
}

export const AssetUpload: React.FC<AssetUploadProps> = ({
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultMaxSize = assetType === 'logo' ? 5 : assetType === 'background' ? 50 : 50;
  const maxSize = (maxSizeMB || defaultMaxSize) * 1024 * 1024;

  const defaultAccept = assetType === 'logo'
    ? 'image/png,image/jpeg,image/jpg'
    : assetType === 'background'
    ? 'image/png,image/jpeg,image/jpg,video/mp4,video/webm'
    : '*/*';

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file size
    if (file.size > maxSize) {
      const errorMsg = `File too large. Maximum size: ${maxSizeMB || defaultMaxSize}MB`;
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      if (assetType === 'logo' || assetType === 'background') {
        formData.append('assetType', assetType);
      }

      const endpoint = assetType === 'knowledge'
        ? `/api/profiles/${profileId}/knowledge`
        : `/api/profiles/${profileId}/assets`;

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await res.json();
      // For logo/background, use blobUrl from API response (for storage) and build API endpoint URL (for display)
      // For knowledge files, just use the filename
      let url: string;
      if (assetType === 'logo' || assetType === 'background') {
        // API returns blobUrl - use it for storage in database
        // The blobUrl is the actual Azure Blob Storage URL
        url = data.blobUrl || data.url || '';
      } else {
        // Knowledge files - just use filename for display
        url = data.filename || file.name;
      }
      const filename = data.filename || file.name;

      setUploadProgress(100);
      onUploadComplete?.(url, filename);
    } catch (err: any) {
      const errorMsg = err.message || 'Upload failed';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept || defaultAccept}
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          id={`asset-upload-${assetType}-${profileId}`}
        />
        
        <label
          htmlFor={`asset-upload-${assetType}-${profileId}`}
          className="cursor-pointer"
        >
          <Button
            variant="primary"
            size="sm"
            disabled={isUploading}
            isLoading={isUploading}
            className="w-full"
          >
            {isUploading ? `Uploading... ${uploadProgress}%` : `Upload ${assetType}`}
          </Button>
        </label>
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

