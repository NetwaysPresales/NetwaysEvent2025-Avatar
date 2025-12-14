/**
 * Avatar Settings Component
 * 
 * Handles avatar configuration (character, style, etc.)
 */

'use client';

import React from 'react';
import { Input, Select } from '@/components/ui';
import type { AvatarConfig } from '@/types/avatar';

interface AvatarSettingsProps {
  config: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
}

// Azure Avatar Service standard characters
// Based on Azure's official standard photo avatars
// Reference: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars
const AZURE_AVATAR_CHARACTERS = [
  { value: 'lisa', label: 'Lisa' },
  { value: 'david', label: 'David' },
  { value: 'aria', label: 'Aria' },
  { value: 'jenny', label: 'Jenny' },
  { value: 'guy', label: 'Guy' },
  { value: 'tony', label: 'Tony' },
  { value: 'nancy', label: 'Nancy' },
  { value: 'ashley', label: 'Ashley' },
  { value: 'amara', label: 'Amara' },
  { value: 'harry', label: 'Harry' },
  { value: 'animoji', label: 'Animoji' },
];

export const AvatarSettings: React.FC<AvatarSettingsProps> = ({
  config,
  onChange,
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--accent-primary)] uppercase tracking-wider mb-4">
        Avatar Configuration
      </h3>

      <div className="space-y-4">
        <Select
          label="Character"
          value={config.character}
          onChange={(e) => onChange({ ...config, character: e.target.value })}
          options={AZURE_AVATAR_CHARACTERS}
          helperText="Select an Azure Avatar Service character"
        />

        <Input
          label="Style"
          value={config.style || ''}
          onChange={(e) => onChange({ ...config, style: e.target.value })}
          placeholder="e.g., professional, casual"
        />

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.customized || false}
              onChange={(e) => onChange({ ...config, customized: e.target.checked })}
              className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent-primary)] focus:ring-[var(--accent-focus-ring)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">Customized</span>
          </label>
        </div>
      </div>
    </div>
  );
};

