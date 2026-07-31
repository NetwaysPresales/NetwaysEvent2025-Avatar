'use client';

import { useEffect, useRef, useState } from 'react';
import type { DocumentVisualization } from '@/types/document-visualization';

interface PdfDocumentViewerProps {
  visualization: DocumentVisualization;
}

export function PdfDocumentViewer({ visualization }: PdfDocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let pdfDocument: { destroy: () => Promise<void> } | null = null;

    async function renderPage() {
      setStatus('loading');
      setError('');
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
        const loadingTask = pdfjs.getDocument({ url: visualization.documentUrl, withCredentials: true });
        const pdf = await loadingTask.promise;
        pdfDocument = pdf;
        const page = await pdf.getPage(visualization.pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max((containerRef.current?.clientWidth || 420) - 24, 240);
        const scale = availableWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const highlightLayer = highlightRef.current;
        if (cancelled || !canvas || !highlightLayer) return;

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        highlightLayer.style.width = `${viewport.width}px`;
        highlightLayer.style.height = `${viewport.height}px`;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas rendering is unavailable');
        await page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        }).promise;

        const textContent = await page.getTextContent();
        const textItems = textContent.items.filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number } => 'str' in item);
        const normalizedItems = textItems.map((item) => item.str.replace(/\s+/g, ' ').trim());
        const ranges: Array<{ start: number; end: number }> = [];
        let cursor = 0;
        for (const text of normalizedItems) {
          ranges.push({ start: cursor, end: cursor + text.length });
          cursor += text.length + 1;
        }
        const pageText = normalizedItems.join(' ');
        const quote = visualization.quote.replace(/\s+/g, ' ').trim().slice(0, 420);
        let matchStart = pageText.indexOf(quote);
        let matchLength = quote.length;
        if (matchStart < 0) {
          const shorterQuote = quote.slice(0, 120);
          matchStart = pageText.indexOf(shorterQuote);
          matchLength = shorterQuote.length;
        }
        if (matchStart < 0) {
          const terms = (quote.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
            .filter((term) => term.length >= 5)
            .sort((left, right) => right.length - left.length);
          const fallbackIndex = normalizedItems.findIndex((text) => terms.some((term) => text.toLowerCase().includes(term)));
          if (fallbackIndex >= 0) {
            const firstIndex = Math.max(0, fallbackIndex - 2);
            const lastIndex = Math.min(ranges.length - 1, fallbackIndex + 6);
            matchStart = ranges[firstIndex].start;
            matchLength = ranges[lastIndex].end - matchStart;
          }
        }
        highlightLayer.replaceChildren();
        if (matchStart >= 0) {
          const matchEnd = matchStart + matchLength;
          let firstMark: HTMLSpanElement | null = null;
          textItems.forEach((item, index) => {
            if (ranges[index].end < matchStart || ranges[index].start > matchEnd || !normalizedItems[index]) return;
            const transform = pdfjs.Util.transform(viewport.transform, item.transform);
            const height = Math.max(Math.hypot(transform[2], transform[3]), 7);
            const mark = window.document.createElement('span');
            mark.className = 'absolute rounded-[2px] bg-yellow-300/65 ring-1 ring-amber-500/45 mix-blend-multiply';
            mark.style.left = `${transform[4]}px`;
            mark.style.top = `${transform[5] - height}px`;
            mark.style.width = `${Math.max(item.width * scale, 4)}px`;
            mark.style.height = `${height}px`;
            highlightLayer.appendChild(mark);
            firstMark ||= mark;
          });
          if (firstMark) {
            requestAnimationFrame(() => {
              const container = containerRef.current;
              if (!container) return;
              container.scrollTo({
                top: Math.max(firstMark!.offsetTop - container.clientHeight * 0.38, 0),
                behavior: 'smooth',
              });
            });
          }
        }
        page.cleanup();
        if (!cancelled) setStatus('ready');
      } catch (cause) {
        console.error('[Document Viewer] Render failed:', cause);
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'The page could not be rendered');
          setStatus('error');
        }
      }
    }

    renderPage();
    return () => {
      cancelled = true;
      pdfDocument?.destroy().catch(() => undefined);
    };
  }, [visualization]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border-color)]/65 bg-[var(--bg-primary)]/72 px-4 py-3 backdrop-blur-xl">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M7 3h7l4 4v14H7V3Zm7 0v5h5" /></svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{visualization.filename}</div>
          <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Temporary supporting evidence</div>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)]/70 px-2.5 py-1 text-[9px] font-semibold text-[var(--accent-primary)] shadow-sm">Page {visualization.pageNumber}</span>
      </div>
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto bg-[linear-gradient(145deg,rgba(228,228,231,0.76),rgba(244,244,245,0.5))] p-4 sleek-scrollbar dark:bg-[linear-gradient(145deg,rgba(24,24,27,0.8),rgba(9,9,11,0.65))]">
        {status === 'loading' && <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-[var(--bg-primary)]/60 text-xs text-[var(--text-secondary)] backdrop-blur-md"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent-primary)]/25 border-t-[var(--accent-primary)]" />Opening source page...</div>}
        {status === 'error' && <div className="flex min-h-48 items-center justify-center px-6 text-center text-xs text-red-500">{error}</div>}
        <div className={`relative mx-auto origin-top animate-[fadeIn_300ms_ease-out] overflow-hidden rounded-sm bg-white shadow-[0_18px_55px_rgba(0,0,0,0.18)] ${status === 'error' ? 'hidden' : ''}`}>
          <canvas ref={canvasRef} className="block max-w-none" />
          <div ref={highlightRef} className="pointer-events-none absolute inset-0" aria-label="Relevant passage highlighted" />
        </div>
      </div>
      <blockquote className="shrink-0 border-t border-[var(--border-color)]/65 bg-[var(--bg-primary)]/76 px-4 py-3 text-[10px] leading-[1.55] text-[var(--text-secondary)] backdrop-blur-xl">
        <span className="font-semibold text-[var(--accent-primary)]">Highlighted passage · </span>
        {visualization.quote.slice(0, 220)}{visualization.quote.length > 220 ? '...' : ''}
      </blockquote>
    </div>
  );
}
