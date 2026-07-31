/**
 * Avatar Page Component
 * 
 * Main avatar interaction page - orchestrates avatar session, voice input, and rendering
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/context/ProfileContext';
import { useTheme } from '@/hooks/useTheme';
import { useAvatarSession } from '@/hooks/useAvatarSession';
import { useAgent } from '@/hooks/useAgent';
import { useAvatarVideo } from '@/hooks/useAvatarVideo';
import { useAvatarAudio } from '@/hooks/useAvatarAudio';
import { validateSpeechConfig, validateAzureOpenAIConfig, getDefaultAzureOpenAIConfig, getDefaultSpeechConfig, getDefaultAvatarConfig, getDefaultTTSConfig } from '@/lib/config';
import { cleanTextForTTS, speechPauseMs } from '@/lib/text-processing';
import { AvatarBackground } from '@/components/AvatarBackground';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { VoiceInput, ConversationPanel, AvatarRenderer, VisualWorkspace } from '@/components/avatar';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import type { SpeechRecognitionUpdate } from '@/hooks/useSpeechRecognition';
import type { ConversationMessage } from '@/types/conversation-ui';
import { findAvatarCharacter } from '@/lib/avatar-catalog';

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
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [interimMessage, setInterimMessage] = useState<ConversationMessage | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const [showEntityVisualization, setShowEntityVisualization] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [mobileWorkspace, setMobileWorkspace] = useState<'conversation' | 'visuals' | null>(null);

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
  const { sendMessage, abortAgent, resetConversation, currentEntityVisualization, currentDocumentVisualization, updateEntityVisualization } = useAgent({
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
    stopSpeaking,
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

  const handleInterrupt = useCallback(() => {
    // Instantly stop text generation from LLM
    if (abortAgent) {
      abortAgent();
    }
    // Instantly stop audio/video from Azure Avatar
    if (stopSpeaking) {
      stopSpeaking();
    }
    setMessages((current) => current.map((message) => (
      message.role === 'assistant' && message.status === 'streaming'
        ? { ...message, status: 'interrupted' }
        : message
    )));
  }, [abortAgent, stopSpeaking]);

  const handleVoiceRecognizing = useCallback((update: SpeechRecognitionUpdate) => {
    setInterimMessage({
      id: 'interim-user',
      role: 'user',
      content: update.text,
      status: 'interim',
      createdAt: update.recognizedAt,
      locale: update.locale,
      languageLabel: update.languageLabel,
      detectionConfidence: update.detectionConfidence,
    });
  }, []);

  const handleVoiceRecognized = useCallback(
    async (update: SpeechRecognitionUpdate) => {
      if (!sendMessage || !speak) return;
      setInterimMessage(null);
      const userMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: update.text,
        status: 'final',
        createdAt: update.recognizedAt,
        locale: update.locale,
        languageLabel: update.languageLabel,
        detectionConfidence: update.detectionConfidence,
      };
      setMessages((current) => [...current, userMessage]);
      let assistantMessageId = crypto.randomUUID();

      await sendMessage(
        {
          text: update.text,
          locale: update.locale,
          languageLabel: update.languageLabel,
        },
        {
          onStart: ({ messageId, createdAt }) => {
            assistantMessageId = messageId;
            setMessages((current) => [...current, {
              id: messageId,
              role: 'assistant',
              content: '',
              status: 'streaming',
              createdAt,
              locale: update.locale,
              languageLabel: update.languageLabel,
              retrievalStatus: 'none',
              sources: [],
            }]);
          },
          onToken: ({ messageId, content }) => {
            setMessages((current) => current.map((message) => (
              message.id === messageId ? { ...message, content, status: 'streaming' } : message
            )));
          },
          onSentence: (sentence) => {
            const spokenText = cleanTextForTTS(sentence);
            if (spokenText) {
              speak(spokenText, speechPauseMs(sentence));
            }
          },
          onRetrieval: (status, sources) => {
            setMessages((current) => current.map((message) => (
              message.id === assistantMessageId
                ? { ...message, retrievalStatus: status, ...(sources ? { sources } : {}) }
                : message
            )));
          },
          onDone: ({ messageId }) => {
            setMessages((current) => current.map((message) => (
              message.id === messageId ? { ...message, status: 'complete' } : message
            )));
          },
          onError: (error) => {
            setMessages((current) => current.map((message) => (
              message.id === assistantMessageId ? { ...message, status: 'error', content: message.content || error } : message
            )));
          },
        }
      );
    },
    [sendMessage, speak]
  );

  useEffect(() => {
    if (!currentProfile?.id) return;
    resetConversation();
    setMessages([]);
    setInterimMessage(null);
  }, [currentProfile?.id, resetConversation]);

  const [hasInitiatedAutoStart, setHasInitiatedAutoStart] = useState(false);

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
    setIsAvatarReady(false);

    await startSession();
  }, [hydrated, currentProfile, startSession]);

  useEffect(() => {
    if (!hydrated || !currentProfile || hasInitiatedAutoStart) return;

    const timer = setTimeout(() => {
      setHasInitiatedAutoStart(true);
      handleStartSession().catch(e => {
        console.error('Auto-start failed:', e);
        if (e instanceof Error && e.message.includes('4429')) {
          setErrorMessage('Azure is closing your previous session limit. Retrying in 3 seconds...');
          setTimeout(() => {
            setHasInitiatedAutoStart(false); // Retriggers this effect
          }, 3000);
        } else {
          setErrorMessage('Auto-start failed. Please try manually.');
        }
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [handleStartSession, hydrated, currentProfile, hasInitiatedAutoStart]);

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
    if (currentDocumentVisualization && hydrated?.appearance.showEvidencePanel !== false && window.matchMedia('(max-width: 767px)').matches) {
      setMobileWorkspace('visuals');
    }
  }, [currentDocumentVisualization, hydrated?.appearance.showEvidencePanel]);

  useEffect(() => {
    if (avatarError) {
      setErrorMessage(avatarError);
    }
  }, [avatarError]);

  useEffect(() => {
    if (!errorMessage || errorMessage.includes('try manually')) return;
    const timer = setTimeout(() => {
      setErrorMessage((current) => current === errorMessage ? null : current);
    }, 7000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

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
  const showEvidencePanel = hydrated.appearance.showEvidencePanel;

  return (
    <main className={`fixed inset-0 h-screen w-full overflow-hidden theme-transition ${theme === 'light' ? 'bg-zinc-50' : 'bg-black'}`}>
      <AvatarBackground
        backgroundUrl={hydrated.appearance.backgroundUrl}
        backgroundBlobUrl={currentProfile.backgroundBlobUrl}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/20" />

      <LoadingOverlay
        isVisible={isConnecting || !isAvatarReady || isClosing}
        message={isClosing ? 'Closing avatar session...' : isConnecting ? 'Connecting to avatar...' : 'Initializing...'}
        isClosing={isClosing}
      />

      {isAvatarReady && !isClosing && (
        <>
          {/* Reserved global header */}
          {logoSrc && (
            <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2">
              {hydrated?.appearance.logoShowContainer ? (
                <div className={`flex items-center justify-center rounded-2xl border px-6 py-2.5 backdrop-blur-md ${theme === 'light' ? 'border-zinc-300 bg-white/90' : 'border-zinc-700 bg-zinc-900/90'} shadow-lg`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoSrc}
                    alt={currentProfile?.name || 'Logo'}
                    className="h-8 w-auto object-contain md:h-9"
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
                    className="h-9 w-auto object-contain drop-shadow-lg md:h-10"
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
            className={`absolute right-4 top-4 z-50 flex items-center gap-2 rounded-full px-4 py-2 theme-transition md:right-[2.333333vw] ${theme === 'light' ? 'bg-white/90 text-zinc-900' : 'bg-zinc-900/90 text-zinc-100'
              } backdrop-blur-md shadow-lg border ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'
              } hover:shadow-xl transition-all duration-200`}
            title="End Session"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span className="text-sm font-medium">End Session</span>
          </button>

          {(currentProfile.id === '6402f32f-17b6-4ccc-9054-d45a610ec2f9' || currentProfile.name === 'Layla Avatar | Human Resources') && (
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-1 left-3 z-30 hidden text-[9px] text-white/65 drop-shadow-md hover:text-white md:block"
              title="Wadi Shawka photograph modified from work by Florian Kriechbaumer and Aristeas"
            >
              Wadi Shawka · Florian Kriechbaumer / Aristeas · CC BY-SA 4.0 · modified
            </a>
          )}

          <div className={`absolute inset-x-0 bottom-0 top-20 z-20 md:grid ${showEvidencePanel ? 'md:grid-cols-3' : 'md:grid-cols-[1fr_2fr]'}`}>
            <div className="hidden items-center justify-center md:flex">
              <ConversationPanel
                messages={messages}
                interimMessage={interimMessage}
                listening={isListening}
                speaking={avatarState === 'speaking'}
                profileName={currentProfile.name}
                assistantName={findAvatarCharacter(avatarConfig.character)?.label || 'Assistant'}
                mobileVisible={mobileWorkspace === 'conversation'}
              />
            </div>

            <div className="relative h-full min-h-0">
              <AvatarRenderer avatarConfig={avatarConfig} expanded={!showEvidencePanel} />
              <VoiceInput
                speechConfig={speechConfig}
                sttConfig={sttConfig}
                isConnected={isConnected}
                onRecognized={handleVoiceRecognized}
                onRecognizing={handleVoiceRecognizing}
                onListeningChange={setIsListening}
                onError={(error) => setErrorMessage(error)}
                onSpeechStart={handleInterrupt}
                className="absolute inset-x-0 bottom-16 md:bottom-5"
              />
            </div>

            {showEvidencePanel && <div className="hidden items-center justify-center md:flex">
              <VisualWorkspace
                entityVisualization={showEntityVisualization ? currentEntityVisualization : null}
                profileId={currentProfile.id}
                mobileVisible={mobileWorkspace === 'visuals'}
                documentVisualization={currentDocumentVisualization}
              />
            </div>}
          </div>

          <div className="md:hidden">
            <ConversationPanel
              messages={messages}
              interimMessage={interimMessage}
              listening={isListening}
              speaking={avatarState === 'speaking'}
              profileName={currentProfile.name}
              assistantName={findAvatarCharacter(avatarConfig.character)?.label || 'Assistant'}
              mobileVisible={mobileWorkspace === 'conversation'}
            />
            {showEvidencePanel && <VisualWorkspace
              entityVisualization={showEntityVisualization ? currentEntityVisualization : null}
              profileId={currentProfile.id}
              mobileVisible={mobileWorkspace === 'visuals'}
              documentVisualization={currentDocumentVisualization}
            />}
            <nav className={`fixed inset-x-2 bottom-0 z-50 grid h-12 overflow-hidden rounded-t-2xl border border-b-0 border-[var(--border-color)] bg-[var(--bg-primary)]/95 p-1 backdrop-blur-2xl ${showEvidencePanel ? 'grid-cols-2' : 'grid-cols-1'}`} aria-label="Mobile workspace">
              <button type="button" onClick={() => setMobileWorkspace((value) => value === 'conversation' ? null : 'conversation')} className={`rounded-xl text-xs font-medium ${mobileWorkspace === 'conversation' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}>Conversation</button>
              {showEvidencePanel && <button type="button" onClick={() => setMobileWorkspace((value) => value === 'visuals' ? null : 'visuals')} className={`rounded-xl text-xs font-medium ${mobileWorkspace === 'visuals' ? 'bg-[var(--accent-primary)] text-white' : 'text-[var(--text-secondary)]'}`}>Visuals</button>}
            </nav>
          </div>

          {isMuted && (
            <div className="absolute top-20 right-4 z-50">
              <button
                onClick={unmute}
                className={`px-4 py-2 rounded-full theme-transition ${theme === 'light' ? 'bg-white/90 text-zinc-900' : 'bg-zinc-900/90 text-white'
                  } backdrop-blur-md border ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'} shadow-lg`}
              >
                Click to Unmute Audio
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="absolute left-4 top-20 z-50 max-w-md md:left-[2.333333vw]">
              <div
                className={`p-4 rounded-lg theme-transition ${theme === 'light'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-red-900/50 border-red-800 text-red-200'
                  } border backdrop-blur-md`}
              >
                <p className="text-sm">{errorMessage}</p>
                {errorMessage.includes('try manually') && (
                  <button
                    onClick={() => {
                      setErrorMessage('Retrying connection...');
                      handleStartSession().catch(e => {
                        if (e instanceof Error && e.message.includes('4429')) {
                          setErrorMessage('Azure is closing your previous session limit. Retrying in 3 seconds...');
                          setTimeout(() => setHasInitiatedAutoStart(false), 3000);
                        } else {
                          setErrorMessage('Auto-start failed. Please try manually.');
                        }
                      });
                    }}
                    className="mt-3 px-4 py-2 bg-red-600/90 text-white rounded-md text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Retry Connection
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
};
