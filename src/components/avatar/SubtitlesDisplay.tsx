/**
 * Subtitles Display Component
 * 
 * Displays conversation subtitles with auto-scroll
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SubtitlesDisplayProps {
  subtitle: string;
  className?: string;
}

export const SubtitlesDisplay: React.FC<SubtitlesDisplayProps> = ({
  subtitle,
  className = '',
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when subtitle changes (very slow smooth scroll)
  useEffect(() => {
    if (!subtitle || !containerRef.current || !endRef.current) return;

    const timer = setTimeout(() => {
      const container = containerRef.current;
      const target = endRef.current;
      if (!container || !target) return;

      // Calculate scroll positions
      const startScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const scrollHeight = container.scrollHeight;
      
      // Only scroll if content extends beyond visible area
      if (scrollHeight <= containerHeight) {
        return; // No need to scroll, content fits
      }

      // Calculate target scroll position (scroll to bottom)
      const targetScrollTop = scrollHeight - containerHeight;
      const distance = targetScrollTop - startScrollTop;
      
      // Only scroll if there's a meaningful distance to scroll
      if (Math.abs(distance) < 5) {
        return; // Already at target or very close
      }

      // Fixed scroll rate in pixels per second
      const scrollRatePxPerSecond = 4;
      const duration = (Math.abs(distance) / scrollRatePxPerSecond) * 1000; // Convert to milliseconds
      const startTime = performance.now();

      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Linear interpolation for constant speed
        container.scrollTop = startScrollTop + (distance * progress);
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      };

      requestAnimationFrame(animateScroll);
    }, 100); // Slight delay to ensure DOM is updated

    return () => clearTimeout(timer);
  }, [subtitle]);

  if (!subtitle) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute top-20 left-1/2 -translate-x-1/2 z-50 max-w-3xl w-[calc(100%-2rem)] max-h-20 overflow-y-auto scrollbar-hide theme-transition ${theme === 'light' ? 'bg-white/80' : 'bg-zinc-900/80'} backdrop-blur-md rounded-2xl px-4 pt-3 pb-3 border ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'} ${className}`}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {subtitle}
        </ReactMarkdown>
      </div>
      <div ref={endRef} />
    </div>
  );
};

