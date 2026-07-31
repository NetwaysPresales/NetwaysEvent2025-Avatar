'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AZURE_AVATAR_CHARACTERS,
  findAvatarCharacter,
  getAvatarPreview,
  normalizeAvatarConfig,
  type AvatarCharacterOption,
} from '@/lib/avatar-catalog';
import type { AvatarConfig } from '@/types/avatar';

interface AvatarSettingsProps {
  config: AvatarConfig;
  onChange: (config: AvatarConfig) => void;
}

function AvatarPreviewImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-[var(--bg-tertiary)] text-xl font-semibold text-[var(--text-tertiary)]">
        {alt.charAt(0)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="aspect-square w-full object-cover object-top transition group-hover:scale-[1.02]"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export const AvatarSettings: React.FC<AvatarSettingsProps> = ({ config, onChange }) => {
  const normalizedConfig = normalizeAvatarConfig(config);
  const selectedCharacter = findAvatarCharacter(normalizedConfig.character);
  const [catalogType, setCatalogType] = useState<'video' | 'photo'>(selectedCharacter?.type || 'video');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!config.customized && (
      config.character !== normalizedConfig.character
      || config.style !== normalizedConfig.style
      || config.avatarType !== normalizedConfig.avatarType
      || config.photoAvatarBaseModel !== normalizedConfig.photoAvatarBaseModel
      || config.videoCrop !== normalizedConfig.videoCrop
    )) {
      onChange(normalizedConfig);
    }
  }, [
    config.avatarType,
    config.character,
    config.customized,
    config.photoAvatarBaseModel,
    config.style,
    config.videoCrop,
    normalizedConfig,
    onChange,
  ]);

  const visibleCharacters = useMemo(() => {
    const query = search.trim().toLowerCase();
    return AZURE_AVATAR_CHARACTERS.filter((character) => (
      character.type === catalogType
      && (!query || character.label.toLowerCase().includes(query))
    ));
  }, [catalogType, search]);

  const selectCharacter = (character: AvatarCharacterOption) => {
    if (character.selectable === false) return;
    onChange(normalizeAvatarConfig({
      ...config,
      customized: false,
      character: character.value,
      style: character.styles[0]?.value || '',
      avatarType: character.type,
      photoAvatarBaseModel: character.type === 'photo' ? 'vasa-1' : undefined,
    }));
  };

  const selectStyle = (style: string) => {
    onChange(normalizeAvatarConfig({ ...config, style }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--accent-primary)]">
          Avatar
        </h3>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Select directly from the current Microsoft real-time avatar catalog.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex shrink-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1">
          {(['video', 'photo'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setCatalogType(type)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                catalogType === type
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {type === 'video' ? 'Full Body' : 'Talking Heads'}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find avatar"
          aria-label="Find avatar"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {visibleCharacters.map((character) => {
          const selected = character.value === selectedCharacter?.value;
          const disabled = character.selectable === false;
          const image = selected
            ? getAvatarPreview(character, normalizedConfig.style)
            : character.previewUrl;
          return (
            <button
              key={character.value}
              type="button"
              disabled={disabled}
              onClick={() => selectCharacter(character)}
              aria-pressed={selected}
              title={character.notice}
              className={`group relative overflow-hidden rounded-lg border text-left transition ${
                selected
                  ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-focus-ring)]'
                  : 'border-[var(--border-color)] hover:border-[var(--text-tertiary)]'
              } ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}
            >
              <AvatarPreviewImage src={image} alt={`${character.label} avatar preview`} />
              <div className="flex items-center justify-between gap-1 bg-[var(--bg-secondary)] px-2 py-1.5">
                <span className="truncate text-xs font-medium text-[var(--text-secondary)]">{character.label}</span>
                {disabled && (
                  <span className="text-[8px] uppercase tracking-wider text-[var(--text-tertiary)]">Pending</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {visibleCharacters.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] py-10 text-center text-sm text-[var(--text-tertiary)]">
          No avatars match this search.
        </div>
      )}

      {selectedCharacter?.type === 'video' && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              {selectedCharacter.label} Style
            </div>
            {selectedCharacter.notice && (
              <div className="text-right text-[10px] text-amber-500">{selectedCharacter.notice}</div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {selectedCharacter.styles.map((style) => {
              const selected = style.value === normalizedConfig.style;
              return (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => selectStyle(style.value)}
                  aria-pressed={selected}
                  className={`group overflow-hidden rounded-lg border text-left transition ${
                    selected
                      ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-focus-ring)]'
                      : 'border-[var(--border-color)] hover:border-[var(--text-tertiary)]'
                  }`}
                >
                  <AvatarPreviewImage src={style.previewUrl} alt={`${selectedCharacter.label} ${style.label} preview`} />
                  <div className="truncate bg-[var(--bg-secondary)] px-2 py-1.5 text-xs text-[var(--text-secondary)]">
                    {style.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedCharacter?.type === 'photo' && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
          {selectedCharacter.label} is a VASA-1 photo avatar preview and does not use a separate style.
        </div>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-[var(--border-color)] pt-4">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={config.customized || false}
            onChange={(event) => onChange({ ...config, customized: event.target.checked })}
            className="h-4 w-4 rounded border-[var(--border-color)] text-[var(--accent-primary)] focus:ring-[var(--accent-focus-ring)]"
          />
          <span className="text-sm text-[var(--text-secondary)]">Customized avatar</span>
        </label>
        <a
          href="https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[var(--accent-primary)] hover:underline"
        >
          Microsoft catalog
        </a>
      </div>
    </div>
  );
};
