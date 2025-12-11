"use client";

import { useEffect, useRef } from 'react';

export function BackgroundPaths({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      // Set playback speed to 0.75x for smoother playback (less choppy than 0.5x)
      videoRef.current.playbackRate = 0.75;
    }
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Video background */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: theme === 'light' ? 0.3 : 0.6, // Reduce opacity in light mode
          transform: 'translateZ(0)', // Force hardware acceleration
          willChange: 'transform', // Optimize for animation
          backfaceVisibility: 'hidden', // Reduce flickering
          perspective: 1000, // Enable 3D transforms
          filter: theme === 'light' ? 'invert(1) hue-rotate(180deg)' : 'none', // Optional: invert video for light mode effect
        }}
      >
        <source src="/background.mp4" type="video/mp4" />
      </video>

      {/* Overlay to ensure avatar and text remain visible */}
      <div
        className="absolute inset-0"
        style={{
          background: theme === 'light'
            ? 'linear-gradient(to bottom, rgba(240, 253, 244, 0.85) 0%, rgba(255, 255, 255, 0.95) 100%)' // Light mode: Mint/White
            : 'linear-gradient(to bottom, rgba(11, 28, 38, 0.3) 0%, rgba(11, 28, 38, 0.5) 100%)', // Dark mode
        }}
      />
    </div>
  );
}
