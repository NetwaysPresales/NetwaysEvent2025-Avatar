'use client';

import { Textarea } from '@/components/ui';
import type { AzureOpenAIConfig } from '@/types/avatar';

export function BehaviorSettings({
  config,
  onChange,
}: {
  config: AzureOpenAIConfig;
  onChange: (config: AzureOpenAIConfig) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--accent-primary)]">
          Agent Behavior
        </h3>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Define the role, tone, boundaries, and response style for this preset.
        </p>
      </div>
      <Textarea
        label="System Prompt"
        value={config.systemPrompt || ''}
        onChange={(event) => onChange({ ...config, systemPrompt: event.target.value })}
        placeholder="Describe how this agent should behave..."
        rows={18}
      />
    </div>
  );
}
