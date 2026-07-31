/**
 * Voice Input Component
 * 
 * Handles microphone input with visual feedback and keyboard shortcuts
 */

'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useSpeechRecognition, type SpeechRecognitionUpdate } from '@/hooks/useSpeechRecognition';
import type { SpeechConfig, STTConfig } from '@/types/avatar';

interface VoiceInputProps {
  speechConfig: SpeechConfig;
  sttConfig: STTConfig;
  isConnected: boolean;
  onRecognized: (update: SpeechRecognitionUpdate) => Promise<void>;
  onRecognizing?: (update: SpeechRecognitionUpdate) => void;
  onListeningChange?: (listening: boolean) => void;
  onError?: (error: string) => void;
  onSpeechStart?: () => void;
  className?: string;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  speechConfig,
  sttConfig,
  isConnected,
  onRecognized,
  onRecognizing,
  onListeningChange,
  onError,
  onSpeechStart,
  className = 'absolute bottom-8 left-0 right-0',
}) => {
  const theme = useTheme();
  const micRef = useRef<HTMLDivElement>(null);
  const pressActiveRef = useRef(false);

  const {
    isListening,
    isStarting,
    error: sttError,
    startListening,
    stopListening,
  } = useSpeechRecognition({
    speechConfig,
    sttConfig,
    onRecognized: async (update) => {
      await onRecognized(update);
    },
    onRecognizing,
    onListeningChange,
  });

  const handleMicPress = useCallback(() => {
    if (!isConnected) return;
    pressActiveRef.current = true;
    if (!isListening && !isStarting) {
      if (onSpeechStart) {
        onSpeechStart();
      }
      startListening();
    }
  }, [isConnected, isListening, isStarting, startListening, onSpeechStart]);

  const handleMicRelease = useCallback(() => {
    pressActiveRef.current = false;
    if (isListening) {
      stopListening();
    }
  }, [isListening, stopListening]);

  useEffect(() => {
    if (isListening && !pressActiveRef.current) stopListening();
  }, [isListening, stopListening]);

  // Keyboard shortcuts (Spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !e.repeat &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        handleMicPress();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
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
  }, [isConnected, isListening, isStarting, handleMicPress, handleMicRelease]);

  useEffect(() => {
    if (sttError) onError?.(sttError);
  }, [sttError, onError]);

  const error = sttError;

  return (
    <div className={`${className} z-50 flex flex-col items-center gap-6`}>
      {/* Status indicator */}
      <button
        type="button"
        className={`px-4 py-1.5 rounded-full backdrop-blur-md border ${error
            ? 'bg-red-500/10 border-red-500/30 text-red-500'
            : isListening || isStarting
              ? theme === 'light'
                ? 'bg-[var(--accent-primary-light)] border-[var(--accent-primary)]/30 text-[var(--accent-primary-dark)]'
                : 'bg-[var(--accent-primary-light)] border-[var(--accent-primary)]/30 text-[var(--accent-primary)]'
              : theme === 'light'
                ? 'bg-white/80 border-zinc-200 text-zinc-500'
                : 'bg-white/5 border-white/10 text-white/40'
          }`}
      >
        <span className="text-xs font-medium tracking-wide">
          {error
            ? 'Microphone Error'
            : isListening || isStarting
              ? isStarting
                ? 'Starting...'
                : 'Listening...'
              : 'Hold Spacebar to Speak'}
        </span>
      </button>

      {/* Microphone button */}
      <div
        ref={micRef}
        className={`relative isolate w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${isListening || isStarting
            ? 'bg-red-500 shadow-[0_0_24px_rgba(239,68,68,0.35)]'
            : theme === 'light'
              ? 'bg-white hover:bg-zinc-50 border border-zinc-200 shadow-lg text-zinc-800'
              : 'bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md text-white'
          }`}
        onMouseDown={handleMicPress}
        onMouseUp={handleMicRelease}
        onMouseLeave={handleMicRelease}
        onTouchStart={(e) => {
          e.preventDefault();
          handleMicPress();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleMicRelease();
        }}
      >
        {(isListening || isStarting) && (
          <div className="absolute inset-1 rounded-full border-2 border-white/55 animate-pulse" />
        )}
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      </div>
    </div>
  );
};

