/**
 * Profile Manager Component
 * 
 * Handles profile creation form and input.
 * Note: This is specifically for the creation form, not for listing/selecting profiles.
 * Use ProfileList for profile selection and display.
 */

'use client';

import React, { useState } from 'react';
import { useProfile } from '@/context/ProfileContext';
import { Button, Input } from '@/components/ui';
import type { Profile } from '@/types/profile';

interface ProfileManagerProps {
  onProfileSelect?: (profile: Profile | null) => void;
  className?: string;
}

export const ProfileManager: React.FC<ProfileManagerProps> = ({
  onProfileSelect,
  className = '',
}) => {
  const { createProfile, profileState } = useProfile();
  const [newProfileName, setNewProfileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      setError('Profile name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const profile = await createProfile(newProfileName.trim());
      if (profile) {
        setNewProfileName('');
        onProfileSelect?.(profile);
      } else {
        setError('Failed to create profile');
      }
    } catch (err) {
      console.error('Failed to create profile', err);
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsCreating(false);
    }
  };

  const isLoading = profileState.type === 'loading';

  return (
    <div className={className}>
      <Input
        label="Profile Name"
        type="text"
        value={newProfileName}
        onChange={(e) => {
          setNewProfileName(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && newProfileName.trim() && !isCreating) {
            handleCreateProfile();
          }
        }}
        placeholder="Enter profile name..."
        disabled={isCreating || isLoading}
        error={error || undefined}
      />

      <Button
        variant="primary"
        onClick={handleCreateProfile}
        disabled={isCreating || isLoading || !newProfileName.trim()}
        isLoading={isCreating}
        className="w-full mt-4"
      >
        Create Profile
      </Button>
    </div>
  );
};
