'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSettings } from '@/context/SettingsContext';
import { SettingsPanel } from '@/components/SettingsPanel/SettingsPanel';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

export default function LandingPage() {
  const router = useRouter();
  const {
    profiles,
    loadProfile,
    refreshProfiles,
    createNewProfile,
    currentProfile,
    saveCurrentProfile,
    deleteProfile,
    // Configs for Settings Panel
    theme, setTheme,
    speechConfig, setSpeechConfig,
    avatarConfig, setAvatarConfig,
    openAIConfig, setOpenAIConfig,
    ttsConfig, setTTSConfig,
    appTitle, setAppTitle,
    appDescription, setAppDescription,
    logoUrl, setLogoUrl,
    backgroundUrl, setBackgroundUrl,
    showSpeechApiKey, setShowSpeechApiKey,
    showOpenAIApiKey, setShowOpenAIApiKey
  } = useSettings();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const handleProfileSelect = async (id: string) => {
    if (currentProfile?.id === id) return;

    setIsLoading(true);
    // Minimum loading time for visual smoothness (prevent flicker)
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 600));

    await Promise.all([
      loadProfile(id),
      minLoadTime
    ]);

    setIsLoading(false);
  };

  // Initial load
  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  const handleStart = () => {
    setIsStarting(true);
    router.push('/avatar');
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    await createNewProfile(newProfileName);
    setNewProfileName('');
    setIsCreating(false);
  };

  return (
    <div className={`relative h-screen w-full flex overflow-hidden transition-colors duration-500 ${theme === 'light' ? 'bg-zinc-50' : 'bg-black'}`}>

      {/* Background Decor (Global) */}
      <div className={`absolute inset-0 opacity-20 pointer-events-none ${theme === 'light' ? 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-200 to-transparent' : 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800 to-transparent'}`} />

      {/* LEFT SIDEBAR - FULL HEIGHT - WIDER */}
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4 sleek-scrollbar">
          {profiles.map(p => {
            // LOGO LOGIC: Directly use profile asset (Default profile now has logo.png physically)
            const logoSrc = p.logo
              ? `/api/profiles/${p.id}/assets?file=${p.logo}`
              : null;

            return (
              <div
                key={p.id}
                className={`group relative w-full p-3 rounded-3xl border transition-all duration-300 flex flex-col gap-3 ${currentProfile?.id === p.id
                  ? (theme === 'light' ? 'bg-zinc-50 border-emerald-500 shadow-lg scale-[1.02]' : 'bg-zinc-800 border-emerald-500 shadow-lg scale-[1.02]')
                  : (theme === 'light' ? 'bg-white border-zinc-100 hover:border-zinc-300 hover:shadow-md' : 'bg-black/20 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50')
                  }`}
              >
                {/* Clickable Area for Selection - Lower Z-Index */}
                <button
                  onClick={() => handleProfileSelect(p.id)}
                  className="absolute inset-0 z-0 rounded-3xl"
                  aria-label={`Select ${p.name}`}
                />

                {/* Icon/Logo Area - FULL WIDTH TOP */}
                <div className={`relative w-full h-32 rounded-2xl overflow-hidden border z-10 pointer-events-none ${theme === 'light' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-900 border-zinc-700'}`}>
                  {logoSrc ? (
                    <Image
                      src={logoSrc}
                      alt={p.name}
                      fill
                      priority // INSTANT LOAD
                      className="object-contain p-4"
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center text-4xl font-bold opacity-20 ${theme === 'light' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Footer Info & Actions */}
                <div className="flex items-center justify-between px-1 z-10 pointer-events-none gap-4">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-lg font-medium truncate ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
                        {p.name}
                      </h3>
                      {currentProfile?.id === p.id && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-500" title="Active"></span>
                      )}
                    </div>

                    <div className={`flex flex-wrap gap-2 text-xs font-medium opacity-60 ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      <span>{p.avatarConfig.character}</span>
                      <span>•</span>
                      <span className="truncate max-w-[120px] capitalize" title="Avatar Style">
                        {p.avatarConfig.style || 'Default'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 pointer-events-auto shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Load profile then open settings
                        if (currentProfile?.id !== p.id) {
                          loadProfile(p.id).then(() => setIsSettingsOpen(true));
                        } else {
                          setIsSettingsOpen(true);
                        }
                      }}
                      className={`p-2 rounded-full transition-colors cursor-pointer ${theme === 'light' ? 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'}`}
                      title="Modify Profile"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>

                    {profiles.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Are you sure you want to delete "${p.name}"?`)) {
                            deleteProfile(p.id);
                          }
                        }}
                        className={`p-2 rounded-full transition-colors cursor-pointer ${theme === 'light' ? 'text-zinc-400 hover:text-red-600 hover:bg-red-50' : 'text-zinc-500 hover:text-red-400 hover:bg-red-900/20'}`}
                        title="Delete Profile"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create New Button Footer */}
        <div className={`p-4 border-t ${theme === 'light' ? 'border-zinc-100' : 'border-zinc-800'}`}>
          <button
            onClick={() => setIsCreating(true)}
            className={`w-full py-4 px-4 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 transition-colors ${theme === 'light' ? 'border-zinc-200 hover:border-emerald-400 hover:bg-emerald-50 text-zinc-500 hover:text-emerald-700' : 'border-zinc-800 hover:border-emerald-500 hover:bg-emerald-900/20 text-zinc-500 hover:text-emerald-400'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="font-semibold text-sm uppercase tracking-wide">Create New Preset</span>
          </button>
        </div>

      </aside>


      {/* MAIN CONTENT CENTER */}
      <main className="flex-1 relative flex flex-col items-center justify-center z-10 p-10">

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center justify-center gap-4"
            >
              <div className={`w-12 h-12 border-4 rounded-full animate-spin ${theme === 'light' ? 'border-zinc-200 border-t-emerald-500' : 'border-zinc-800 border-t-emerald-500'}`} />
              <p className={`text-sm font-medium tracking-widest uppercase ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>Loading Preset</p>
            </motion.div>
          ) : (
            <motion.div
              key={currentProfile?.id || 'default'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-12"
            >
              {/* Logo - Uses context logoUrl which should match current profile */}
              {logoUrl ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.8, type: "spring" }}
                  className="relative w-64 h-32"
                >
                  <Image
                    src={logoUrl}
                    alt="Company Logo"
                    fill
                    priority
                    className="object-contain drop-shadow-2xl"
                  />
                </motion.div>
              ) : (
                /* Spacer or Default Placeholder if no logo */
                <div className="h-16"></div>
              )}

              {/* Title */}
              <div className="text-center space-y-3">
                <motion.h1
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className={`text-5xl md:text-7xl font-light tracking-tight ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}
                >
                  {appTitle || "Netways Event 2025"}
                </motion.h1>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className={`text-xl md:text-2xl font-light ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}
                >
                  {appDescription || "AI-Powered Virtual Assistant"}
                </motion.p>
              </div>

              {/* Start Button */}
              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ delay: 0.4, type: "tween", ease: "easeOut", duration: 0.5 }}
                onClick={handleStart}
                disabled={isStarting}
                className={`group relative px-8 py-3 rounded-full text-lg font-medium shadow-lg hover:shadow-emerald-500/25 transition-colors duration-300 ${isStarting ? 'bg-emerald-600 cursor-not-allowed opacity-90' : 'bg-emerald-500 hover:bg-emerald-400 text-white'}`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  {isStarting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Starting...
                    </>
                  ) : (
                    <>
                      Start Experience
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </>
                  )}
                </span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Header Actions - REMOVED SETTINGS, ONLY THEME */}
        <div className="absolute top-8 right-8 flex items-center gap-4 z-20">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className={`p-3 rounded-full transition-colors ${theme === 'light' ? 'bg-white text-zinc-600 hover:bg-zinc-100' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'} shadow-lg`}
          >
            {theme === 'light' ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            )}
          </button>
        </div>

      </main>

      {/* New Profile Modal */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <div className={`p-6 rounded-2xl w-full max-w-sm border ${theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}`}>
              <h3 className={`text-lg font-medium mb-4 ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>New Preset Name</h3>
              <input
                autoFocus
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="e.g. Sales Bot"
                className={`w-full px-4 py-3 rounded-xl mb-4 outline-none border focus:ring-2 focus:ring-emerald-500/50 ${theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-black border-zinc-800 text-white'}`}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsCreating(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${theme === 'light' ? 'text-zinc-500 hover:bg-zinc-100' : 'text-zinc-400 hover:bg-white/10'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProfile}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium"
                >
                  Create
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsPanel
        theme={theme}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isConnected={false}
        avatarConfig={avatarConfig} setAvatarConfig={setAvatarConfig}
        speechConfig={speechConfig} setSpeechConfig={setSpeechConfig}
        openAIConfig={openAIConfig} setOpenAIConfig={setOpenAIConfig}
        ttsConfig={ttsConfig} setTTSConfig={setTTSConfig}
        appTitle={appTitle} setAppTitle={setAppTitle}
        appDescription={appDescription} setAppDescription={setAppDescription}
        logoUrl={logoUrl} setLogoUrl={setLogoUrl}
        bgRefreshTrigger={0} refreshBackground={() => { }} // Keep props happy if removed from panel via direct update, or remove from panel Props entirely
        backgroundUrl={backgroundUrl} setBackgroundUrl={setBackgroundUrl}
        showSpeechApiKey={showSpeechApiKey} setShowSpeechApiKey={setShowSpeechApiKey}
        showOpenAIApiKey={showOpenAIApiKey} setShowOpenAIApiKey={setShowOpenAIApiKey}
        currentProfileId={currentProfile?.id}
        onSavePromise={saveCurrentProfile}
      />
    </div>
  );
}
