/**
 * Create Profile Modal Component
 * 
 * Modal for creating a new profile
 */

'use client';

import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { ProfileManager } from '@/components/ProfileManager';
import type { Profile } from '@/types/profile';

interface CreateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileCreated: (profile: Profile) => void;
}

export const CreateProfileModal: React.FC<CreateProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileCreated,
}) => {
  const theme = useTheme();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className={`${
          theme === 'light' ? 'bg-white border-zinc-300' : 'bg-zinc-900 border-zinc-800'
        } border rounded-2xl shadow-2xl max-w-md w-full p-6`}
      >
        <h3 className={`text-xl font-medium mb-4 ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
          Create New Profile
        </h3>
        <ProfileManager
          onProfileSelect={(profile) => {
            if (profile) {
              onProfileCreated(profile);
            }
            onClose();
          }}
        />
        <button
          onClick={onClose}
          className={`mt-4 w-full py-2 px-4 rounded-lg border ${
            theme === 'light'
              ? 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'
              : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
          }`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

