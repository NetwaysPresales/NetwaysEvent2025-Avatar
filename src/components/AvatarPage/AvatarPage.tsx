/**
 * Avatar Page Component
 * 
 * Main avatar interaction page - orchestrates avatar session, voice input, and rendering
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/useTheme';
import { useAvatarSession } from '@/hooks/useAvatarSession';
import { useAgent } from '@/hooks/useAgent';
import { useAvatarVideo } from '@/hooks/useAvatarVideo';
import { useAvatarAudio } from '@/hooks/useAvatarAudio';
import { validateSpeechConfig, validateAzureOpenAIConfig } from '@/lib/config';
import { cleanTextForTTS } from '@/lib/text-processing';
import { EntityInfoCards } from '@/components/EntityInfoCards';
import { AvatarBackground } from '@/components/AvatarBackground';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { SettingsModal } from '@/components/settings';
import { PageHeader } from '@/components/navigation';
import { VoiceInput, SubtitlesDisplay, AvatarRenderer } from '@/components/avatar';

const RECONNECT_TIMEOUT_MS = 3600000;
const COMPANY_INFO_SHOW_DELAY_MS = 300;
const COMPANY_INFO_HIDE_DELAY_MS = 2000;

export const AvatarPage: React.FC = () => {
  const router = useRouter();
  const { hydrated, currentProfile, profileState } = useProfile();
  const theme = useTheme();

  // Redirect if no profile loaded
  useEffect(() => {
    if (profileState.type === 'idle' || (profileState.type === 'loaded' && !hydrated)) {
      router.push('/');
    }
  }, [profileState, hydrated, router]);

  if (!hydrated || !currentProfile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-[var(--text-secondary)]">Loading profile...</p>
        </div>
      </div>
    );
  }

  const { speechConfig, avatarConfig, ttsConfig, openaiConfig, sttConfig } = hydrated;

  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avatarSessionStarted, setAvatarSessionStarted] = useState(false);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const currentEntityRef = useRef<any>(null);
  const isSpeakingAboutCompanyRef = useRef(false);

  // Audio management
  const { setupAudioElement, unmute, isMuted } = useAvatarAudio({
    onMuteStateChange: (muted) => {
      // Audio mute state is managed by the hook
    },
  });

  // Video management
  const { setupVideoElement } = useAvatarVideo({
    onVideoReady: (element) => {
      // Video is ready, green screen processing will start automatically
    },
  });

  // Agent
  const { sendMessage, currentEntity, updateEntityState } = useAgent({ openAIConfig: openaiConfig });

  // Avatar session
  const {
    state: avatarState,
    error: avatarError,
    startSession,
    speak,
    touch,
  } = useAvatarSession({
    speechConfig,
    avatarConfig,
    ttsConfig,
    autoReconnectMs: RECONNECT_TIMEOUT_MS,
    onVideoTrack: setupVideoElement,
    onAudioTrack: setupAudioElement,
    onEvent: (event) => {
      if (event.event.eventType === 'EVENT_TYPE_TURN_START') {
        if (isSpeakingAboutCompanyRef.current && currentEntityRef.current) {
          setTimeout(() => setShowCompanyInfo(true), COMPANY_INFO_SHOW_DELAY_MS);
        }
      } else if (
        event.event.eventType === 'EVENT_TYPE_SESSION_END' ||
        event.event.eventType === 'EVENT_TYPE_SWITCH_TO_IDLE'
      ) {
        setCurrentSubtitle('');
        setTimeout(() => {
          setShowCompanyInfo(false);
          updateEntityState(null, false);
        }, COMPANY_INFO_HIDE_DELAY_MS);
      }
    },
  });

  const handleVoiceRecognized = useCallback(
    async (text: string) => {
      setCurrentSubtitle(`You: ${text}`);
      const reply = await sendMessage(text);
      if (reply) {
        setCurrentSubtitle(`Avatar: ${reply}`);
        speak(cleanTextForTTS(reply));
      }
    },
    [sendMessage, speak]
  );

  const handleStartSession = useCallback(async () => {
    const speechError = validateSpeechConfig(speechConfig);
    const openAIError = validateAzureOpenAIConfig(openaiConfig);
    if (speechError) {
      setErrorMessage(speechError);
      return;
    }
    if (openAIError) {
      setErrorMessage(openAIError);
      return;
    }
    setErrorMessage(null);
    setAvatarSessionStarted(true);
    setIsAvatarReady(false);
    await startSession();
  }, [speechConfig, openaiConfig, startSession]);

  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (hasStartedRef.current || avatarSessionStarted) return;
    hasStartedRef.current = true;
    const timer = setTimeout(() => {
      handleStartSession().catch(e => {
        console.error('Auto-start failed:', e);
        setErrorMessage('Auto-start failed. Please try manually.');
        setAvatarSessionStarted(false);
      });
    }, 500);
    return () => {
      clearTimeout(timer);
      hasStartedRef.current = false;
    };
  }, [handleStartSession, avatarSessionStarted]);

  const isConnected = avatarState === 'connected' || avatarState === 'speaking';
  const isConnecting = avatarState === 'connecting';

  useEffect(() => {
    if (isConnected) setIsAvatarReady(true);
  }, [isConnected]);

  useEffect(() => {
    if (currentEntity) {
      currentEntityRef.current = currentEntity;
      isSpeakingAboutCompanyRef.current = true;
    } else {
      isSpeakingAboutCompanyRef.current = false;
    }
  }, [currentEntity]);

  useEffect(() => {
    if (avatarError) {
      setErrorMessage(avatarError);
    }
  }, [avatarError]);

  return (
    <main className={`relative h-screen w-full overflow-hidden ${theme === 'light' ? 'bg-zinc-50' : 'bg-black'}`}>
      <AvatarBackground backgroundUrl={hydrated.appearance.backgroundUrl} />

      <AvatarRenderer avatarConfig={avatarConfig} />

      <LoadingOverlay
        isVisible={isConnecting || !isAvatarReady}
        message={isConnecting ? 'Connecting to avatar...' : 'Initializing...'}
      />

      {isAvatarReady && (
        <>
          <PageHeader
            onSettingsClick={() => setIsSettingsOpen(true)}
            showHomeButton={true}
          />

          <SubtitlesDisplay subtitle={currentSubtitle} />

          <AnimatePresence>
            {currentEntity && showCompanyInfo && (
              <EntityInfoCards entity={currentEntity} isVisible={true} />
            )}
          </AnimatePresence>

          <VoiceInput
            speechConfig={speechConfig}
            sttConfig={sttConfig}
            isConnected={isConnected}
            onRecognized={handleVoiceRecognized}
            onError={(error) => setErrorMessage(error)}
          />

          {isMuted && (
            <div className="absolute top-20 right-4 z-50">
              <button
                onClick={unmute}
                className={`px-4 py-2 rounded-full ${
                  theme === 'light' ? 'bg-white/90 text-zinc-900' : 'bg-zinc-900/90 text-white'
                } backdrop-blur-md border ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'} shadow-lg`}
              >
                Click to Unmute Audio
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="absolute top-20 left-4 z-50 max-w-md">
              <div
                className={`p-4 rounded-lg ${
                  theme === 'light'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-red-900/50 border-red-800 text-red-200'
                } border backdrop-blur-md`}
              >
                <p className="text-sm">{errorMessage}</p>
              </div>
            </div>
          )}
        </>
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </main>
  );
};
