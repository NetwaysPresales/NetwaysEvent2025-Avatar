/**
 * TTS Settings Component
 * 
 * Handles Text-to-Speech configuration
 */

'use client';

import React, { useId } from 'react';
import type { TTSConfig } from '@/types/avatar';
import { getVoicesByLanguage } from '@/lib/azure-voices';

interface TTSSettingsProps {
  config: TTSConfig;
  onChange: (config: TTSConfig) => void;
}

export const TTSSettings: React.FC<TTSSettingsProps> = ({
  config,
  onChange,
}) => {
  const selectId = useId();
  const voicesByLanguage = getVoicesByLanguage();

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--accent-primary)] uppercase tracking-wider mb-4">
        Text to Speech
      </h3>

      <div className="space-y-4">
        <div className="w-full">
          <label htmlFor={selectId} className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            Voice
          </label>
          <div className="relative">
            <select
              id={selectId}
              value={config.voice || ''}
              onChange={(e) => onChange({ ...config, voice: e.target.value })}
              className={`
                w-full px-4 py-2.5 pr-10
                appearance-none
                bg-[var(--bg-secondary)]
                border rounded-lg
                text-[var(--text-primary)]
                font-light
                transition-all duration-200
                focus:ring-2 focus:ring-[var(--accent-focus-ring)]
                focus:border-[var(--accent-primary)]/50
                outline-none
                disabled:opacity-50 disabled:cursor-not-allowed
                border-[var(--border-color)]
                hover:border-[var(--accent-primary)]/30
                cursor-pointer
              `}
            >
              <option value="">Select a voice...</option>
              {voicesByLanguage.map(({ language, voices }) => (
                <optgroup key={language} label={language}>
                  {voices.map((voice) => (
                    <option key={voice.value} value={voice.value}>
                      {voice.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {/* Custom dropdown arrow */}
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg
                className="w-5 h-5 text-[var(--text-tertiary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

