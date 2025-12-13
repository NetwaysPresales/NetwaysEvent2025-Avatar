'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAvatarSession } from '@/hooks/useAvatarSession';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { validateSpeechConfig, validateAzureOpenAIConfig } from '@/lib/config';
import { CompanyInfoCards } from '@/components/CompanyInfoCards';
import { AvatarBackground } from '@/components/AvatarBackground';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { useGreenScreen } from '@/hooks/useGreenScreen';
import { useAgent } from '@/hooks/useAgent';
import { useSettings } from '@/context/SettingsContext';

// Timing constants
const RECONNECT_TIMEOUT_MS = 3600000;
const COMPANY_INFO_SHOW_DELAY_MS = 300;
const COMPANY_INFO_HIDE_DELAY_MS = 2000;

// Helper to clean markdown for TTS
const cleanTextForTTS = (text: string) => {
    return text
        .replace(/[#*`_\[\]()-]/g, '') // Remove common markdown symbols
        .replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, '') // Remove emojis which sound bad in TTS
        .replace(/\s+/g, ' ')           // Collapse multiple spaces
        .trim();
};

export default function AvatarPage() {
    const router = useRouter();
    const {
        speechConfig, avatarConfig, ttsConfig, openAIConfig, sttConfig,
        theme, backgroundUrl, appTitle, logoUrl,
        currentProfile // Destructure currentProfile to check readiness
    } = useSettings();

    // Auto-scroll ref
    const subtitlesEndRef = useRef<HTMLDivElement>(null);
    const subtitlesContainerRef = useRef<HTMLDivElement>(null);

    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [avatarSessionStarted, setAvatarSessionStarted] = useState(false);
    const [isAvatarReady, setIsAvatarReady] = useState(false);

    // Audio Autoplay Handling
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const handleUnmute = useCallback(() => {
        const container = document.getElementById('avatarAudioContainer');
        if (container) {
            Array.from(container.children).forEach(child => {
                if (child instanceof HTMLAudioElement) {
                    child.muted = false;
                    child.play().catch(e => console.warn('Unmute play failed:', e));
                }
            });
            setIsAudioMuted(false);
        }
    }, []);



    const micRef = useRef<HTMLDivElement>(null);

    // Custom Hooks
    const {
        canvasRef,
        tmpCanvasRef,
        startProcessing,
        stopProcessing
    } = useGreenScreen();

    const {
        sendMessage,
        currentEntity,
        updateEntityState,
        currentEntityRef,
        isSpeakingAboutCompanyRef
    } = useAgent({ openAIConfig });

    const [showCompanyInfo, setShowCompanyInfo] = useState(false);
    const [isPortrait, setIsPortrait] = useState(false);

    useEffect(() => {
        const checkOrientation = () => {
            const portrait = window.matchMedia('(orientation: portrait)').matches;
            setIsPortrait(portrait);
        };
        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        return () => window.removeEventListener('resize', checkOrientation);
    }, []);

    // Avatar session
    const {
        state: avatarState,
        error: avatarError,
        startSession,
        stopSession,
        speak,
        touch
    } = useAvatarSession({
        speechConfig,
        avatarConfig,
        ttsConfig,
        autoReconnectMs: RECONNECT_TIMEOUT_MS,
        onVideoTrack: (element) => {
            if (element) {
                stopProcessing();

                console.log('[Avatar] New video track received');
                const oldVideo = document.getElementById('avatar-video');
                if (oldVideo) oldVideo.remove();

                element.id = 'avatar-video';
                element.style.display = 'none';
                element.muted = true;
                element.autoplay = true;
                element.playsInline = true;
                document.body.appendChild(element);

                if (!tmpCanvasRef.current) {
                    tmpCanvasRef.current = document.createElement('canvas');
                }

                element.addEventListener('loadeddata', () => {
                    element.play().catch(err => console.warn('Video play error:', err));
                    startProcessing();
                });
            }
        },
        onAudioTrack: (element) => {
            if (element) {
                const container = document.getElementById('avatarAudioContainer');
                if (container) {
                    Array.from(container.children).forEach(child => {
                        if (child.tagName === 'AUDIO') container.removeChild(child);
                    });

                    container.appendChild(element);

                    // Try playing unmuted first
                    element.muted = false;
                    element.volume = 1.0;

                    const playPromise = element.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            console.warn('Auto-play prevented (NotAllowedError). Falling back to muted.', error);
                            // Fallback: Mute and play
                            element.muted = true;
                            element.play().catch(e => console.error('Muted play failed:', e));
                            setIsAudioMuted(true);
                        });
                    }
                }
            }
        },
        onEvent: (event) => {
            if (event.event.eventType === 'EVENT_TYPE_TURN_START') {
                if (isSpeakingAboutCompanyRef.current && currentEntityRef.current) {
                    setTimeout(() => setShowCompanyInfo(true), COMPANY_INFO_SHOW_DELAY_MS);
                }
            } else if (event.event.eventType === 'EVENT_TYPE_SESSION_END' || event.event.eventType === 'EVENT_TYPE_SWITCH_TO_IDLE') {
                setCurrentSubtitle('');
                setTimeout(() => {
                    setShowCompanyInfo(false);
                    updateEntityState(null, false);
                }, COMPANY_INFO_HIDE_DELAY_MS);
            } else if (event.event.eventType === 'EVENT_TYPE_RECONNECTING') {
                console.log('[Avatar] Reconnecting...');
            }
        }
    });

    // Speech recognition
    const {
        isListening,
        isStarting,
        error: sttError,
        startListening,
        stopListening
    } = useSpeechRecognition({
        speechConfig,
        sttConfig,
        onRecognized: async (text) => {
            console.log('User said:', text);
            setIsRecording(false);
            setCurrentSubtitle(`You: ${text}`);

            const reply = await sendMessage(text);
            if (reply) {
                setCurrentSubtitle(`Avatar: ${reply}`);
                // Clean text before sending to TTS to avoid reading markdown symbols
                speak(cleanTextForTTS(reply));
            }
        },

    });

    const handleStartSession = useCallback(async () => {
        const speechError = validateSpeechConfig(speechConfig);
        const openAIError = validateAzureOpenAIConfig(openAIConfig);

        if (speechError) { setErrorMessage(speechError); return; }
        if (openAIError) { setErrorMessage(openAIError); return; }

        setErrorMessage(null);
        setAvatarSessionStarted(true);
        setIsAvatarReady(false);
        await startSession();
    }, [speechConfig, openAIConfig, startSession]);

    // Auto-start session on mount - STRICT RUN ONCE BUT WAIT FOR PROFILE
    const hasStartedRef = useRef(false);
    useEffect(() => {
        // Strict guard: never run if already blocked or started
        // Also wait for currentProfile to be loaded (not null)
        if (hasStartedRef.current || avatarSessionStarted) return;
        if (!currentProfile) {
            console.log('[AvatarPage] Waiting for profile to load...');
            return;
        }

        console.log('[AvatarPage] Auto-starting session with profile:', currentProfile.name);
        hasStartedRef.current = true;

        // Small delay to ensure clean mount
        const timer = setTimeout(() => {
            handleStartSession().catch(e => {
                console.error("Auto-start failed:", e);
                setErrorMessage("Auto-start failed. Please try manually.");
                setAvatarSessionStarted(false); // Valid to allow retry if needed
            });
        }, 500);

        return () => {
            clearTimeout(timer);
            // Reset ref on unmount so re-entry works
            hasStartedRef.current = false;
        };
    }, [currentProfile, handleStartSession, avatarSessionStarted]); // Depend on currentProfile


    // Mic interaction
    const handleMicPress = useCallback(() => {
        if (avatarState !== 'connected' && avatarState !== 'speaking') return;
        touch();
        if (!isListening && !isRecording && !isStarting) {
            setIsRecording(true);
            startListening();
        }
    }, [avatarState, touch, isListening, isRecording, isStarting, startListening]);

    const handleMicRelease = useCallback(() => {
        if (isListening && isRecording) {
            setIsRecording(false);
            stopListening();
        }
    }, [isListening, isRecording, stopListening]);

    // Key shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                handleMicPress();
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                handleMicRelease();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleMicPress, handleMicRelease]);

    // Connection states
    const isConnected = avatarState === 'connected' || avatarState === 'speaking';
    const isConnecting = avatarState === 'connecting';

    useEffect(() => {
        if (isConnected) setIsAvatarReady(true);
    }, [isConnected]);

    // Internal auto-scroll
    // Internal auto-scroll
    useEffect(() => {
        const container = subtitlesContainerRef.current;
        if (!container || !currentSubtitle) return;

        // Must explicitly reset to top first so user sees the start
        container.scrollTop = 0;

        // Check if content overflows
        if (container.scrollHeight > container.clientHeight) {
            let scrollFrameId: number;
            const timeoutId: NodeJS.Timeout = setTimeout(() => {
                // Target: ~3 words/second match
                // Assumption: ~10 words/line, ~24px line height -> ~3.3s/line -> ~7px/s
                // at 60fps: 7/60 ~= 0.12 pixels/frame
                const scrollSpeed = 0.12;
                let currentScroll = 0;
                const maxScroll = container.scrollHeight - container.clientHeight;

                const animateScroll = () => {
                    if (currentScroll < maxScroll) {
                        currentScroll += scrollSpeed;
                        container.scrollTop = currentScroll;
                        scrollFrameId = requestAnimationFrame(animateScroll);
                    }
                };

                scrollFrameId = requestAnimationFrame(animateScroll);
            }, 2000); // 2 second delay before scrolling starts

            return () => {
                clearTimeout(timeoutId);
                cancelAnimationFrame(scrollFrameId);
            };
        }
    }, [currentSubtitle]);

    return (
        <main className={`relative w-full h-screen overflow-hidden ${theme === 'light' ? 'bg-zinc-50' : 'bg-black'}`}>


            <AvatarBackground theme={theme} src={backgroundUrl} />
            <LoadingOverlay theme={theme} isVisible={isConnecting && !isAvatarReady} message="Connecting to Avatar..." />

            {/* Audio Blocked Toast */}
            <AnimatePresence>
                {isAudioMuted && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className="absolute top-24 left-1/2 z-50 flex items-center gap-3 px-6 py-3 rounded-full bg-red-500/90 text-white shadow-2xl backdrop-blur-md cursor-pointer hover:bg-red-600 transition-colors"
                        onClick={handleUnmute}
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                        <span className="font-medium text-sm whitespace-nowrap">Audio Muted. Click to Unmute</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* App Title (Top Right) */}
            <div className={`absolute top-6 right-6 z-50 pointer-events-none transition-opacity duration-1000 ${isAvatarReady ? 'opacity-100' : 'opacity-0'}`}>
                <div className={`${backgroundUrl ? `px-6 py-2 rounded-full backdrop-blur-md shadow-lg border ${theme === 'light' ? 'bg-white/90 border-white/50' : 'bg-black/60 border-white/10'}` : ''}`}>
                    <div className="flex flex-col items-center gap-1">
                        {logoUrl && (
                            <div className="relative w-32 h-12">
                                <Image
                                    src={logoUrl}
                                    alt="Logo"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                        )}
                        <h1 className={`text-lg font-light tracking-wide ${theme === 'light' ? 'text-zinc-800' : 'text-zinc-100'} ${!backgroundUrl && 'drop-shadow-md'}`}>
                            {appTitle}
                        </h1>
                    </div>
                </div>
            </div>

            {/* Back Button */}
            <div className="absolute top-6 left-6 z-50">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        stopSession();
                        // Reset state for clean re-entry
                        setAvatarSessionStarted(false);
                        setErrorMessage(null);
                        router.push('/');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md ${theme === 'light' ? 'bg-white/80 hover:bg-white text-zinc-600' : 'bg-black/50 hover:bg-black/70 text-zinc-400'} border ${theme === 'light' ? 'border-zinc-200' : 'border-white/10'} transition-all`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    <span className="text-sm font-medium">End Session</span>
                </motion.button>
            </div>



            {/* Error Display - Visible even if session not started so validation errors show */}
            {(errorMessage || avatarError) && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full px-4">
                    <div className="bg-red-500/90 backdrop-blur-md text-white rounded-lg p-4 shadow-xl flex items-center gap-3">
                        <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <p className="font-medium text-sm">{errorMessage || avatarError}</p>
                    </div>
                </div>
            )}

            {avatarSessionStarted && (
                <>
                    {/* Avatar Canvas */}
                    <div className={`relative w-full h-full flex items-end justify-center transition-opacity duration-1000 ${isAvatarReady ? 'opacity-100' : 'opacity-0'}`}>
                        <canvas
                            ref={canvasRef}
                            className="max-w-full max-h-full object-contain pointer-events-none"
                            style={{
                                width: '100%',
                                height: '100%',
                                marginBottom: isPortrait ? '-5vh' : '-2vh'
                            }}
                        />
                    </div>

                    <div id="avatarAudioContainer" className="hidden" />

                    <AnimatePresence>
                        {currentSubtitle && (
                            <div className="absolute top-24 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
                                <motion.div
                                    ref={subtitlesContainerRef}
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className={`max-w-2xl w-full text-center p-6 pr-2 rounded-2xl backdrop-blur-xl max-h-20 overflow-y-auto sleek-scrollbar pointer-events-auto shadow-2xl ${theme === 'light'
                                        ? 'bg-white/90 text-zinc-800 border-white/50'
                                        : 'bg-black/60 text-white border-white/10'
                                        } border`}
                                >
                                    <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none text-left inline-block w-full">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {currentSubtitle}
                                        </ReactMarkdown>
                                        <div ref={subtitlesEndRef} />
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {showCompanyInfo && currentEntity && (
                            <CompanyInfoCards theme={theme} entity={currentEntity} isVisible={true} />
                        )}
                    </AnimatePresence>

                    <div className={`absolute bottom-8 left-0 right-0 z-50 flex flex-col items-center gap-4 transition-all duration-500 transform ${isConnected ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
                        <div className={`px-4 py-1.5 rounded-full backdrop-blur-md border ${sttError ? 'bg-red-500/10 border-red-500/30 text-red-500' :
                            (isListening || isStarting) ? (theme === 'light' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400') :
                                (theme === 'light' ? 'bg-white/80 border-zinc-200 text-zinc-500' : 'bg-white/5 border-white/10 text-white/40')
                            }`}>
                            <span className="text-xs font-medium tracking-wide">
                                {sttError ? 'Microphone Error' : (isListening || isStarting) ? (isStarting ? 'Starting...' : 'Listening...') : 'Hold Spacebar to Speak'}
                            </span>
                        </div>

                        <div
                            ref={micRef}
                            className={`relative w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${(isListening || isStarting)
                                ? 'bg-red-500 scale-110 shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                                : (theme === 'light'
                                    ? 'bg-white hover:bg-zinc-50 border border-zinc-200 shadow-lg text-zinc-800'
                                    : 'bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-white')
                                }`}
                            onMouseDown={handleMicPress}
                            onMouseUp={handleMicRelease}
                            onMouseLeave={handleMicRelease}
                            onTouchStart={(e) => { e.preventDefault(); handleMicPress(); }}
                            onTouchEnd={(e) => { e.preventDefault(); handleMicRelease(); }}
                        >
                            {(isListening || isStarting) && (
                                <div className="absolute inset-0 rounded-full border-2 border-red-500 opacity-50 animate-ping" />
                            )}

                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        </div>
                    </div>

                </>
            )}

        </main>
    );
}
