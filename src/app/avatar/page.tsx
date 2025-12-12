'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAvatarSession } from '@/hooks/useAvatarSession';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { validateSpeechConfig, validateAzureOpenAIConfig } from '@/lib/config';
import { CompanyInfoCards } from '@/components/CompanyInfoCards';
import { OverlayBackground } from '@/components/OverlayBackground';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { useGreenScreen } from '@/hooks/useGreenScreen';
import { useAgent } from '@/hooks/useAgent';
import { useSettings } from '@/context/SettingsContext';

// Timing constants
const RECONNECT_TIMEOUT_MS = 3600000;
const COMPANY_INFO_SHOW_DELAY_MS = 300;
const COMPANY_INFO_HIDE_DELAY_MS = 2000;

export default function AvatarPage() {
    const router = useRouter();
    const {
        speechConfig, avatarConfig, ttsConfig, openAIConfig, sttConfig,
        theme
    } = useSettings();

    const [currentSubtitle, setCurrentSubtitle] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [avatarSessionStarted, setAvatarSessionStarted] = useState(false);
    const [isAvatarReady, setIsAvatarReady] = useState(false);

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
                    element.muted = false;
                    element.volume = 1.0;
                    container.appendChild(element);
                    element.play().catch(err => console.warn('Audio autoplay prevented:', err));
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
                speak(reply);
            }
        },
        onRecognizing: () => {
        }
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

    // Auto-start session on mount
    useEffect(() => {
        handleStartSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

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

    return (
        <main className={`relative w-full h-screen overflow-hidden ${theme === 'light' ? 'bg-zinc-50' : 'bg-black'}`}>

            <OverlayBackground theme={theme} />
            <LoadingOverlay theme={theme} isVisible={isConnecting && !isAvatarReady} message="Connecting to Avatar..." />

            {/* Back Button */}
            <div className="absolute top-6 left-6 z-50">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                        stopSession();
                        router.push('/');
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md ${theme === 'light' ? 'bg-white/80 hover:bg-white text-zinc-600' : 'bg-black/50 hover:bg-black/70 text-zinc-400'} border ${theme === 'light' ? 'border-zinc-200' : 'border-white/10'} transition-all`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    <span className="text-sm font-medium">End Session</span>
                </motion.button>
            </div>

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
                                <div className={`max-w-2xl text-center p-4 rounded-xl backdrop-blur-md ${theme === 'light' ? 'bg-white/80 text-zinc-800 shadow-sm border border-zinc-200' : 'bg-black/50 text-white shadow-lg border border-white/10'}`}>
                                    <p className="text-lg font-light leading-relaxed">{currentSubtitle}</p>
                                </div>
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

                    {/* Error Display */}
                    {(errorMessage || avatarError) && (
                        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
                            <div className="bg-red-500/90 backdrop-blur-md text-white rounded-lg p-4 shadow-2xl">
                                <p>{errorMessage || avatarError}</p>
                            </div>
                        </div>
                    )}
                </>
            )}

        </main>
    );
}
