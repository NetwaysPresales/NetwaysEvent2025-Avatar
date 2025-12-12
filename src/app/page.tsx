'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackgroundPaths } from '@/components/BackgroundPaths';
import { StartScreen } from '@/components/StartScreen';
import { SettingsPanel } from '@/components/SettingsPanel';
import { useSettings } from '@/context/SettingsContext';

export default function LandingPage() {
  const router = useRouter();
  const {
    theme, setTheme,
    appTitle, setAppTitle,
    appDescription, setAppDescription,
    logoUrl, setLogoUrl,
    speechConfig, setSpeechConfig,
    avatarConfig, setAvatarConfig,
    openAIConfig, setOpenAIConfig,
    bgRefreshTrigger, refreshBackground,
    showSpeechApiKey, setShowSpeechApiKey,
    showOpenAIApiKey, setShowOpenAIApiKey
  } = useSettings();

  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  const handleStartSession = () => {
    router.push('/avatar');
  };

  return (
    <main className={`relative w-full h-screen overflow-hidden ${theme === 'light' ? 'bg-zinc-50' : 'bg-black'}`}>
      <BackgroundPaths theme={theme} />

      <StartScreen
        theme={theme}
        appTitle={appTitle}
        appDescription={appDescription}
        logoUrl={logoUrl}
        onStart={handleStartSession}
        onOpenSettings={() => setIsConfigExpanded(true)}
        onToggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
      />

      <SettingsPanel
        theme={theme}
        isOpen={isConfigExpanded}
        onClose={() => setIsConfigExpanded(false)}
        isConnected={false} // Always false on landing page
        avatarConfig={avatarConfig}
        setAvatarConfig={setAvatarConfig}
        speechConfig={speechConfig}
        setSpeechConfig={setSpeechConfig}
        openAIConfig={openAIConfig}
        setOpenAIConfig={setOpenAIConfig}
        appTitle={appTitle}
        setAppTitle={setAppTitle}
        appDescription={appDescription}
        setAppDescription={setAppDescription}
        logoUrl={logoUrl}
        setLogoUrl={setLogoUrl}
        bgRefreshTrigger={bgRefreshTrigger}
        refreshBackground={refreshBackground}
        showSpeechApiKey={showSpeechApiKey}
        setShowSpeechApiKey={setShowSpeechApiKey}
        showOpenAIApiKey={showOpenAIApiKey}
        setShowOpenAIApiKey={setShowOpenAIApiKey}
      />
    </main>
  );
}
