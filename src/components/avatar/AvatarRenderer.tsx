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
}

export const AvatarRenderer = forwardRef<HTMLCanvasElement, AvatarRendererProps>(
  ({ avatarConfig, className = '' }, ref) => {
    const { canvasRef, startProcessing, stopProcessing } = useGreenScreen();

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

    return (
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-10 w-full h-full ${className}`}
        style={{ imageRendering: 'high-quality' }}
      />
    );
  }
);

AvatarRenderer.displayName = 'AvatarRenderer';
