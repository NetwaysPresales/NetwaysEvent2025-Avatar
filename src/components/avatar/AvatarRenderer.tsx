/**
 * Avatar Renderer Component
 * 
 * Handles avatar video rendering with WebGL green screen processing.
 * The green screen processing is managed by useGreenScreen hook.
 */

'use client';

import React, { forwardRef, useEffect } from 'react';
import { useGreenScreen } from '@/hooks/useGreenScreen';
import type { AvatarConfig } from '@/types/avatar';

interface AvatarRendererProps {
  avatarConfig: AvatarConfig;
  className?: string;
  expanded?: boolean;
}

export const AvatarRenderer = forwardRef<HTMLCanvasElement, AvatarRendererProps>(
  ({ avatarConfig, className = '', expanded = false }, ref) => {
    const { canvasRef, startProcessing, stopProcessing } = useGreenScreen(avatarConfig.avatarType);

    // Forward ref to canvas
    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(canvasRef.current);
        } else {
          ref.current = canvasRef.current;
        }
      }
    }, [ref, canvasRef]);

    // Start processing when video is ready
    useEffect(() => {
      const checkVideoReady = () => {
        const video = document.getElementById('avatar-video') as HTMLVideoElement;
        if (video && video.readyState >= 2) {
          startProcessing();
        }
      };

      // Check immediately
      checkVideoReady();

      // Also listen for video events
      const video = document.getElementById('avatar-video') as HTMLVideoElement;
      if (video) {
        video.addEventListener('loadeddata', checkVideoReady);
        return () => {
          video.removeEventListener('loadeddata', checkVideoReady);
        };
      }

      return () => {
        stopProcessing();
      };
    }, [startProcessing, stopProcessing]);

    if (avatarConfig.avatarType === 'photo') {
      return (
        <div className={`pointer-events-none absolute left-1/2 top-[40%] z-10 aspect-square w-[min(72vw,22rem,calc(100dvh-22rem))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-white/35 bg-black/10 shadow-[0_28px_90px_rgba(0,0,0,0.32),0_8px_28px_rgba(0,0,0,0.2)] backdrop-blur-sm md:top-1/2 ${expanded ? 'md:w-[min(58%,34rem,calc(100dvh-9rem))]' : 'md:w-[min(78%,30rem,calc(100dvh-11rem))]'}`}>
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 h-full w-full ${className}`}
            style={{ imageRendering: 'auto' as const }}
          />
          <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_0_rgba(255,255,255,0.42),inset_0_-2px_0_rgba(0,0,0,0.16)]" />
        </div>
      );
    }

    return (
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-10 h-full w-full ${className}`}
        style={{ imageRendering: 'auto' as const }}
      />
    );
  }
);

AvatarRenderer.displayName = 'AvatarRenderer';
