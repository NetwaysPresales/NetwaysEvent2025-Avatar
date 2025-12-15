/**
 * Avatar Settings Component
 * 
 * Handles avatar configuration (character, style, etc.)
 */

'use client';

import React from 'react';
import { Select } from '@/components/ui';
import type { AvatarConfig } from '@/types/avatar';

interface AvatarSettingsProps {
  config: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
}

// Azure Avatar Service standard video avatars
// Based on Azure's official standard video avatars
// Reference: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars
interface AvatarCharacter {
  value: string;
  label: string;
  styles: { value: string; label: string }[];
}

const AZURE_AVATAR_CHARACTERS: AvatarCharacter[] = [
  {
    value: 'harry',
    label: 'Harry',
    styles: [
      { value: 'business', label: 'Business' },
      { value: 'casual', label: 'Casual' },
      { value: 'youthful', label: 'Youthful' },
    ],
  },
  {
    value: 'jeff',
    label: 'Jeff',
    styles: [
      { value: 'business', label: 'Business' },
      { value: 'formal', label: 'Formal' },
    ],
  },
  {
    value: 'lisa',
    label: 'Lisa',
    styles: [
      { value: 'casual-sitting', label: 'Casual Sitting' },
      { value: 'graceful-sitting', label: 'Graceful Sitting' },
      { value: 'graceful-standing', label: 'Graceful Standing' },
      { value: 'technical-sitting', label: 'Technical Sitting' },
      { value: 'technical-standing', label: 'Technical Standing' },
    ],
  },
  {
    value: 'lori',
    label: 'Lori',
    styles: [
      { value: 'casual', label: 'Casual' },
      { value: 'graceful', label: 'Graceful' },
      { value: 'formal', label: 'Formal' },
    ],
  },
  {
    value: 'max',
    label: 'Max',
    styles: [
      { value: 'business', label: 'Business' },
      { value: 'casual', label: 'Casual' },
      { value: 'formal', label: 'Formal' },
    ],
  },
  {
    value: 'meg',
    label: 'Meg',
    styles: [
      { value: 'formal', label: 'Formal' },
      { value: 'casual', label: 'Casual' },
      { value: 'business', label: 'Business' },
    ],
  },
];

export const AvatarSettings: React.FC<AvatarSettingsProps> = ({
  config,
  onChange,
}) => {
  // Case-insensitive character matching
  const selectedCharacter = AZURE_AVATAR_CHARACTERS.find(
    (char) => char.value.toLowerCase() === (config.character || '').toLowerCase()
  );

  const characterOptions = AZURE_AVATAR_CHARACTERS.map((char) => ({
    value: char.value,
    label: char.label,
  }));

  const styleOptions = selectedCharacter
    ? selectedCharacter.styles.map((style) => ({
        value: style.value,
        label: style.label,
      }))
    : [];

  // Ensure style is valid for the selected character
  const currentStyle = config.style || '';
  const isValidStyle = selectedCharacter?.styles.some(
    (s) => s.value === currentStyle
  );
  const effectiveStyle = isValidStyle ? currentStyle : (selectedCharacter?.styles[0]?.value || '');

  // Auto-fix invalid style if character is selected but style is invalid
  React.useEffect(() => {
    if (selectedCharacter && !isValidStyle && effectiveStyle && effectiveStyle !== currentStyle) {
      onChange({
        ...config,
        style: effectiveStyle,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCharacter?.value, currentStyle]);

  const handleCharacterChange = (characterValue: string) => {
    const newCharacter = AZURE_AVATAR_CHARACTERS.find(
      (char) => char.value === characterValue
    );
    // Reset style when character changes, or keep it if it's still valid
    const newStyle = newCharacter?.styles.find(
      (s) => s.value === config.style
    )
      ? config.style
      : newCharacter?.styles[0]?.value || '';
    
    onChange({
      ...config,
      character: characterValue,
      style: newStyle,
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--accent-primary)] uppercase tracking-wider mb-4">
        Avatar Configuration
      </h3>

      <div className="space-y-4">
        <Select
          label="Character"
          value={config.character}
          onChange={(e) => handleCharacterChange(e.target.value)}
          options={characterOptions}
          helperText="Select an Azure Avatar Service character"
        />

        <Select
          label="Style"
          value={effectiveStyle}
          onChange={(e) => onChange({ ...config, style: e.target.value })}
          options={styleOptions}
          helperText={
            selectedCharacter
              ? `Select a style for ${selectedCharacter.label}`
              : 'Select a character first'
          }
          disabled={!selectedCharacter || styleOptions.length === 0}
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

