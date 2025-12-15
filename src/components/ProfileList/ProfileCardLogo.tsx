/**
 * Profile Card Logo Component
 * 
 * Fetches and displays the logo for a profile card
 */

'use client';

import React from 'react';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { useTheme } from '@/hooks/useTheme';

interface ProfileCardLogoProps {
  profileId: string;
  profileName: string;
  hasLogo: boolean;
}

export const ProfileCardLogo: React.FC<ProfileCardLogoProps> = ({
  profileId,
  profileName,
  hasLogo,
}) => {
  const theme = useTheme();
  const logoSrc = useAssetUrl(profileId, 'logo', hasLogo);

  return (
    <>
      {hasLogo && logoSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt={profileName}
          className="w-full h-full object-contain p-4"
          onError={(e) => {
            // Hide image on error, show fallback
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback') as HTMLElement;
            if (fallback) {
              fallback.style.display = 'flex';
            }
          }}
        />
      )}
      <div
        className={`logo-fallback w-full h-full flex items-center justify-center text-4xl font-bold opacity-20 ${
          hasLogo && logoSrc ? 'hidden' : ''
        } ${theme === 'light' ? 'text-zinc-300' : 'text-zinc-700'}`}
      >
        {profileName.charAt(0).toUpperCase()}
      </div>
    </>
  );
};

