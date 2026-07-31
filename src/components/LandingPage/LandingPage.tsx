/**
 * Landing Page Component
 * 
 * Main landing page with profile selection and start experience
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/useTheme';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { ProfileList } from '@/components/ProfileList';
import { SettingsModal } from '@/components/settings';
import { PageHeader } from '@/components/navigation';
import { CreateProfileModal } from './CreateProfileModal';
import type { Profile } from '@/types/profile';
import { useSession } from 'next-auth/react';

export const LandingPage: React.FC = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const {
    hydrated,
    currentProfile,
    loadProfile,
    profileState,
  } = useProfile();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Use theme directly from ProfileContext - single source of truth
  const theme = useTheme();

  const handleProfileSelect = async (profile: Profile) => {
    if (currentProfile?.id === profile.id) return;

    setIsLoading(true);
    try {
      await loadProfile(profile.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsClick = (profile: Profile) => {
    if (currentProfile?.id !== profile.id) {
      loadProfile(profile.id).then(() => setIsSettingsOpen(true));
    } else {
      setIsSettingsOpen(true);
    }
  };

  const handleStart = () => {
    if (!currentProfile || !hydrated) return;
    setIsStarting(true);
    sessionStorage.setItem('avatar-session-requested', 'true');
    router.push('/avatar');
  };

  const isLoadingProfile = profileState.type === 'loading' || isLoading;
  const hasProfile = currentProfile && hydrated;
  
  // Fetch authenticated logo URL - start fetching as soon as we have a profile ID and know it has a logo
  // This ensures we start fetching early, even before profile is fully hydrated
  const profileHasLogo = currentProfile?.logoBlobUrl ? true : false;
  const logoSrc = useAssetUrl(
    currentProfile?.id || null,
    'logo',
    !!currentProfile?.id && profileHasLogo
  );

  return (
    <div className={`fixed inset-0 h-screen w-full flex overflow-hidden theme-transition ${theme === 'light' ? 'bg-zinc-50' : 'bg-black'}`}>
      {/* Header with User Menu and Theme Toggle */}
      <PageHeader
        onSettingsClick={currentProfile?.userId === session?.userId ? () => setIsSettingsOpen(true) : undefined}
        showHomeButton={false}
        showThemeToggle={true}
      />

      {/* Background Decor */}
      <div className={`absolute inset-0 opacity-20 pointer-events-none theme-transition ${theme === 'light' ? 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-200 to-transparent' : 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 to-transparent'}`} />

      {/* Left Sidebar */}
      <aside className={`relative z-30 w-96 h-full flex flex-col border-r backdrop-blur-xl theme-transition ${theme === 'light' ? 'bg-white/80 border-zinc-200 shadow-xl' : 'bg-zinc-900/80 border-zinc-800 shadow-2xl'}`}>
        {/* Sidebar Header */}
        <div className={`p-6 border-b theme-transition ${theme === 'light' ? 'border-zinc-100' : 'border-zinc-800'}`}>
          <h2 className={`text-xl font-light tracking-tight theme-transition ${theme === 'light' ? 'text-zinc-800' : 'text-zinc-100'}`}>
            Presets
          </h2>
          <p className={`text-xs mt-1 theme-transition ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>
            Select an avatar profile
          </p>
        </div>

        {/* Profile List */}
        <ProfileList
          onProfileSelect={handleProfileSelect}
          onSettingsClick={handleSettingsClick}
          currentUserId={session?.userId}
        />

        {/* Create New Button */}
        <div className={`p-4 border-t theme-transition ${theme === 'light' ? 'border-zinc-100' : 'border-zinc-800'}`}>
          <button
            onClick={() => setIsCreating(true)}
            className={`w-full py-4 px-4 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 transition-colors ${theme === 'light' ? 'border-zinc-200 hover:border-[var(--accent-primary-hover)] hover:bg-[var(--accent-primary-light)] text-zinc-500 hover:text-[var(--accent-primary-dark)]' : 'border-zinc-800 hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary-light)] text-zinc-500 hover:text-[var(--accent-primary)]'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-semibold text-sm uppercase tracking-wide">Create New Preset</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col items-center justify-center z-10 p-10">
        <AnimatePresence mode="wait">
          {isLoadingProfile ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center gap-4"
            >
              <div className={`w-12 h-12 border-4 rounded-full animate-spin theme-transition ${theme === 'light' ? 'border-zinc-200 border-t-[var(--accent-primary)]' : 'border-zinc-800 border-t-[var(--accent-primary)]'}`} />
              <p className={`text-sm font-medium tracking-widest uppercase theme-transition ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>Loading Preset</p>
            </motion.div>
          ) : hasProfile ? (
            <motion.div
              key={currentProfile.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-12"
            >
              {/* Logo */}
              {logoSrc && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.8, type: "spring" }}
                  className="relative w-64 h-32"
                >
                  {/* Use regular img tag for Azure Blob Storage SAS URLs - Next.js Image optimization doesn't work with SAS tokens */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoSrc}
                    alt="Company Logo"
                    className="w-full h-full object-contain drop-shadow-2xl"
                    onError={(e) => {
                      console.error('[LandingPage] Failed to load logo:', logoSrc);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </motion.div>
              )}

              {/* Title & Description */}
              <div className="text-center space-y-4">
                <h1 className={`text-5xl font-light tracking-tight theme-transition ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
                  {hydrated.appearance.appTitle}
                </h1>
                <p className={`text-lg font-light theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  {hydrated.appearance.appDescription}
                </p>
              </div>

              {/* Start Button */}
              <motion.button
                onClick={handleStart}
                disabled={isStarting}
                className={`group relative px-8 py-3 rounded-full text-lg font-medium shadow-lg theme-transition ${
                  isStarting 
                    ? `${theme === 'light' ? 'bg-zinc-300 text-zinc-600' : 'bg-zinc-700 text-zinc-300'} cursor-not-allowed opacity-90` 
                    : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-text)] hover:shadow-[var(--accent-primary)]/25'
                }`}
              >
                <span className={`relative z-10 flex items-center gap-2 ${isStarting ? 'text-base font-normal' : ''}`}>
                  {isStarting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-base font-normal">Starting...</span>
                    </>
                  ) : (
                    <>
                      Start Experience
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="no-profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-4"
            >
              <p className={`text-lg theme-transition ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                No profile selected. Please create or select a profile.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <CreateProfileModal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onProfileCreated={async (profile) => {
          // Close settings modal if open (it might be showing previous profile's data)
          setIsSettingsOpen(false);
          // Load the profile immediately to ensure profiles list is updated with correct metadata
          // This ensures the card shows the correct avatarConfig (character, style)
          await loadProfile(profile.id);
        }}
      />

      {/* Settings Modal */}
      {currentProfile && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
};

