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
      className={`absolute bottom-24 left-0 right-0 z-40 max-h-32 overflow-y-auto px-4 sleek-scrollbar ${theme === 'light' ? 'bg-white/80' : 'bg-zinc-900/80'} backdrop-blur-md rounded-2xl mx-4 border ${theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'} ${className}`}
    >
      <div className="p-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none dark:prose-invert">
          {subtitle}
        </ReactMarkdown>
        <div ref={endRef} />
      </div>
    </div>
  );
};

