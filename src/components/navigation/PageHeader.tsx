/**
 * Page Header Component
 * 
 * Reusable header with navigation actions (settings, home, user menu)
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';
import { useProfile } from '@/context/ProfileContext';
import { UserMenu } from '@/components/user';

interface PageHeaderProps {
  onSettingsClick?: () => void;
  showHomeButton?: boolean;
  showThemeToggle?: boolean;
  showUserMenu?: boolean;
  onHomeClick?: () => void;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  onSettingsClick,
  showHomeButton = true,
  showThemeToggle = false,
  showUserMenu = true,
  onHomeClick,
  className = '',
}) => {
  const router = useRouter();
  const theme = useTheme();
  const { toggleTheme, currentProfile, hydrated } = useProfile();

  return (
    <div
      className={`absolute top-4 right-4 z-50 flex items-center gap-2 theme-transition ${
        theme === 'light' ? 'bg-white/90' : 'bg-zinc-900/90'
      } backdrop-blur-md rounded-full px-3 py-2 shadow-lg border ${
        theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'
      } ${className}`}
    >
      {showThemeToggle && currentProfile && hydrated && (
        <button
          onClick={toggleTheme}
          type="button"
          className={`p-2 rounded-full transition-all duration-200 ${
            theme === 'light' 
              ? 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900' 
              : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
          }`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )}
        </button>
      )}
      {onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className={`p-2 rounded-full transition-colors ${
            theme === 'light' ? 'text-zinc-600 hover:bg-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'
          }`}
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}
      {showHomeButton && (
        <button
          onClick={onHomeClick || (() => router.push('/'))}
          className={`p-2 rounded-full transition-colors ${
            theme === 'light' ? 'text-zinc-600 hover:bg-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'
          }`}
          title="Back to Home"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </button>
      )}
      {showUserMenu && <UserMenu />}
    </div>
  );
};

