/**
 * Profile List Component
 * 
 * Displays a list of profiles with selection and actions
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/useTheme';
import { buildAssetUrl } from '@/lib/asset-url';
import { DeleteProfileConfirmation } from './DeleteProfileConfirmation';
import type { Profile } from '@/types/profile';
import type { AvatarConfig } from '@/types/avatar';

interface ProfileListProps {
  onProfileSelect: (profile: Profile) => void;
  onSettingsClick: (profile: Profile) => void;
}

export const ProfileList: React.FC<ProfileListProps> = ({
  onProfileSelect,
  onSettingsClick,
}) => {
  const { profiles, currentProfile, deleteProfile } = useProfile();
  const theme = useTheme();
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 sleek-scrollbar">
      {profiles.map((p) => {
        const logoSrc = p.logoBlobUrl
          ? buildAssetUrl(p.id, 'logo')
          : null;
        const isCurrent = currentProfile?.id === p.id;

        return (
          <div
            key={p.id}
            className={`group relative w-full p-3 rounded-3xl border transition-all duration-300 flex flex-col gap-3 ${
              isCurrent
                ? theme === 'light'
                  ? 'bg-zinc-50 border-[var(--accent-primary)] shadow-lg scale-[1.02]'
                  : 'bg-zinc-800 border-[var(--accent-primary)] shadow-lg scale-[1.02]'
                : theme === 'light'
                ? 'bg-white border-zinc-100 hover:border-zinc-300 hover:shadow-md'
                : 'bg-black/20 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
            }`}
          >
            <button
              onClick={() => onProfileSelect(p)}
              className="absolute inset-0 z-0 rounded-3xl"
              aria-label={`Select ${p.name}`}
            />

            <div
              className={`relative w-full h-32 rounded-2xl overflow-hidden border z-10 pointer-events-none ${
                theme === 'light' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-900 border-zinc-700'
              }`}
            >
              {logoSrc ? (
                <Image
                  src={logoSrc}
                  alt={p.name}
                  fill
                  priority
                  className="object-contain p-4"
                />
              ) : (
                <div
                  className={`w-full h-full flex items-center justify-center text-4xl font-bold opacity-20 ${
                    theme === 'light' ? 'text-zinc-300' : 'text-zinc-700'
                  }`}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-1 z-10 pointer-events-none gap-4">
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-lg font-medium truncate ${
                      theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'
                    }`}
                  >
                    {p.name}
                  </h3>
                  {isCurrent && (
                    <span
                      className="shrink-0 w-2 h-2 rounded-full bg-[var(--accent-primary)]"
                      title="Active"
                    />
                  )}
                </div>

                <div
                  className={`flex flex-wrap gap-2 text-xs font-medium opacity-60 ${
                    theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'
                  }`}
                >
                  <span>{(p.avatarConfig as AvatarConfig)?.character || 'N/A'}</span>
                  <span>•</span>
                  <span className="truncate max-w-[120px] capitalize" title="Avatar Style">
                    {(p.avatarConfig as AvatarConfig)?.style || 'Default'}
                  </span>
                </div>
              </div>

              <div className="flex gap-1 pointer-events-auto shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSettingsClick(p);
                  }}
                  className={`p-2 rounded-full transition-colors cursor-pointer ${
                    theme === 'light'
                      ? 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                  title="Modify Profile"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>

                {profiles.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfileToDelete(p);
                    }}
                    className={`p-2 rounded-full transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'text-zinc-400 hover:text-red-600 hover:bg-red-50'
                        : 'text-zinc-500 hover:text-red-400 hover:bg-red-900/20'
                    }`}
                    title="Delete Profile"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {profileToDelete && (
        <DeleteProfileConfirmation
          profileName={profileToDelete.name}
          onConfirm={async () => {
            await deleteProfile(profileToDelete.id);
            setProfileToDelete(null);
          }}
          onCancel={() => setProfileToDelete(null)}
        />
      )}
    </div>
  );
};

