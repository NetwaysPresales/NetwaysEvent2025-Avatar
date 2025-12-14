/**
 * Avatar Video Management Hook
 * 
 * Handles video element creation, DOM manipulation, and lifecycle
 */

'use client';

import { useRef, useCallback, useEffect } from 'react';

interface UseAvatarVideoOptions {
  onVideoReady?: (element: HTMLVideoElement) => void;
  onVideoError?: (error: Error) => void;
}

export function useAvatarVideo({ onVideoReady, onVideoError }: UseAvatarVideoOptions = {}) {
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const containerId = 'avatar-video-container';

  const setupVideoElement = useCallback((element: HTMLVideoElement) => {
    if (!element) return;

    // Remove old video if exists
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

    // Ensure container exists
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.display = 'none';
      document.body.appendChild(container);
    }

    container.appendChild(element);
    videoElementRef.current = element;

    // Wait for video to be ready
    const handleLoadedData = () => {
      element.play().catch(err => {
        console.warn('Video play error:', err);
        onVideoError?.(new Error(`Video play failed: ${err.message}`));
      });
      onVideoReady?.(element);
    };

    element.addEventListener('loadeddata', handleLoadedData, { once: true });
  }, [onVideoReady, onVideoError]);

  const cleanup = useCallback(() => {
    const video = document.getElementById('avatar-video');
    if (video) {
      video.remove();
    }
    const container = document.getElementById(containerId);
    if (container) {
      container.remove();
    }
    videoElementRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    setupVideoElement,
    cleanup,
    getVideoElement: () => document.getElementById('avatar-video') as HTMLVideoElement | null,
  };
}

