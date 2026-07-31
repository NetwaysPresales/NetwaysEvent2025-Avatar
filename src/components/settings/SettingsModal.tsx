'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { AvatarSettings } from './AvatarSettings';
import { TTSSettings } from './TTSSettings';
import { BehaviorSettings } from './BehaviorSettings';
import { APISettings } from './APISettings';
import { AppearanceSettings } from './AppearanceSettings';
import { KnowledgeSettings } from './KnowledgeSettings';
import { EntitySettings } from './EntitySettings';
import { AccessSettings } from './AccessSettings';
import { useSession } from 'next-auth/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'avatar' | 'voice' | 'behavior' | 'appearance' | 'knowledge' | 'entities' | 'api' | 'access';

const TABS: Array<{ id: SettingsTab; label: string; hint: string }> = [
  { id: 'avatar', label: 'Avatar', hint: 'Character and style' },
  { id: 'voice', label: 'Voice', hint: 'Speech and previews' },
  { id: 'behavior', label: 'Behavior', hint: 'Role and instructions' },
  { id: 'appearance', label: 'Appearance', hint: 'Brand and background' },
  { id: 'knowledge', label: 'Knowledge', hint: 'Indexed documents' },
  { id: 'entities', label: 'Entities', hint: 'Structured information' },
  { id: 'api', label: 'API', hint: 'Managed connections' },
  { id: 'access', label: 'Access', hint: 'Allowed accounts' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    hydrated,
    currentProfile,
    saveProfile,
    setAvatarConfig,
    setTTSConfig,
    setOpenAIConfig,
    setAppTitle,
    setProfileName,
    setAppDescription,
    setLogoUrl,
    setBackgroundUrl,
    setLogoShowContainer,
    setShowEvidencePanel,
  } = useProfile();
  const theme = useTheme();
  const { data: session } = useSession();
  const isAdmin = session?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<SettingsTab>('avatar');
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [lastProfileId, setLastProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentProfile) {
      if (lastProfileId && lastProfileId !== currentProfile.id) {
        onClose();
        setLastProfileId(null);
      } else {
        setLastProfileId(currentProfile.id);
      }
    } else if (!isOpen) {
      setLastProfileId(null);
    }
  }, [isOpen, currentProfile, lastProfileId, onClose]);

  useEffect(() => {
    if (isOpen) setIsClosing(false);
  }, [isOpen]);

  if (!isOpen || !hydrated || !currentProfile) return null;

  const handleClose = () => {
    if (isSaving || isClosing) return;
    setIsClosing(true);
    setTimeout(onClose, 160);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveProfile();
      setIsClosing(true);
      await new Promise((resolve) => setTimeout(resolve, 160));
      onClose();
    } catch (error) {
      console.error('Failed to save settings', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'avatar':
        return <AvatarSettings config={hydrated.avatarConfig} onChange={setAvatarConfig} />;
      case 'voice':
        return <TTSSettings config={hydrated.ttsConfig} onChange={setTTSConfig} />;
      case 'behavior':
        return <BehaviorSettings config={hydrated.openaiConfig} onChange={setOpenAIConfig} />;
      case 'appearance':
        return (
          <AppearanceSettings
            profileName={currentProfile.name}
            appTitle={hydrated.appearance.appTitle}
            appDescription={hydrated.appearance.appDescription}
            logoUrl={hydrated.appearance.logoUrl}
            backgroundUrl={hydrated.appearance.backgroundUrl}
            logoShowContainer={hydrated.appearance.logoShowContainer}
            showEvidencePanel={hydrated.appearance.showEvidencePanel}
            onTitleChange={setAppTitle}
            onProfileNameChange={setProfileName}
            onDescriptionChange={setAppDescription}
            onLogoChange={setLogoUrl}
            onBackgroundChange={setBackgroundUrl}
            onLogoShowContainerChange={setLogoShowContainer}
            onShowEvidencePanelChange={setShowEvidencePanel}
            profileId={currentProfile.id}
          />
        );
      case 'knowledge':
        return <KnowledgeSettings profileId={currentProfile.id} />;
      case 'entities':
        return <EntitySettings profileId={currentProfile.id} />;
      case 'api':
        return <APISettings />;
      case 'access':
        return isAdmin ? <AccessSettings /> : null;
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.16 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.99 }}
        animate={isClosing ? { opacity: 0, y: 6, scale: 0.99 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className={`flex h-[min(860px,94vh)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border shadow-2xl ring-1 ${
        theme === 'light'
          ? 'border-zinc-300 bg-white ring-zinc-200'
          : 'border-zinc-800 bg-zinc-900 ring-white/10'
      }`}
      >
        <header className={`flex items-center justify-between border-b px-5 py-4 sm:px-6 ${
          theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'
        }`}>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-medium text-[var(--text-primary)]">Preset Settings</h2>
            <p className="truncate text-xs text-[var(--text-tertiary)]">{currentProfile.name}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close settings"
            className={`rounded-lg p-2 transition-colors ${
              theme === 'light'
                ? 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <nav className={`flex shrink-0 gap-1 overflow-x-auto border-b p-2 md:w-48 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:p-3 ${
            theme === 'light' ? 'border-zinc-200 bg-zinc-50/70' : 'border-zinc-800 bg-zinc-950/25'
          }`}>
            {TABS.filter((tab) => tab.id !== 'access' || isAdmin).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-w-max rounded-lg px-3 py-2 text-left transition md:min-w-0 ${
                  activeTab === tab.id
                    ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <span className="block text-sm font-medium">{tab.label}</span>
                <span className={`hidden text-[10px] md:block ${activeTab === tab.id ? 'text-white/70' : 'text-[var(--text-tertiary)]'}`}>
                  {tab.hint}
                </span>
              </button>
            ))}
          </nav>

          <main className="min-h-0 flex-1 overflow-y-auto p-4 sleek-scrollbar sm:p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {renderTab()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <footer className={`flex items-center justify-between gap-3 border-t px-5 py-3 sm:px-6 ${
          theme === 'light' ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/80'
        }`}>
          <p className="hidden text-xs text-[var(--text-tertiary)] sm:block">
            Save to persist these changes to the preset.
          </p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={handleClose} disabled={isSaving || isClosing}>Close</Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving || isClosing} isLoading={isSaving}>Save Settings</Button>
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
};
