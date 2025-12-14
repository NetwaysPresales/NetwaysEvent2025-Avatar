/**
 * Avatar Audio Management Hook
 * 
 * Handles audio element creation, playback, and mute/unmute logic
 */

'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

interface UseAvatarAudioOptions {
  onMuteStateChange?: (isMuted: boolean) => void;
}

export function useAvatarAudio({ onMuteStateChange }: UseAvatarAudioOptions = {}) {
  const containerId = 'avatarAudioContainer';
  const [isMuted, setIsMuted] = useState(false);

  const setupAudioElement = useCallback((element: HTMLAudioElement) => {
    if (!element) return;

    // Ensure container exists
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'hidden';
      document.body.appendChild(container);
    }

    // Remove old audio elements
    Array.from(container.children).forEach(child => {
      if (child.tagName === 'AUDIO') {
        container.removeChild(child);
      }
    });

    // Setup new audio element
    container.appendChild(element);
    element.muted = false;
    element.volume = 1.0;

    const playPromise = element.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        // Auto-mute if autoplay fails
        element.muted = true;
        element.play().catch(e => console.error('Muted play failed:', e));
        setIsMuted(true);
        onMuteStateChange?.(true);
      });
    }
  }, [onMuteStateChange]);

  const unmute = useCallback(() => {
    const container = document.getElementById(containerId);
    if (container) {
      Array.from(container.children).forEach(child => {
        if (child instanceof HTMLAudioElement) {
          child.muted = false;
          child.play().catch(e => console.warn('Unmute play failed:', e));
        }
      });
      setIsMuted(false);
      onMuteStateChange?.(false);
    }
  }, [onMuteStateChange]);

  const cleanup = useCallback(() => {
    const container = document.getElementById(containerId);
    if (container) {
      Array.from(container.children).forEach(child => {
        if (child.tagName === 'AUDIO') {
          container.removeChild(child);
        }
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    setupAudioElement,
    unmute,
    isMuted,
  };
}

