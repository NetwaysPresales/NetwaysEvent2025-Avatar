/**
 * Settings Modal Component
 * 
 * Main settings modal with tabs, wrapping all settings components
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { AvatarSettings } from './AvatarSettings';
import { SpeechSettings } from './SpeechSettings';
import { TTSSettings } from './TTSSettings';
import { OpenAISettings } from './OpenAISettings';
import { AppearanceSettings } from './AppearanceSettings';
import { KnowledgeSettings } from './KnowledgeSettings';
import { EntitySettings } from './EntitySettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    hydrated,
    currentProfile,
    saveProfile,
    setAvatarConfig,
    setSpeechConfig,
    setTTSConfig,
    setOpenAIConfig,
    setAppTitle,
    setAppDescription,
    setLogoUrl,
    setBackgroundUrl,
    setLogoShowContainer,
    showSpeechApiKey,
    setShowSpeechApiKey,
    showOpenAIApiKey,
    setShowOpenAIApiKey,
  } = useProfile();

  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'settings' | 'appearance' | 'knowledge' | 'entities'>('settings');
  const [isSaving, setIsSaving] = useState(false);
  const [lastProfileId, setLastProfileId] = useState<string | null>(null);

  // Close modal if profile changes while it's open
  // This ensures settings always show the current profile's data
  useEffect(() => {
    if (isOpen && currentProfile) {
      if (lastProfileId && lastProfileId !== currentProfile.id) {
        // Profile changed while modal was open - close it to prevent showing wrong data
        onClose();
        setLastProfileId(null);
      } else {
        // Track the current profile ID
        setLastProfileId(currentProfile.id);
      }
    } else if (!isOpen) {
      // Reset when modal closes
      setLastProfileId(null);
    }
  }, [isOpen, currentProfile, lastProfileId, onClose]);

  if (!isOpen || !hydrated || !currentProfile || isSaving) return null;

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    // Close immediately to prevent content flash
    onClose();
    
    try {
      await saveProfile();
    } catch (error) {
      console.error('Failed to save settings', error);
      // Note: Modal is already closed, error handling would need a toast/notification
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm">
      <div className={`theme-transition ${theme === 'light' ? 'bg-white border-zinc-300' : 'bg-zinc-900 border-zinc-800'} border rounded-2xl shadow-2xl max-w-2xl w-full h-[700px] ring-1 ${theme === 'light' ? 'ring-zinc-200' : 'ring-white/10'} overflow-hidden flex flex-col`}>
        {/* Header with Tabs */}
        <div className={`sticky top-0 theme-transition ${theme === 'light' ? 'bg-white/95' : 'bg-zinc-900/95'} backdrop-blur-md border-b ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'} px-6 py-4 flex items-center justify-between z-10`}>
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('settings')}
              className={`relative text-xl font-light tracking-wide theme-transition transition-colors ${activeTab === 'settings' ? (theme === 'light' ? 'text-zinc-900' : 'text-zinc-100') : (theme === 'light' ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300')}`}
            >
              Settings
              {activeTab === 'settings' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[var(--accent-primary)]"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`relative text-xl font-light tracking-wide theme-transition transition-colors ${activeTab === 'appearance' ? (theme === 'light' ? 'text-zinc-900' : 'text-zinc-100') : (theme === 'light' ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300')}`}
            >
              Appearance
              {activeTab === 'appearance' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[var(--accent-primary)]"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`relative text-xl font-light tracking-wide theme-transition transition-colors ${activeTab === 'knowledge' ? (theme === 'light' ? 'text-zinc-900' : 'text-zinc-100') : (theme === 'light' ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300')}`}
            >
              Knowledge
              {activeTab === 'knowledge' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[var(--accent-primary)]"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('entities')}
              className={`relative text-xl font-light tracking-wide theme-transition transition-colors ${activeTab === 'entities' ? (theme === 'light' ? 'text-zinc-900' : 'text-zinc-100') : (theme === 'light' ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-zinc-300')}`}
            >
              Entities
              {activeTab === 'entities' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-[var(--accent-primary)]"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sleek-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                <AvatarSettings
                  config={hydrated.avatarConfig}
                  onChange={setAvatarConfig}
                />
                <SpeechSettings
                  config={hydrated.speechConfig}
                  onChange={setSpeechConfig}
                  showApiKey={showSpeechApiKey}
                  onToggleApiKey={() => setShowSpeechApiKey(!showSpeechApiKey)}
                />
                <TTSSettings
                  config={hydrated.ttsConfig}
                  onChange={setTTSConfig}
                />
                <OpenAISettings
                  config={hydrated.openaiConfig}
                  onChange={setOpenAIConfig}
                  showApiKey={showOpenAIApiKey}
                  onToggleApiKey={() => setShowOpenAIApiKey(!showOpenAIApiKey)}
                />
              </motion.div>
            )}

            {activeTab === 'appearance' && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <AppearanceSettings
                  appTitle={hydrated.appearance.appTitle}
                  appDescription={hydrated.appearance.appDescription}
                  logoUrl={hydrated.appearance.logoUrl}
                  backgroundUrl={hydrated.appearance.backgroundUrl}
                  logoShowContainer={hydrated.appearance.logoShowContainer}
                  onTitleChange={setAppTitle}
                  onDescriptionChange={setAppDescription}
                  onLogoChange={(url) => setLogoUrl(url)}
                  onBackgroundChange={(url) => setBackgroundUrl(url)}
                  onLogoShowContainerChange={setLogoShowContainer}
                  profileId={currentProfile.id}
                />
              </motion.div>
            )}

            {activeTab === 'knowledge' && (
              <motion.div
                key="knowledge"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <KnowledgeSettings
                  profileId={currentProfile.id}
                />
              </motion.div>
            )}

            {activeTab === 'entities' && (
              <motion.div
                key="entities"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <EntitySettings
                  profileId={currentProfile.id}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className={`p-6 border-t theme-transition ${theme === 'light' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/50 border-zinc-800'}`}>
          <Button
            variant="primary"
            onClick={handleSave}
            className="w-full"
          >
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
};

