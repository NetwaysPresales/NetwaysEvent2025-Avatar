'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useAvatarSession } from '@/hooks/useAvatarSession';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import {
  getDefaultSpeechConfig,
  getDefaultAvatarConfig,
  getDefaultTTSConfig,
  getDefaultAzureOpenAIConfig,
  validateSpeechConfig,
  validateAzureOpenAIConfig
} from '@/lib/config';
import type { AvatarConfig, SpeechConfig, TTSConfig, AzureOpenAIConfig, STTConfig, Entity } from '@/types/avatar';
import { CompanyInfoCards } from '@/components/CompanyInfoCards';
import { BackgroundPaths } from '@/components/BackgroundPaths';
import entities from '@/data/sca_entities.json';

// Simple overlay background without video (just the gradient)
const OverlayBackground = ({ theme = 'dark' }: { theme?: 'dark' | 'light' }) => (
  <div className="absolute inset-0 opacity-30 pointer-events-none">
    <div
      className="absolute inset-0"
      style={{
        background: theme === 'light'
          ? 'radial-gradient(ellipse at 50% 85%, #10b98144 0%, #10b98122 35%, #10b98111 70%, transparent 100%)'
          : 'radial-gradient(ellipse at 50% 85%, #19D6A722 0%, #10B98111 35%, #10B98105 70%, transparent 100%)',
      }}
    />
  </div>
);

// Timing constants
const RECONNECT_TIMEOUT_MS = 3600000; // 1 hour - max idle time before session expires permanently
const COMPANY_INFO_SHOW_DELAY_MS = 300; // Delay before showing company info after speech starts
const COMPANY_INFO_HIDE_DELAY_MS = 2000; // Keep company info visible after speech ends


// Note: Avatar sessions auto-reconnect on SESSION_END if last interaction was within the timeout window
// This keeps the session alive during active use, following Azure's official sample pattern

// Avatar rendering constants
const AVATAR_SCALE_FACTOR = 0.80; // Scale avatar to 80% of viewport height

export default function ChatAvatarPage() {
  const [speechConfig, setSpeechConfig] = useState<SpeechConfig>(getDefaultSpeechConfig());
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(getDefaultAvatarConfig());
  const [ttsConfig] = useState<TTSConfig>(getDefaultTTSConfig());
  const [openAIConfig, setOpenAIConfig] = useState<AzureOpenAIConfig>(getDefaultAzureOpenAIConfig());
  const [sttConfig] = useState<STTConfig>({
    locales: [
      'en-US',    // English (US)
      'ar-AE',    // Arabic (UAE) - Khaleeji/Gulf
      'ar-SA',    // Arabic (Saudi Arabia)
      'ar-EG',    // Arabic (Egypt)
      'zh-CN',    // Chinese (Mandarin)
      'ru-RU',    // Russian
      'hi-IN'     // Hindi (India)
    ],

    continuousConversation: false // Single utterance mode - stops after each recognition
  });

  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const [appTitle, setAppTitle] = useState('Netways avatar');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  const showSubtitles = true;
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  const [showSpeechApiKey, setShowSpeechApiKey] = useState(false);
  const [showOpenAIApiKey, setShowOpenAIApiKey] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tmpCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameDataRef = useRef<ImageData | null>(null);
  const lastCanvasSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [avatarSessionStarted, setAvatarSessionStarted] = useState(false);
  const [isAvatarReady, setIsAvatarReady] = useState(false);
  const micRef = useRef<HTMLDivElement>(null);

  // Company info display state
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  const [currentEntity, setCurrentEntity] = useState<Entity | null>(null);
  const currentEntityRef = useRef<Entity | null>(null);
  const isSpeakingAboutCompanyRef = useRef(false);

  // Orientation detection for true portrait mode
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      // Check actual orientation (not just width)
      const portrait = window.matchMedia('(orientation: portrait)').matches;
      setIsPortrait(portrait);
    };

    checkOrientation();

    // Listen for orientation changes
    const portraitQuery = window.matchMedia('(orientation: portrait)');
    const handleOrientationChange = () => checkOrientation();

    portraitQuery.addEventListener('change', handleOrientationChange);
    window.addEventListener('resize', checkOrientation);

    return () => {
      portraitQuery.removeEventListener('change', handleOrientationChange);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  // Green screen removal using HSV keying with feathering and spill suppression
  const makeBackgroundTransparent = () => {
    const video = document.getElementById('avatar-video') as HTMLVideoElement;
    const canvas = canvasRef.current;
    const tmpCanvas = tmpCanvasRef.current;

    if (!video || !canvas || !tmpCanvas || video.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(makeBackgroundTransparent);
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // Mark avatar as ready on first successful frame
    if (!isAvatarReady && vw > 0 && vh > 0) {
      setIsAvatarReady(true);
    }

    tmpCanvas.width = vw;
    tmpCanvas.height = vh;
    const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true })!;
    tmpCtx.drawImage(video, 0, 0, vw, vh);

    const frame = tmpCtx.getImageData(0, 0, vw, vh);
    const d = frame.data;

    // Detect background type from corner samples (green screen vs white)
    const sample = (x: number, y: number) => {
      const idx = (y * vw + x) * 4;
      return [d[idx] / 255, d[idx + 1] / 255, d[idx + 2] / 255] as [number, number, number];
    };
    const corners = [sample(5, 5), sample(vw - 6, 5), sample(5, vh - 6), sample(vw - 6, vh - 6)];
    const avg = corners.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map(v => v / 4) as [number, number, number];
    const maxC = Math.max(...avg);
    const minC = Math.min(...avg);
    const isGreenBg = avg[1] > avg[0] * 1.3 && avg[1] > avg[2] * 1.3; // green dominant
    const isWhiteBg = maxC > 0.95 && (maxC - minC) < 0.05; // high value, low saturation

    // HSV thresholds for green key (tuned to avoid teeth/skin removal)
    // Hue in degrees (0-360), we map from RGB per pixel
    const hueCenter = 120; // pure green
    const hueWidth = 40;   // +/- range around green
    const minS = 0.25;     // minimum saturation to be considered key color
    const minV = 0.15;     // minimum value (brightness)

    // Feathering parameters
    const feather = 0.12;  // smooth edge width

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255;
      const g = d[i + 1] / 255;
      const b = d[i + 2] / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;

      // Compute HSV
      let h = 0;
      if (delta > 0.00001) {
        if (max === g) h = 60 * ((b - r) / delta + 2);
        else if (max === b) h = 60 * ((r - g) / delta + 4);
        else h = 60 * (((g - b) / delta) % 6);
      }
      if (h < 0) h += 360;
      const s = max === 0 ? 0 : delta / max;
      const v = max;

      // Distance from green hue
      const hueDiff = Math.min(Math.abs(h - hueCenter), 360 - Math.abs(h - hueCenter));

      // Key strength: 1.0 means fully transparent, 0.0 fully opaque
      let key = 0;
      if (isGreenBg) {
        if (s >= minS && v >= minV && hueDiff <= hueWidth + hueWidth * feather) {
          // Soft step feathering
          const edgeStart = hueWidth * (1 - feather);
          if (hueDiff <= edgeStart) key = 1; // fully key out
          else {
            const t = (hueDiff - edgeStart) / (hueWidth * feather);
            // smoothstep
            key = t * t * (3 - 2 * t);
            key = 1 - key; // invert to go from 1->0 across feather
          }
        }
      } else if (isWhiteBg) {
        // Luma key for white: remove only very low-saturation high-value pixels (preserve teeth by requiring ultra-low saturation)
        const sat = s;
        if (v > 0.97 && sat < 0.05) {
          key = 1;
        } else if (v > 0.93 && sat < 0.06) {
          const t = (v - 0.93) / (0.97 - 0.93);
          key = Math.max(0, Math.min(1, t * (1 - sat / 0.06)));
        }
      }

      // Apply alpha based on key (preserve whites/teeth/eyes)
      const origA = d[i + 3] / 255;
      const outA = Math.max(0, Math.min(1, origA * (1 - key)));
      d[i + 3] = Math.round(outA * 255);

      // Simple spill suppression: reduce green in semi-keyed pixels
      if (key > 0 && key < 1) {
        const spillFactor = key * 0.6; // tune amount
        const newG = Math.max(0, g - spillFactor * (g - Math.max(r, b)));
        d[i] = Math.round(r * 255);
        d[i + 1] = Math.round(newG * 255);
        d[i + 2] = Math.round(b * 255);
      }
    }

    // Draw with cover-style scaling (crop sides, fill height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    // Match canvas to viewport for crisp scaling
    const cw = window.innerWidth;
    const ch = window.innerHeight;

    // Only resize canvas if dimensions changed (resizing clears canvas!)
    if (lastCanvasSizeRef.current.width !== cw || lastCanvasSizeRef.current.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      lastCanvasSizeRef.current = { width: cw, height: ch };
      console.log('[Avatar] Canvas resized to', cw, 'x', ch);
    }

    const videoAspect = vw / vh;
    const canvasAspect = cw / ch;

    let drawW, drawH, sx = 0, sw = vw;
    const sy = 0, sh = vh;

    // Use constant scale factor for avatar size
    const scaleFactor = AVATAR_SCALE_FACTOR;

    // Cover-style: fill the canvas, crop what doesn't fit
    if (videoAspect > canvasAspect) {
      // Video is wider than canvas - crop horizontal sides
      drawH = Math.round(ch * scaleFactor);
      drawW = Math.round(drawH * videoAspect);

      // If portrait mode (narrow), crop more aggressively from sides
      if (canvasAspect < 1) {
        // Calculate source crop to center on the avatar
        const targetW = vh * canvasAspect; // width we want from video
        sx = Math.max(0, (vw - targetW) / 2); // center crop
        sw = targetW;
        drawW = Math.round(cw * scaleFactor);
        drawH = Math.round(drawW / canvasAspect);
      }
    } else {
      // Video is taller than canvas - crop top/bottom
      drawW = Math.round(cw * scaleFactor);
      drawH = Math.round(drawW / videoAspect);
    }

    // Center horizontally, anchor to bottom
    const dx = Math.floor((cw - drawW) / 2);
    const dy = Math.max(0, ch - drawH);

    // Put processed frame into an offscreen canvas at native size, then scale draw
    const processed = new ImageData(new Uint8ClampedArray(d), vw, vh);
    const off = tmpCanvas; // reuse tmpCanvas to blit processed frame
    off.width = vw;
    off.height = vh;
    const offCtx = off.getContext('2d')!;
    offCtx.putImageData(processed, 0, 0);

    ctx.clearRect(0, 0, cw, ch);
    // Draw with source crop (sx, sy, sw, sh) and destination scaling (dx, dy, drawW, drawH)
    ctx.drawImage(off, sx, sy, sw, sh, dx, dy, drawW, drawH);

    // Save last frame for reconnection freeze
    try {
      lastFrameDataRef.current = ctx.getImageData(0, 0, cw, ch);
    } catch (err) {
      // Ignore errors (can happen if canvas is tainted)
      if (!lastFrameDataRef.current) {
        console.warn('[Avatar] Failed to capture last frame:', err);
      }
    }

    rafRef.current = requestAnimationFrame(makeBackgroundTransparent);
  };

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Avatar session
  const {
    state: avatarState,
    error: avatarError,
    startSession,
    speak,
    touch
  } = useAvatarSession({
    speechConfig,
    avatarConfig,
    ttsConfig,
    autoReconnectMs: RECONNECT_TIMEOUT_MS,
    onVideoTrack: (element) => {
      if (element) {

        // Stop old animation loop and freeze last frame
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }

        // meg.png is already displayed via onEvent handler before reconnection starts
        // Canvas will maintain the displayed image until new video starts
        console.log('[Avatar] New video track received, canvas showing meg.png');

        // Remove old video element if exists
        const oldVideo = document.getElementById('avatar-video');
        if (oldVideo) {
          oldVideo.remove();
        }

        // Setup new video element
        element.id = 'avatar-video';
        element.style.display = 'none';
        element.muted = true;
        element.autoplay = true;
        element.playsInline = true;
        document.body.appendChild(element);

        // Create temp canvas if needed
        if (!tmpCanvasRef.current) {
          tmpCanvasRef.current = document.createElement('canvas');
        }

        // Start background removal when video plays
        element.addEventListener('loadeddata', () => {
          element.play().catch(err => console.warn('Video play error:', err));
          // Canvas will smoothly transition from last frame to new video
          rafRef.current = requestAnimationFrame(makeBackgroundTransparent);
        });
      }
    },
    onAudioTrack: (element) => {
      if (element) {
        const container = document.getElementById('avatarAudioContainer');
        if (container) {
          Array.from(container.children).forEach(child => {
            if (child.tagName === 'AUDIO') {
              container.removeChild(child);
            }
          });
          element.muted = false;
          element.volume = 1.0;
          container.appendChild(element);

          // Ensure audio plays
          element.play().catch(err => {
            console.warn('Audio autoplay prevented:', err);
          });
        }
      }
    },
    onEvent: (event) => {
      if (event.event.eventType === 'EVENT_TYPE_TURN_START') {
        // Avatar started speaking - show company info if detected
        if (isSpeakingAboutCompanyRef.current && currentEntityRef.current) {
          setTimeout(() => {
            setShowCompanyInfo(true);
          }, COMPANY_INFO_SHOW_DELAY_MS);
        }
      } else if (event.event.eventType === 'EVENT_TYPE_SESSION_END' || event.event.eventType === 'EVENT_TYPE_SWITCH_TO_IDLE') {
        setCurrentSubtitle('');
        // Hide company info after speaking ends
        setTimeout(() => {
          setShowCompanyInfo(false);
          isSpeakingAboutCompanyRef.current = false;
        }, COMPANY_INFO_HIDE_DELAY_MS);
      } else if (event.event.eventType === 'EVENT_TYPE_RECONNECTING') {
        // Display meg.png right before reconnection
        console.log('[Avatar] Displaying meg.png for reconnection');
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Stop the animation frame first to prevent clearing
            if (rafRef.current) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
              console.log('[Avatar] Stopped animation frame for meg.png display');
            }

            const megImage = document.createElement('img');
            megImage.onload = () => {
              console.log('[Avatar] meg.png loaded successfully, dimensions:', megImage.width, 'x', megImage.height);
              console.log('[Avatar] Canvas dimensions:', canvas.width, 'x', canvas.height);
              // Draw image to fill canvas (cover style)
              ctx.drawImage(megImage, 0, 0, canvas.width, canvas.height);
              console.log('[Avatar] meg.png drawn to canvas');
            };
            megImage.onerror = (err) => {
              console.error('[Avatar] Failed to load meg.png:', err);
              console.warn('[Avatar] meg.png not found at /meg.png');
            };
            megImage.src = '/meg.png';
            console.log('[Avatar] Started loading meg.png from:', megImage.src);
          }
        }
      }
    }
  });

  // Speech recognition
  const {
    isListening,
    error: sttError,
    startListening,
    stopListening
  } = useSpeechRecognition({
    speechConfig,
    sttConfig,
    onRecognized: async (text) => {
      console.log('User said:', text);
      setIsRecording(false); // Reset recording state

      // Show the final recognized text
      setCurrentSubtitle(`You: ${text}`);

      await handleUserMessage(text);
    },
    onRecognizing: (text) => {
      console.log('Recognizing:', text);
      // Don't show real-time transcription, only show final result
    }
  });

  // Note: We use the /api/agent endpoint for LLM inference instead of direct Azure OpenAI calls

  // Don't auto-start - wait for user interaction to avoid autoplay errors

  const convoRef = useRef<string[]>([]);
  const processingRef = useRef(false); // Prevent duplicate processing
  const lastMessageRef = useRef(''); // Track last processed message

  const handleUserMessage = async (message: string) => {
    if (!message.trim()) return;

    // Prevent duplicate processing of the same message
    if (processingRef.current || lastMessageRef.current === message) {
      return;
    }

    processingRef.current = true;
    lastMessageRef.current = message;

    try {
      convoRef.current.push(message);
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: convoRef.current.slice(-12),
          systemPrompt: openAIConfig.systemPrompt
        })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('Agent HTTP error', res.status, txt);
        return;
      }
      const data = await res.json().catch(() => ({ reply: '', entityLicense: null }));
      const reply = String(data?.reply || '').trim();
      const entityLicense = data?.entityLicense || null;

      if (reply) {
        // If API returned an entity license, look it up and show cards
        if (entityLicense) {
          console.log('[UI] Looking for entity with license:', entityLicense);
          const found = entities.find((e) => String(e.license || '').toUpperCase() === entityLicense.toUpperCase());
          if (found) {
            console.log('[UI] Found entity:', found.name, 'License:', found.license);
            setCurrentEntity(found as Entity);
            currentEntityRef.current = found as Entity;
            isSpeakingAboutCompanyRef.current = true;
          } else {
            console.log('[UI] No entity found with license:', entityLicense);
          }
        } else {
          console.log('[UI] No entityLicense in response');
          setCurrentEntity(null);
          currentEntityRef.current = null;
          isSpeakingAboutCompanyRef.current = false;
        }

        convoRef.current.push(reply);

        // Show avatar's response as subtitle
        setCurrentSubtitle(`Avatar: ${reply}`);

        speak(reply);
        // Subtitle will be cleared automatically by EVENT_TYPE_SWITCH_TO_IDLE event handler
      }
    } catch (e) {
      console.error('Agent call failed', e);
    } finally {
      processingRef.current = false;
      // Clear the last message after a short delay to allow new messages
      setTimeout(() => {
        lastMessageRef.current = '';
      }, 1000);
    }
  };

  const handleStartSession = useCallback(async () => {
    const speechError = validateSpeechConfig(speechConfig);
    const openAIError = validateAzureOpenAIConfig(openAIConfig);

    if (speechError) {
      setErrorMessage(speechError);
      return;
    }
    if (openAIError) {
      setErrorMessage(openAIError);
      return;
    }

    setErrorMessage(null);
    setIsConfigExpanded(false);
    setAvatarSessionStarted(true);
    setIsAvatarReady(false); // Reset avatar ready state
    await startSession();
  }, [speechConfig, openAIConfig, startSession]);

  // Enter key support to start session
  useEffect(() => {
    if (avatarSessionStarted) return; // Only works when session not started

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.key === 'Enter') {
        e.preventDefault();
        handleStartSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [avatarSessionStarted, handleStartSession]);

  // Clear history is wired to the 'Clear History' button in UI; if unused, keep as inline utility
  // Removed unused clear history handler (can be re-added when UI button is present)

  const handleMicPress = useCallback(() => {
    if (avatarState !== 'connected' && avatarState !== 'speaking') {
      return; // Session not ready
    }

    // Update last interaction time to keep session alive
    touch();

    if (!isListening && !isRecording) {
      setIsRecording(true);
      startListening();
    }
  }, [avatarState, touch, isListening, isRecording, startListening]);

  const handleMicRelease = useCallback(() => {
    if (isListening && isRecording) {
      setIsRecording(false);
      stopListening();
    }
  }, [isListening, isRecording, stopListening]);

  // Determine connection status
  const isConnected = avatarState === 'connected' || avatarState === 'speaking';
  const isConnecting = avatarState === 'connecting';

  // Spacebar support - mimics mic button press/release exactly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        // Simulate mouse down on mic button
        handleMicPress();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        // Simulate mouse up on mic button
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

  // Show loading overlay only on initial connection (session started but not ready yet)
  const showLoadingOverlay = avatarSessionStarted && (isConnecting || (isConnected && !isAvatarReady)) && !isAvatarReady;
  // Show subtle reconnecting indicator when reconnecting (session started, was ready before, now connecting again)
  const showReconnectingIndicator = avatarSessionStarted && isConnecting && isAvatarReady;

  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: theme === 'light' ? '#F0FDF4' : '#0B1C26' }}>
      {/* Animated network background */}
      <BackgroundPaths theme={theme} />

      {/* Header and Logo - aligned on same level */}
      <div className={`absolute z-50 flex items-center justify-between ${isPortrait
        ? 'top-2 left-4 right-4'
        : 'top-4 left-8 right-8'
        }`}>
        <h1 className={`font-light tracking-tight ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'} ${isPortrait ? 'text-xl' : 'text-3xl'
          }`}>
          {appTitle}
        </h1>

        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`p-2 ${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-white hover:bg-white/5'} transition-colors rounded-full`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
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

          <Image
            src={logoUrl}
            alt="Logo"
            width={isPortrait ? 160 : 200}
            height={isPortrait ? 47 : 58}
            className="drop-shadow-2xl opacity-95"
            style={{ height: 'auto' }}
            priority
            onError={() => setLogoUrl('/logo.png')}
          />
        </div>
      </div>


      {/* Reconnecting Indicator - subtle, non-intrusive */}
      <AnimatePresence>
        {showReconnectingIndicator && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-full"
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-emerald-400 text-sm font-light">Reconnecting...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Alert */}
      {
        (errorMessage || avatarError || sttError) && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
            <div className="bg-red-500/90 backdrop-blur-md text-white rounded-lg p-4 shadow-2xl">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="font-semibold">Error</h3>
                  <p className="text-sm mt-1 opacity-90">{errorMessage || avatarError || sttError}</p>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Configuration Panel (Collapsible) */}
      {isConfigExpanded && (
        <div className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`${theme === 'light' ? 'bg-white border-zinc-300' : 'bg-zinc-900 border-zinc-800'} border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] ring-1 ${theme === 'light' ? 'ring-zinc-200' : 'ring-white/10'} overflow-hidden flex flex-col`}>
            <div className={`sticky top-0 ${theme === 'light' ? 'bg-white/95' : 'bg-zinc-900/95'} backdrop-blur-md border-b ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'} px-6 py-4 flex items-center justify-between z-10`}>
              <h2 className={`text-xl font-light ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'} tracking-wide`}>Settings</h2>
              <button
                onClick={() => setIsConfigExpanded(false)}
                className={`${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-white hover:bg-white/5'} transition-colors p-2 rounded-full`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: theme === 'light' ? '#d4d4d8 #f4f4f5' : '#52525b #27272a'
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar, textarea::-webkit-scrollbar {
                  width: 8px;
                }
                div::-webkit-scrollbar-track, textarea::-webkit-scrollbar-track {
                  background: ${theme === 'light' ? '#f4f4f5' : '#27272a'};
                }
                div::-webkit-scrollbar-thumb, textarea::-webkit-scrollbar-thumb {
                  background: ${theme === 'light' ? '#d4d4d8' : '#52525b'};
                  border-radius: 4px;
                }
                div::-webkit-scrollbar-thumb:hover, textarea::-webkit-scrollbar-thumb:hover {
                  background: ${theme === 'light' ? '#a1a1aa' : '#71717a'};
                }
              `}</style>

              <div className="p-6">
                <div className="space-y-8">
                  {/* Avatar Settings */}
                  <div>
                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Avatar Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Character</label>
                        <input
                          type="text"
                          value={avatarConfig.character}
                          onChange={(e) => setAvatarConfig({ ...avatarConfig, character: e.target.value })}
                          disabled={isConnected}
                          className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Style</label>
                        <input
                          type="text"
                          value={avatarConfig.style}
                          onChange={(e) => setAvatarConfig({ ...avatarConfig, style: e.target.value })}
                          disabled={isConnected}
                          className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>App Title</label>
                        <input
                          type="text"
                          value={appTitle}
                          onChange={(e) => setAppTitle(e.target.value)}
                          className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>App Icon</label>
                        <div className={`flex items-center gap-4 p-4 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300' : 'bg-zinc-950 border-zinc-800'} border rounded-lg`}>
                          <div className={`relative w-16 h-16 ${theme === 'light' ? 'bg-zinc-100 border-zinc-300' : 'bg-zinc-900 border-zinc-800'} rounded-lg border flex items-center justify-center overflow-hidden shrink-0`}>
                            <Image
                              src={logoUrl}
                              alt="Icon Preview"
                              fill
                              className="object-contain p-2"
                              onError={() => setLogoUrl('/logo.png')}
                            />
                          </div>
                          <div className="flex-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (e) => {
                                    if (e.target?.result) {
                                      setLogoUrl(e.target.result as string);
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className={`block w-full text-sm ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-400'}
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-full file:border-0
                              file:text-xs file:font-semibold
                              file:bg-emerald-500/10 file:text-emerald-500
                              hover:file:bg-emerald-500/20
                              cursor-pointer file:cursor-pointer`}
                            />
                            <p className={`text-xs ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'} mt-1 font-light`}>
                              Recommended: PNG or SVG with transparent background
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Azure Speech */}
                  <div>
                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Azure Speech</h3>
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Region</label>
                        <select
                          value={speechConfig.region}
                          onChange={(e) => setSpeechConfig({ ...speechConfig, region: e.target.value })}
                          disabled={isConnected}
                          className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed font-light`}
                        >
                          <option value="westeurope">West Europe</option>
                          <option value="eastus2">East US 2</option>
                          <option value="westus2">West US 2</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>API Key</label>
                        <div className="relative">
                          <input
                            type={showSpeechApiKey ? "text" : "password"}
                            value={speechConfig.apiKey}
                            onChange={(e) => setSpeechConfig({ ...speechConfig, apiKey: e.target.value })}
                            disabled={isConnected}
                            className={`w-full px-4 py-2.5 pr-10 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSpeechApiKey(!showSpeechApiKey)}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 ${theme === 'light' ? 'text-zinc-500 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-300'} transition-colors`}
                          >
                            {showSpeechApiKey ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Azure OpenAI */}
                  <div>
                    <h3 className="text-sm font-medium text-emerald-500 uppercase tracking-wider mb-4">Azure OpenAI</h3>
                    <div className="space-y-4">
                      <div>
                        <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Endpoint</label>
                        <input
                          type="text"
                          value={openAIConfig.endpoint}
                          onChange={(e) => setOpenAIConfig({ ...openAIConfig, endpoint: e.target.value })}
                          disabled={isConnected}
                          placeholder="https://your-resource.openai.azure.com/"
                          className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>API Key</label>
                        <div className="relative">
                          <input
                            type={showOpenAIApiKey ? "text" : "password"}
                            value={openAIConfig.apiKey}
                            onChange={(e) => setOpenAIConfig({ ...openAIConfig, apiKey: e.target.value })}
                            disabled={isConnected}
                            className={`w-full px-4 py-2.5 pr-10 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowOpenAIApiKey(!showOpenAIApiKey)}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 ${theme === 'light' ? 'text-zinc-500 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-300'} transition-colors`}
                          >
                            {showOpenAIApiKey ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>Deployment</label>
                        <input
                          type="text"
                          value={openAIConfig.deploymentName}
                          onChange={(e) => setOpenAIConfig({ ...openAIConfig, deploymentName: e.target.value })}
                          disabled={isConnected}
                          placeholder="gpt-4o-mini"
                          className={`w-full px-4 py-2.5 ${theme === 'light' ? 'bg-zinc-50 border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-200'} border rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${theme === 'light' ? 'placeholder-zinc-400' : 'placeholder-zinc-700'} font-light`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-light ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} mb-1.5 uppercase tracking-wide`}>System Prompt</label>
                        <div className={`group rounded-lg overflow-hidden border ${theme === 'light' ? 'border-zinc-300 bg-zinc-50 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500/50' : 'border-zinc-800 bg-zinc-950 focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500/50'} transition-all`}>
                          <textarea
                            value={openAIConfig.systemPrompt}
                            onChange={(e) => setOpenAIConfig({ ...openAIConfig, systemPrompt: e.target.value })}
                            rows={10}
                            className={`w-full block px-4 py-2.5 bg-transparent border-0 focus:ring-0 outline-none transition-all font-mono text-xs leading-relaxed resize-y ${theme === 'light' ? 'text-zinc-800 placeholder-zinc-400' : 'text-zinc-300 placeholder-zinc-700'}`}
                            style={{
                              scrollbarWidth: 'thin',
                              scrollbarColor: theme === 'light' ? '#d4d4d8 #f4f4f5' : '#52525b #27272a'
                            }}
                            placeholder="You are a helpful assistant..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {!isConnected && (
                    <div className={`pt-6 border-t ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800/50'}`}>
                      <button
                        onClick={handleStartSession}
                        className={`w-full px-6 py-3.5 ${theme === 'light' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400'} text-white rounded-xl transition-all font-light tracking-wide shadow-lg shadow-emerald-500/20`}
                      >
                        Apply & Start Session
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Avatar Canvas Container - slide left on portrait to make room for cards */}
      <motion.div
        className="absolute inset-0 flex items-end justify-center z-0 pointer-events-none md:animate-slide"
        animate={{
          x: showCompanyInfo
            ? (isPortrait ? -120 : -400)
            : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 60,
          damping: 15,
        }}
      >
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain"
          style={{
            filter: 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.5))',
            imageRendering: 'crisp-edges'
          }}
        />
      </motion.div>

      {/* Company Info Cards (above mic, no scrollbar on portrait) */}
      {
        currentEntity && (
          <CompanyInfoCards
            entity={currentEntity}
            isVisible={showCompanyInfo}
            theme={theme}
          />
        )
      }

      {/* Audio container (hidden) */}
      <div id="avatarAudioContainer" className="hidden" />

      {/* Microphone Button - centered at bottom */}
      {
        isConnected && (
          <div ref={micRef} id="micHolder" className={`absolute left-0 right-0 z-50 flex flex-col items-center ${isPortrait ? 'bottom-4' : 'bottom-10'
            }`}>
            <button
              onMouseDown={handleMicPress}
              onMouseUp={handleMicRelease}
              onTouchStart={handleMicPress}
              onTouchEnd={handleMicRelease}
              className={`relative rounded-full flex items-center justify-center backdrop-blur-xl ${isPortrait ? 'w-16 h-16' : 'w-24 h-24'
                } ${isRecording ? 'scale-95' : ''}`}
              style={{
                backgroundColor: isRecording ? 'rgb(244, 244, 245)' : 'rgba(24, 24, 27, 0.8)',
                border: isRecording ? '2px solid rgb(212, 212, 216)' : '1px solid rgba(63, 63, 70, 0.6)',
                transition: 'all 0.15s ease-out',
              }}
              onMouseEnter={(e) => {
                if (!isRecording) {
                  e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.9)';
                  e.currentTarget.style.borderColor = 'rgba(82, 82, 91, 1)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isRecording) {
                  e.currentTarget.style.backgroundColor = 'rgba(24, 24, 27, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(63, 63, 70, 0.6)';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
              aria-label="Hold to speak"
            >
              {/* Subtle pulse when recording */}
              {isRecording && (
                <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-zinc-400" />
              )}
              {/* Spinning icon when reconnecting */}
              {isConnecting && (
                <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin" />
              )}
              {/* Inner icon */}
              <svg className={`relative ${isPortrait ? 'w-8 h-8' : 'w-10 h-10'
                } ${isRecording ? 'text-zinc-900' : 'text-zinc-200'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            {/* Instruction text */}
            <p className={`text-zinc-300 text-center mt-3 font-light tracking-wide ${isPortrait ? 'text-xs' : 'text-sm'
              }`}>
              {isConnecting ? 'Reconnecting...' : isRecording ? 'Listening...' : 'Hold to Speak (or Space)'}
            </p>
          </div>
        )
      }

      {/* Subtitles - aligned with company cards bottom */}
      <AnimatePresence>
        {showSubtitles && currentSubtitle && (
          <motion.div
            className={`absolute left-0 right-0 text-center z-60 ${isPortrait ? 'bottom-40' : 'bottom-60'
              }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className={`${theme === 'light' ? 'bg-white/80 border-zinc-300' : 'bg-zinc-950/80 border-zinc-800/50'} backdrop-blur-md border px-4 py-2 rounded-xl`}
              style={{
                width: isPortrait && showCompanyInfo ? '300px' : '600px',
                minHeight: '40px',
              }}
              animate={{
                marginLeft: isPortrait && showCompanyInfo ? '1rem' : 'auto',
                marginRight: isPortrait && showCompanyInfo ? '22rem' : 'auto',
              }}
              transition={{
                type: "spring",
                stiffness: 80,
                damping: 20,
              }}
            >
              <p className={`${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'} font-light tracking-wide break-words text-center ${isPortrait ? 'text-sm' : 'text-lg'
                }`}>
                {currentSubtitle}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Button Overlay - Required for user interaction */}
      <AnimatePresence mode="wait">
        {!avatarSessionStarted && (
          <motion.div
            key="start-overlay"
            className="absolute inset-0 flex flex-col items-center justify-center z-50"
            style={{ background: theme === 'light' ? '#F0FDF4' : '#0B1C26' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            {/* Mini background for startup */}
            <OverlayBackground theme={theme} />

            {/* Settings and Theme Toggle Buttons on Start Page */}
            <div className={`absolute z-50 flex items-center gap-2 ${isPortrait
              ? 'top-2 right-4'
              : 'top-4 right-8'
              }`}>
              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`p-2 ${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100' : 'text-white/50 hover:text-white hover:bg-white/10'} transition-colors rounded-full`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'light' ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>

              {/* Settings Button */}
              <button
                onClick={() => setIsConfigExpanded(true)}
                className={`p-2 ${theme === 'light' ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100' : 'text-white/50 hover:text-white hover:bg-white/10'} transition-colors rounded-full`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            {/* Content - relative positioning to appear above background */}
            <div className="relative z-10 flex flex-col items-center">
              {/* Logo - large and centered */}
              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0, ease: [0.22, 1, 0.36, 1] }}
                className="mb-8"
              >
                <Image
                  src="/logo.png"
                  alt="SCA Logo"
                  width={300}
                  height={88}
                  className="drop-shadow-2xl opacity-95"
                  style={{ height: 'auto' }}
                  priority
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="text-center mb-10"
              >
                <h1 className={`font-light ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'} mb-3 tracking-tight ${isPortrait ? 'text-4xl' : 'text-5xl'
                  }`}>
                  {appTitle}
                </h1>
                <p className={`${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'} font-light tracking-wide ${isPortrait ? 'text-base' : 'text-lg'
                  }`}>
                  Voice-powered regulatory information
                </p>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleStartSession}
                className={`group relative px-8 py-3.5 text-base font-light rounded-lg tracking-wide shadow-lg transition-all ${theme === 'light'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600'
                  : 'bg-zinc-900/90 hover:bg-zinc-800/90 text-zinc-100 border border-emerald-500/50 hover:border-emerald-500'
                  }`}
                style={{ willChange: 'transform, opacity' }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{
                  opacity: { duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] },
                  y: { duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] },
                  default: { duration: 0.15, ease: 'easeOut' }
                }}
              >
                <span className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                  Start Session
                </span>
              </motion.button>

              <motion.p
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className={`text-zinc-500 mt-8 max-w-md text-center font-light tracking-wide ${isPortrait ? 'text-xs' : 'text-sm'
                  }`}
              >
                Click or press Enter to activate voice assistant
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay - only show on initial connection, not on reconnect */}
      <AnimatePresence mode="wait">
        {showLoadingOverlay && (
          <motion.div
            key="loading-overlay"
            className="absolute inset-0 flex flex-col items-center justify-center z-50"
            style={{ background: theme === 'light' ? '#F0FDF4' : '#0B1C26' }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {/* Mini background for loading */}
            <OverlayBackground theme={theme} />

            {/* Content - relative positioning */}
            <div className="relative z-10 flex flex-col items-center">
              <div className={`w-16 h-16 border-2 ${theme === 'light' ? 'border-zinc-300 border-t-emerald-600' : 'border-zinc-700/60 border-t-emerald-500'} rounded-full animate-spin mb-6`}
                style={{ boxShadow: '0 0 30px rgba(16, 185, 129, 0.15)' }}></div>
              <p className={`${theme === 'light' ? 'text-zinc-900' : 'text-zinc-200'} text-lg font-light tracking-wide`}>
                {avatarState === 'connecting' ? 'Connecting...' : 'Loading avatar...'}
              </p>
              <p className={`${theme === 'light' ? 'text-zinc-600' : 'text-zinc-500'} mt-2 font-light ${isPortrait ? 'text-xs' : 'text-sm'
                }`}>
                {avatarState === 'connecting' ? 'Establishing connection' : 'Rendering video stream'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
}

