/**
 * Landing Page Component
 * 
 * Main landing page with profile selection and start experience
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/useTheme';
import { ProfileList } from '@/components/ProfileList';
import { SettingsModal } from '@/components/settings';
import { UserMenu } from '@/components/user';
import { CreateProfileModal } from './CreateProfileModal';
import type { Profile } from '@/types/profile';

export const LandingPage: React.FC = () => {
  const router = useRouter();
  const {
    hydrated,
    currentProfile,
    loadProfile,
    profileState,
    setTheme,
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
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 600));

    await Promise.all([
      loadProfile(profile.id),
      minLoadTime,
    ]);

    setIsLoading(false);
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
    router.push('/avatar');
  };

  const isLoadingProfile = profileState.type === 'loading' || isLoading;
  const hasProfile = currentProfile && hydrated;

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    // setTheme in ProfileContext already applies theme immediately for instant feedback
    // and saves to profile if one is loaded
    if (currentProfile && hydrated) {
      setTheme(newTheme);
    }
  };

  return (
    <div className={`relative h-screen w-full flex overflow-hidden transition-colors duration-500 ${theme === 'light' ? 'bg-zinc-50' : 'bg-black'}`}>
      {/* Header with User Menu and Theme Toggle */}
      <div 
        className={`absolute top-4 right-4 z-50 flex items-center gap-1 ${
          theme === 'light' ? 'bg-white/95' : 'bg-zinc-900/95'
        } backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-lg border ${
          theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'
        }`}
      >
        <button
          onClick={handleThemeToggle}
          type="button"
          className={`p-2 rounded-md transition-all duration-200 ${
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
        {currentProfile && (
          <button
            onClick={() => setIsSettingsOpen(true)}
            type="button"
            className={`p-2 rounded-md transition-all duration-200 ${
              theme === 'light' 
                ? 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900' 
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
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
        <UserMenu />
      </div>

      {/* Background Decor */}
      <div className={`absolute inset-0 opacity-20 pointer-events-none ${theme === 'light' ? 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-200 to-transparent' : 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 to-transparent'}`} />

      {/* Left Sidebar */}
      <aside className={`relative z-30 w-96 h-full flex flex-col border-r backdrop-blur-xl ${theme === 'light' ? 'bg-white/80 border-zinc-200 shadow-xl' : 'bg-zinc-900/80 border-zinc-800 shadow-2xl'}`}>
        {/* Sidebar Header */}
        <div className={`p-6 border-b ${theme === 'light' ? 'border-zinc-100' : 'border-zinc-800'}`}>
          <h2 className={`text-xl font-light tracking-tight ${theme === 'light' ? 'text-zinc-800' : 'text-zinc-100'}`}>
            Presets
          </h2>
          <p className={`text-xs mt-1 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>
            Select an avatar profile
          </p>
        </div>

        {/* Profile List */}
        <ProfileList
          onProfileSelect={handleProfileSelect}
          onSettingsClick={handleSettingsClick}
        />

        {/* Create New Button */}
        <div className={`p-4 border-t ${theme === 'light' ? 'border-zinc-100' : 'border-zinc-800'}`}>
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
              <div className={`w-12 h-12 border-4 rounded-full animate-spin ${theme === 'light' ? 'border-zinc-200 border-t-[var(--accent-primary)]' : 'border-zinc-800 border-t-[var(--accent-primary)]'}`} />
              <p className={`text-sm font-medium tracking-widest uppercase ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>Loading Preset</p>
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
              {hydrated.appearance.logoUrl && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.8, type: "spring" }}
                  className="relative w-64 h-32"
                >
                  <Image
                    src={hydrated.appearance.logoUrl}
                    alt="Company Logo"
                    fill
                    priority
                    className="object-contain drop-shadow-2xl"
                  />
                </motion.div>
              )}

              {/* Title & Description */}
              <div className="text-center space-y-4">
                <h1 className={`text-5xl font-light tracking-tight ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
                  {hydrated.appearance.appTitle}
                </h1>
                <p className={`text-lg font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  {hydrated.appearance.appDescription}
                </p>
              </div>

              {/* Start Button */}
              <motion.button
                onClick={handleStart}
                disabled={isStarting}
                className={`group relative px-8 py-3 rounded-full text-lg font-medium shadow-lg hover:shadow-[var(--accent-primary)]/25 transition-colors duration-300 ${isStarting ? 'bg-[var(--accent-primary-dark)] cursor-not-allowed opacity-90' : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-text)]'}`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {isStarting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Starting...
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
              <p className={`text-lg ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                No profile selected. Please create or select a profile.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <CreateProfileModal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onProfileCreated={(profile) => {
          loadProfile(profile.id);
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

