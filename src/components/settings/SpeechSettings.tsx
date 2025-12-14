/**
 * Speech Settings Component
 * 
 * Handles Azure Speech configuration
 */

'use client';

import React, { useState } from 'react';
import { Input, Select } from '@/components/ui';
import type { SpeechConfig } from '@/types/avatar';

interface SpeechSettingsProps {
  config: SpeechConfig;
  onChange: (config: SpeechConfig) => void;
  showApiKey: boolean;
  onToggleApiKey: () => void;
}

// Azure Speech Service regions
const AZURE_SPEECH_REGIONS = [
  { value: 'eastus', label: 'East US' },
  { value: 'eastus2', label: 'East US 2' },
  { value: 'southcentralus', label: 'South Central US' },
  { value: 'westus', label: 'West US' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'westus3', label: 'West US 3' },
  { value: 'australiaeast', label: 'Australia East' },
  { value: 'southeastasia', label: 'Southeast Asia' },
  { value: 'northeurope', label: 'North Europe' },
  { value: 'swedencentral', label: 'Sweden Central' },
  { value: 'uksouth', label: 'UK South' },
  { value: 'westeurope', label: 'West Europe' },
  { value: 'centralus', label: 'Central US' },
  { value: 'southafricanorth', label: 'South Africa North' },
  { value: 'centralindia', label: 'Central India' },
  { value: 'eastasia', label: 'East Asia' },
  { value: 'japaneast', label: 'Japan East' },
  { value: 'koreacentral', label: 'Korea Central' },
  { value: 'canadacentral', label: 'Canada Central' },
  { value: 'francecentral', label: 'France Central' },
  { value: 'germanywestcentral', label: 'Germany West Central' },
  { value: 'italynorth', label: 'Italy North' },
  { value: 'norwayeast', label: 'Norway East' },
  { value: 'polandcentral', label: 'Poland Central' },
  { value: 'switzerlandnorth', label: 'Switzerland North' },
  { value: 'uaenorth', label: 'UAE North' },
  { value: 'brazilsouth', label: 'Brazil South' },
];

export const SpeechSettings: React.FC<SpeechSettingsProps> = ({
  config,
  onChange,
  showApiKey,
  onToggleApiKey,
}) => {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-[var(--accent-primary)] uppercase tracking-wider mb-4">
        Azure Speech
      </h3>

      <div className="space-y-4">
        <Select
          label="Region"
          value={config.region}
          onChange={(e) => onChange({ ...config, region: e.target.value })}
          options={AZURE_SPEECH_REGIONS}
          helperText="Select your Azure Speech Service region"
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
            placeholder="Enter your Azure Speech API key"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.enablePrivateEndpoint || false}
              onChange={(e) => onChange({ ...config, enablePrivateEndpoint: e.target.checked })}
              className="w-4 h-4 rounded border-[var(--border-color)] text-[var(--accent-primary)] focus:ring-[var(--accent-focus-ring)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">Enable Private Endpoint</span>
          </label>
        </div>

        {config.enablePrivateEndpoint && (
          <Input
            label="Private Endpoint"
            value={config.privateEndpoint || ''}
            onChange={(e) => onChange({ ...config, privateEndpoint: e.target.value })}
            placeholder="https://your-endpoint.cognitiveservices.azure.com"
          />
        )}
      </div>
    </div>
  );
};

