/**
 * Appearance Settings Component
 * 
 * Handles appearance configuration (title, description, logo, background)
 */

'use client';

import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useAssetUrl, clearAssetUrlCache } from '@/hooks/useAssetUrl';
import { Input, Textarea } from '@/components/ui';
import { DragDropUpload } from '@/components/AssetUpload/DragDropUpload';

interface AppearanceSettingsProps {
  appTitle: string;
  appDescription: string;
  logoUrl: string | null; // API endpoint URL or null
  backgroundUrl: string | null; // API endpoint URL or null
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onLogoChange: (url: string | null) => void;
  onBackgroundChange: (url: string | null) => void;
  profileId: string;
}

export const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
  appTitle,
  appDescription,
  logoUrl,
  backgroundUrl,
  onTitleChange,
  onDescriptionChange,
  onLogoChange,
  onBackgroundChange,
  profileId,
}) => {
  const theme = useTheme();
  // Fetch authenticated SAS URLs
  const authenticatedLogoUrl = useAssetUrl(profileId, 'logo', !!logoUrl);
  const authenticatedBackgroundUrl = useAssetUrl(profileId, 'background', !!backgroundUrl);
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--accent-primary)] uppercase tracking-wider mb-4">
        Company Branding
      </h3>

      <div className="space-y-4">
        <Input
          label="App Title"
          value={appTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g., Netways Avatar"
        />

        <Textarea
          label="App Description"
          value={appDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="e.g., AI-powered voice assistant"
          rows={3}
        />

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Logo
          </label>
          {logoUrl ? (
            <div className={`mb-3 relative w-48 h-24 border-2 border-[var(--border-color)] rounded-lg overflow-hidden theme-transition flex items-center justify-center ${
              theme === 'light' ? 'bg-white' : 'bg-zinc-900'
            }`}>
              {authenticatedLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={authenticatedLogoUrl}
                  alt="Logo"
                  className="object-contain max-w-full max-h-full p-2"
                  onError={(e) => {
                    console.error('[AppearanceSettings] Failed to load logo:', authenticatedLogoUrl);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className={`text-xs ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  Loading...
                </div>
              )}
              <button
                onClick={async () => {
                  if (!confirm('Are you sure you want to delete the logo?')) {
                    return;
                  }
                  try {
                    const res = await fetch(`/api/profiles/${profileId}/assets?assetType=logo`, {
                      method: 'DELETE',
                    });
                    if (res.ok) {
                      clearAssetUrlCache(profileId, 'logo');
                      onLogoChange(null);
                    } else {
                      const error = await res.json();
                      alert(error.error || 'Failed to delete logo');
                    }
                  } catch (error) {
                    console.error('Failed to delete logo:', error);
                    alert('Failed to delete logo');
                  }
                }}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-red-500/90 hover:bg-red-600 text-white transition-colors shadow-md z-10"
                title="Delete logo"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <p className={`text-xs mb-3 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
              No logo uploaded
            </p>
          )}
          <DragDropUpload
            endpoint={`/api/profiles/${profileId}/assets`}
            accept=".png,.jpg,.jpeg"
            onUploadComplete={(url) => {
              clearAssetUrlCache(profileId, 'logo');
              onLogoChange(url);
              // ProfileContext will handle saving when user clicks Save
            }}
            maxSizeMB={5}
            useBlobUrl={true}
            formDataFields={{ assetType: 'logo' }}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-[var(--accent-primary)] uppercase tracking-wider mb-4">
          Background
        </h3>

        {backgroundUrl ? (
          <div className={`mb-3 relative w-full h-32 border-2 border-[var(--border-color)] rounded-lg overflow-hidden theme-transition ${
            theme === 'light' ? 'bg-white' : 'bg-zinc-900'
          }`}>
            {authenticatedBackgroundUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={authenticatedBackgroundUrl}
                alt="Background"
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('[AppearanceSettings] Failed to load background:', authenticatedBackgroundUrl);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center text-xs ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Loading...
              </div>
            )}
            <button
              onClick={async () => {
                if (!confirm('Are you sure you want to delete the background?')) {
                  return;
                }
                try {
                  const res = await fetch(`/api/profiles/${profileId}/assets?assetType=background`, {
                    method: 'DELETE',
                  });
                  if (res.ok) {
                    clearAssetUrlCache(profileId, 'background');
                    onBackgroundChange(null);
                  } else {
                    const error = await res.json();
                    alert(error.error || 'Failed to delete background');
                  }
                } catch (error) {
                  console.error('Failed to delete background:', error);
                  alert('Failed to delete background');
                }
              }}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-red-500/90 hover:bg-red-600 text-white transition-colors shadow-md z-10"
              title="Delete background"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <p className={`text-xs mb-3 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
            No background uploaded
          </p>
        )}

        <DragDropUpload
          endpoint={`/api/profiles/${profileId}/assets`}
          accept=".png,.jpg,.jpeg,.mp4,.webm"
          onUploadComplete={(url) => {
            clearAssetUrlCache(profileId, 'background');
            onBackgroundChange(url);
            // ProfileContext will handle saving when user clicks Save
          }}
          maxSizeMB={50}
          useBlobUrl={true}
          formDataFields={{ assetType: 'background' }}
        />
      </div>
    </div>
  );
};

