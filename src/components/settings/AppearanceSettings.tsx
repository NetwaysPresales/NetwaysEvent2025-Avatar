/**
 * Appearance Settings Component
 * 
 * Handles appearance configuration (title, description, logo, background)
 */

'use client';

import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Input, Textarea } from '@/components/ui';
import { DragDropUpload } from '@/components/AssetUpload/DragDropUpload';
import Image from 'next/image';

interface AppearanceSettingsProps {
  appTitle: string;
  appDescription: string;
  logoUrl: string | null;
  backgroundUrl: string | null;
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
          {logoUrl && (
            <div className="mb-3 relative w-32 h-16 border border-[var(--border-color)] rounded-lg overflow-hidden">
              <Image
                src={logoUrl}
                alt="Logo"
                fill
                className="object-contain p-2"
              />
            </div>
          )}
          <DragDropUpload
            profileId={profileId}
            assetType="logo"
            onUploadComplete={(url) => {
              onLogoChange(url);
              // ProfileContext will handle saving when user clicks Save
            }}
            maxSizeMB={5}
            accept="image/png,image/jpeg,image/jpg"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium text-[var(--accent-primary)] uppercase tracking-wider mb-4">
          Background
        </h3>

        {backgroundUrl && (
          <div className="mb-3 relative w-full h-32 border border-[var(--border-color)] rounded-lg overflow-hidden">
            <Image
              src={backgroundUrl}
              alt="Background"
              fill
              className="object-cover"
            />
          </div>
        )}

        <DragDropUpload
          profileId={profileId}
          assetType="background"
          onUploadComplete={(url) => {
            onBackgroundChange(url);
            // ProfileContext will handle saving when user clicks Save
          }}
          maxSizeMB={50}
          accept="image/png,image/jpeg,image/jpg,video/mp4,video/webm"
        />
      </div>
    </div>
  );
};

