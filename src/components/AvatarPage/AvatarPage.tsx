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
import { validateSpeechConfig, validateAzureOpenAIConfig, getDefaultAzureOpenAIConfig, getDefaultSpeechConfig, getDefaultAvatarConfig, getDefaultTTSConfig } from '@/lib/config';
import { cleanTextForTTS } from '@/lib/text-processing';
import { EntityVisualization } from '@/components/entity';
import { AvatarBackground } from '@/components/AvatarBackground';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { VoiceInput, SubtitlesDisplay, AvatarRenderer } from '@/components/avatar';
import { useAssetUrl } from '@/hooks/useAssetUrl';

const RECONNECT_TIMEOUT_MS = 3600000;
const COMPANY_INFO_HIDE_DELAY_MS = 2000;

export const AvatarPage: React.FC = () => {
  const router = useRouter();
  const { hydrated, currentProfile, profileState } = useProfile();
  const theme = useTheme();
  
  // Fetch authenticated logo URL
  const profileHasLogo = currentProfile?.logoBlobUrl ? true : false;
  const logoSrc = useAssetUrl(
    currentProfile?.id || null,
    'logo',
    !!currentProfile?.id && profileHasLogo
  );

  // All hooks must be called before any early returns
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [avatarSessionStarted, setAvatarSessionStarted] = useState(false);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [showEntityVisualization, setShowEntityVisualization] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const currentEntityVisualizationRef = useRef<typeof currentEntityVisualization>(null);

  // Audio management - safe to call even if hydrated is null
  const { setupAudioElement, unmute, isMuted } = useAvatarAudio({
    onMuteStateChange: () => {
      // Audio mute state is managed by the hook
    },
  });

  // Video management - safe to call even if hydrated is null
  const { setupVideoElement } = useAvatarVideo({
    onVideoReady: () => {
      // Video is ready, green screen processing will start automatically
    },
  });

  // Agent - provide safe defaults
  const { sendMessage, currentEntityVisualization, updateEntityVisualization } = useAgent({ 
    openAIConfig: hydrated?.openaiConfig || getDefaultAzureOpenAIConfig(),
    profileId: currentProfile?.id || ''
  });

  // Avatar session - provide safe defaults
  const {
    state: avatarState,
    error: avatarError,
    startSession,
    stopSession,
    speak,
  } = useAvatarSession({
    speechConfig: hydrated?.speechConfig || getDefaultSpeechConfig(),
    avatarConfig: hydrated?.avatarConfig || getDefaultAvatarConfig(),
    ttsConfig: hydrated?.ttsConfig || getDefaultTTSConfig(),
    autoReconnectMs: RECONNECT_TIMEOUT_MS,
    onVideoTrack: setupVideoElement,
    onAudioTrack: setupAudioElement,
    onEvent: (event) => {
      if (
        event.event.eventType === 'EVENT_TYPE_SESSION_END' ||
        event.event.eventType === 'EVENT_TYPE_SWITCH_TO_IDLE'
      ) {
        setCurrentSubtitle('');
        setTimeout(() => {
          setShowEntityVisualization(false);
          updateEntityVisualization(null, false);
        }, COMPANY_INFO_HIDE_DELAY_MS);
      }
    },
  });

  // Redirect if no profile loaded
  useEffect(() => {
    if (profileState.type === 'idle' || (profileState.type === 'loaded' && !hydrated)) {
      router.push('/');
    }
  }, [profileState, hydrated, router]);

  const handleVoiceRecognized = useCallback(
    async (text: string) => {
      if (!sendMessage || !speak) return;
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
    if (!hydrated || !currentProfile) return;
    const { speechConfig, openaiConfig } = hydrated;
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
    
    // Preload knowledge files in background before starting session
    if (currentProfile?.id) {
      fetch(`/api/profiles/${currentProfile.id}/knowledge/preload`, {
        method: 'POST',
      }).catch((err) => {
        console.error('[AvatarPage] Failed to preload knowledge files:', err);
        // Don't block session start if preload fails
      });
    }
    
    await startSession();
  }, [hydrated, currentProfile, startSession]);

  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || !currentProfile || hasStartedRef.current || avatarSessionStarted) return;
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
  }, [handleStartSession, avatarSessionStarted, hydrated, currentProfile]);

  const isConnected = avatarState === 'connected' || avatarState === 'speaking';
  const isConnecting = avatarState === 'connecting';

  useEffect(() => {
    if (isConnected) setIsAvatarReady(true);
  }, [isConnected]);

  useEffect(() => {
    if (currentEntityVisualization) {
      currentEntityVisualizationRef.current = currentEntityVisualization;
      // Show visualization immediately when available (same time as subtitle)
      if (currentEntityVisualization.visualize) {
        setShowEntityVisualization(true);
      }
    } else {
      currentEntityVisualizationRef.current = null;
      setShowEntityVisualization(false);
    }
  }, [currentEntityVisualization]);

  useEffect(() => {
    if (avatarError) {
      setErrorMessage(avatarError);
    }
  }, [avatarError]);

  const handleHomeClick = useCallback(async () => {
    setIsClosing(true);
    try {
      // Stop the avatar session and clean up resources
      if (stopSession) {
        stopSession();
      }
      // Small delay to ensure cleanup completes and show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Error closing avatar session:', error);
    } finally {
      router.push('/');
    }
  }, [stopSession, router]);

  // Early return after all hooks
  if (!hydrated || !currentProfile) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-lg text-[var(--text-secondary)]">Loading profile...</p>
        </div>
      </div>
    );
  }

  const { speechConfig, avatarConfig, sttConfig } = hydrated;

  return (
    <main className={`fixed inset-0 h-screen w-full overflow-hidden theme-transition ${theme === 'light' ? 'bg-zinc-50' : 'bg-black'}`}>
      <AvatarBackground 
        backgroundUrl={hydrated.appearance.backgroundUrl} 
        backgroundBlobUrl={currentProfile.backgroundBlobUrl}
      />

      <AvatarRenderer avatarConfig={avatarConfig} />

      <LoadingOverlay
        isVisible={isConnecting || !isAvatarReady || isClosing}
        message={isClosing ? 'Closing avatar session...' : isConnecting ? 'Connecting to avatar...' : 'Initializing...'}
        isClosing={isClosing}
      />

      {isAvatarReady && !isClosing && (
        <>
          {/* Logo - Top Left */}
          {logoSrc && (
            <div className="absolute top-4 left-4 z-50">
              {hydrated?.appearance.logoShowContainer ? (
                <div className={`rounded-full backdrop-blur-md border-2 ${
                  theme === 'light' ? 'bg-white/90 border-zinc-300' : 'bg-zinc-900/90 border-zinc-700'
                } shadow-lg flex items-center justify-center px-5 py-3`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoSrc}
                    alt={currentProfile?.name || 'Logo'}
                    className="object-contain h-7 w-auto"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoSrc}
                    alt={currentProfile?.name || 'Logo'}
                    className="object-contain h-8 w-auto drop-shadow-lg"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* End Session Button - Top Right */}
          <button
            onClick={handleHomeClick}
            className={`absolute top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full theme-transition ${
              theme === 'light' ? 'bg-white/90 text-zinc-900' : 'bg-zinc-900/90 text-zinc-100'
            } backdrop-blur-md shadow-lg border ${
              theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'
            } hover:shadow-xl transition-all duration-200`}
            title="End Session"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span className="text-sm font-medium">End Session</span>
          </button>

          <SubtitlesDisplay subtitle={currentSubtitle} />

          <AnimatePresence>
            {currentEntityVisualization?.visualizationData && showEntityVisualization && (
              <EntityVisualization
                data={currentEntityVisualization.visualizationData}
                isVisible={showEntityVisualization}
              />
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
                className={`px-4 py-2 rounded-full theme-transition ${
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
                className={`p-4 rounded-lg theme-transition ${
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
    </main>
  );
};
