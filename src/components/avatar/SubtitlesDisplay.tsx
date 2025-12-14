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

  // Auto-scroll to bottom when subtitle changes
  useEffect(() => {
    if (!subtitle || !containerRef.current) return;

    const timer = setTimeout(() => {
      if (endRef.current) {
        endRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [subtitle]);

  if (!subtitle) return null;

  return (
    <div
      ref={containerRef}
      className={`absolute top-20 left-1/2 -translate-x-1/2 z-50 max-w-3xl w-[calc(100%-2rem)] max-h-32 overflow-y-auto scrollbar-hide theme-transition ${theme === 'light' ? 'bg-white/80' : 'bg-zinc-900/80'} backdrop-blur-md rounded-2xl px-6 pt-4 pb-4 border ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'} ${className}`}
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

