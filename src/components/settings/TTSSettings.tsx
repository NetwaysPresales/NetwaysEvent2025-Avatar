'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TTSConfig } from '@/types/avatar';
import { ALL_VOICES } from '@/lib/azure-voices';

interface TTSSettingsProps {
  config: TTSConfig;
  onChange: (config: TTSConfig) => void;
}

function voiceName(label: string): string {
  return label.split(' (')[0];
}

export const TTSSettings: React.FC<TTSSettingsProps> = ({ config, onChange }) => {
  const [language, setLanguage] = useState<'English' | 'Arabic'>(
    config.voice?.startsWith('ar-') ? 'Arabic' : 'English'
  );
  const [gender, setGender] = useState<'All' | 'Female' | 'Male'>('All');
  const [search, setSearch] = useState('');
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlsRef = useRef(new Map<string, string>());

  useEffect(() => () => {
    audioRef.current?.pause();
    for (const url of previewUrlsRef.current.values()) URL.revokeObjectURL(url);
  }, []);

  const voices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ALL_VOICES.filter((voice) => {
      const matchesLanguage = language === 'Arabic'
        ? voice.locale.startsWith('ar-')
        : voice.locale.startsWith('en-');
      const matchesGender = gender === 'All' || voice.gender === gender;
      const matchesSearch = !query
        || voice.label.toLowerCase().includes(query)
        || voice.locale.toLowerCase().includes(query);
      return matchesLanguage && matchesGender && matchesSearch;
    });
  }, [gender, language, search]);

  const playPreview = async (voice: string) => {
    setPreviewError(null);
    if (playingVoice === voice) {
      audioRef.current?.pause();
      setPlayingVoice(null);
      return;
    }

    audioRef.current?.pause();
    setLoadingVoice(voice);
    try {
      let url = previewUrlsRef.current.get(voice);
      if (!url) {
        const response = await fetch('/api/tts/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voice }),
        });
        if (!response.ok) throw new Error('Preview unavailable');
        url = URL.createObjectURL(await response.blob());
        previewUrlsRef.current.set(voice, url);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingVoice(null);
      audio.onerror = () => {
        setPlayingVoice(null);
        setPreviewError('This voice preview could not be played.');
      };
      await audio.play();
      setPlayingVoice(voice);
    } catch (error) {
      console.error('Voice preview failed', error);
      setPreviewError('This voice preview could not be played.');
      setPlayingVoice(null);
    } finally {
      setLoadingVoice(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--accent-primary)]">
          Azure Neural Voice
        </h3>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Choose the voice synchronized with the avatar. Preview audio is generated securely through Azure Speech.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex shrink-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1">
          {(['English', 'Arabic'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLanguage(option)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                language === option
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <select
          value={gender}
          onChange={(event) => setGender(event.target.value as typeof gender)}
          aria-label="Filter voices by gender"
          className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
        >
          <option>All</option>
          <option>Female</option>
          <option>Male</option>
        </select>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a voice or locale"
          aria-label="Find a voice"
          className="min-w-0 flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
        />
      </div>

      {previewError && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {previewError}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {voices.map((voice) => {
          const selected = voice.value === config.voice;
          const loading = loadingVoice === voice.value;
          const playing = playingVoice === voice.value;
          const name = voiceName(voice.label);
          return (
            <div
              key={voice.value}
              className={`flex min-w-0 items-center rounded-xl border transition ${
                selected
                  ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5 ring-2 ring-[var(--accent-focus-ring)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-secondary)] hover:border-[var(--text-tertiary)]'
              }`}
            >
              <button
                type="button"
                onClick={() => onChange({ ...config, voice: voice.value })}
                aria-pressed={selected}
                className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-primary)]/10 text-xs font-semibold text-[var(--accent-primary)]">
                  {name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[var(--text-primary)]">{name}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">
                    <span>{voice.locale}</span>
                    <span className="opacity-40">/</span>
                    <span>{voice.gender}</span>
                    {voice.label.includes('Multilingual') && (
                      <span className="rounded bg-[var(--accent-primary)]/10 px-1 text-[var(--accent-primary)]">Multi</span>
                    )}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`${playing ? 'Stop' : 'Play'} ${name} preview`}
                onClick={() => playPreview(voice.value)}
                className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] transition hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
              >
                {loading ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : playing ? (
                  <span className="h-3 w-3 rounded-sm bg-current" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M6.5 4.8v10.4L15 10 6.5 4.8Z" />
                  </svg>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {voices.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border-color)] py-10 text-center text-sm text-[var(--text-tertiary)]">
          No voices match these filters.
        </div>
      )}
    </div>
  );
};
