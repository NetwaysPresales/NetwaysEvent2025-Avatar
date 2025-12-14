/**
 * User Menu Component
 * 
 * Displays user profile information and logout functionality
 */

'use client';

import React, { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';

interface UserMenuProps {
  className?: string;
}

export const UserMenu: React.FC<UserMenuProps> = ({ className = '' }) => {
  const theme = useTheme();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Return null if no session or loading - this will prevent empty space
  if (status === 'loading' || status === 'unauthenticated' || !session?.user) {
    return null;
  }

  const handleLogout = () => {
    setIsLoggingOut(true);
    setIsOpen(false); // Close dropdown immediately
    
    // Start signOut in background (fire and forget)
    // The session cookie will be cleared by signOut
    signOut({ redirect: false }).catch((error) => {
      console.error('Logout failed', error);
    });
    
    // Redirect immediately - no delay
    // Using window.location ensures full page reload and clean state
    window.location.href = '/auth/signin';
  };

  const userInitials = session.user.name
    ? session.user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : session.user.email?.[0].toUpperCase() || 'U';

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className={`p-2 rounded-full transition-all duration-200 ${
          theme === 'light' 
            ? 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus:bg-zinc-100 focus:text-zinc-900' 
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 focus:bg-zinc-800 focus:text-zinc-200'
        }`}
        title={session.user.name || session.user.email || 'User'}
      >
        <div
          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold ${
            theme === 'light' ? 'bg-[var(--accent-primary-light)] text-[var(--accent-primary-dark)]' : 'bg-[var(--accent-primary-light)] text-[var(--accent-primary)]'
          }`}
        >
          {userInitials}
        </div>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`absolute top-full mt-3 w-64 rounded-lg shadow-xl border z-50 ${
              theme === 'light'
                ? 'bg-white border-zinc-200'
                : 'bg-zinc-900 border-zinc-800'
            }`}
            style={{ right: '-0.5rem' }}
          >
            <div className="p-4 border-b border-[var(--border-color)]">
              <div className={`text-sm font-medium ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
                {session.user.name || 'User'}
              </div>
              <div className={`text-xs mt-1 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {session.user.email}
              </div>
            </div>
            <div className="p-2">
              <Button
                variant="danger"
                size="sm"
                onClick={handleLogout}
                isLoading={isLoggingOut}
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

