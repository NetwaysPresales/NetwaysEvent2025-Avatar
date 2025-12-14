/**
 * OpenAI Settings Component
 * 
 * Handles Azure OpenAI configuration
 */

'use client';

import React, { useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Input, Textarea } from '@/components/ui';
import type { AzureOpenAIConfig } from '@/types/avatar';

interface OpenAISettingsProps {
  config: AzureOpenAIConfig;
  onChange: (config: AzureOpenAIConfig) => void;
  showApiKey: boolean;
  onToggleApiKey: () => void;
}

export const OpenAISettings: React.FC<OpenAISettingsProps> = ({
  config,
  onChange,
  showApiKey,
  onToggleApiKey,
}) => {
  const theme = useTheme();
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--accent-primary)] uppercase tracking-wider mb-4">
        Azure OpenAI
      </h3>

      <div className="space-y-4">
        <Input
          label="Endpoint"
          value={config.endpoint || ''}
          onChange={(e) => onChange({ ...config, endpoint: e.target.value })}
          placeholder="https://your-resource.openai.azure.com"
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-[var(--text-secondary)]">
              API Key
            </label>
            <button
              type="button"
              onClick={onToggleApiKey}
              className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              {showApiKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={config.apiKey || ''}
            onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
            placeholder="Enter your Azure OpenAI API key"
          />
        </div>

        <Input
          label="Deployment Name"
          value={config.deploymentName || ''}
          onChange={(e) => onChange({ ...config, deploymentName: e.target.value })}
          placeholder="e.g., gpt-4"
        />

        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            System Prompt
          </label>
          <div className={`group rounded-lg overflow-hidden border ${theme === 'light' ? 'border-zinc-300 bg-zinc-50 focus-within:ring-2 focus-within:ring-[var(--accent-focus-ring)] focus-within:border-[var(--accent-primary)]/50' : 'border-zinc-800 bg-zinc-950 focus-within:ring-2 focus-within:ring-[var(--accent-focus-ring)] focus-within:border-[var(--accent-primary)]/50'} transition-all`}>
            <Textarea
              value={config.systemPrompt || ''}
              onChange={(e) => onChange({ ...config, systemPrompt: e.target.value })}
              placeholder="Enter system prompt..."
              rows={6}
              className="border-0 focus:ring-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

