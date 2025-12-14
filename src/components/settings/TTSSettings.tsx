/**
 * TTS Settings Component
 * 
 * Handles Text-to-Speech configuration
 */

'use client';

import React from 'react';
import { Input } from '@/components/ui';
import type { TTSConfig } from '@/types/avatar';

interface TTSSettingsProps {
  config: TTSConfig;
  onChange: (config: TTSConfig) => void;
}

export const TTSSettings: React.FC<TTSSettingsProps> = ({
  config,
  onChange,
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--accent-primary)] uppercase tracking-wider mb-4">
        Text to Speech
      </h3>

      <div className="space-y-4">
        <Input
          label="Voice"
          value={config.voice || ''}
          onChange={(e) => onChange({ ...config, voice: e.target.value })}
          placeholder="e.g., en-US-JennyNeural"
        />
      </div>
    </div>
  );
};

