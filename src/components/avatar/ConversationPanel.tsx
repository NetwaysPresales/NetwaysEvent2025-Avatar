'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ConversationMessage } from '@/types/conversation-ui';
import { isRightToLeftLocale } from '@/lib/language-display';

interface ConversationPanelProps {
  messages: ConversationMessage[];
  interimMessage: ConversationMessage | null;
  listening: boolean;
  speaking: boolean;
  profileName: string;
  assistantName: string;
  mobileVisible: boolean;
}

function MessageCard({ message, assistantName }: { message: ConversationMessage; assistantName: string }) {
  const assistant = message.role === 'assistant';
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sourceFiles = (message.sources || []).filter((source, index, sources) => (
    sources.findIndex((candidate) => candidate.filename === source.filename) === index
  ));
  const sourcePages = [...new Set((message.sources || []).flatMap((source) => source.page ? [source.page] : []))];
  const pageSummary = sourcePages.length
    ? `p. ${sourcePages.slice(0, 3).join(', ')}${sourcePages.length > 3 ? ` +${sourcePages.length - 3}` : ''}`
    : '';
  return (
    <article className={`rounded-2xl border px-4 py-3 ${
      assistant
        ? 'border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/[0.07]'
        : 'border-[var(--border-color)] bg-[var(--bg-secondary)]/80'
    } ${message.status === 'interim' ? 'opacity-65' : ''}`}>
      <header className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
            assistant ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
          }`}>
            {assistant ? 'AI' : 'YOU'}
          </span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {assistant ? assistantName : 'You'}
          </span>
          {(message.status === 'streaming' || message.status === 'interim') && (
            <span className="flex gap-0.5" aria-label="Live">
              {[0, 1, 2].map((index) => (
                <span key={index} className="h-1 w-1 animate-pulse rounded-full bg-[var(--accent-primary)]" style={{ animationDelay: `${index * 120}ms` }} />
              ))}
            </span>
          )}
        </div>
        <time className="text-[10px] text-[var(--text-tertiary)]">{time}</time>
      </header>

      <div
        dir={isRightToLeftLocale(message.locale) ? 'rtl' : 'ltr'}
        className="prose prose-sm max-w-none text-[var(--text-primary)] dark:prose-invert prose-p:my-1 prose-ul:my-1"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => href === '#policy-citation' ? (
              <span className="not-prose mx-0.5 inline-flex items-center gap-1 rounded-md border border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/[0.08] px-1.5 py-0.5 align-baseline text-[0.78em] font-semibold leading-none text-[var(--accent-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M7 3h7l4 4v14H7V3Zm7 0v5h5" /></svg>
                {children}
              </span>
            ) : (
              <a href={href} target="_blank" rel="noreferrer">{children}</a>
            ),
          }}
        >
          {message.content || '...'}
        </ReactMarkdown>
      </div>

      <footer className="mt-3 flex flex-wrap items-center gap-1.5">
        {message.languageLabel && (
          <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)]/60 px-2 py-0.5 text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">
            {message.languageLabel} · {message.locale} · Auto-detected
          </span>
        )}
        {message.retrievalStatus === 'searching' && (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-amber-600">Consulting policy</span>
        )}
        {message.retrievalStatus === 'grounded' && (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-emerald-600">Policy grounded</span>
        )}
        {message.status === 'interrupted' && (
          <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-[var(--text-tertiary)]">Interrupted</span>
        )}
      </footer>

      {!!sourceFiles.length && (
        <div
          className="mt-2 flex min-w-0 items-center gap-1.5 border-t border-[var(--border-color)] pt-2 text-[10px] text-[var(--text-tertiary)]"
          title={(message.sources || []).map((source) => `${source.filename}${source.page ? `, page ${source.page}` : ''}`).join('\n')}
        >
          <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M7 3h7l4 4v14H7V3Zm7 0v5h5" /></svg>
          <span className="shrink-0 font-medium text-[var(--text-secondary)]">{sourceFiles.length} {sourceFiles.length === 1 ? 'source' : 'sources'}</span>
          <span className="truncate">{sourceFiles[0].filename}</span>
          {sourceFiles.length > 1 && <span className="shrink-0">+{sourceFiles.length - 1}</span>}
          {pageSummary && <span className="shrink-0 text-[var(--accent-primary)]">{pageSummary}</span>}
        </div>
      )}
    </article>
  );
}

export function ConversationPanel({ messages, interimMessage, listening, speaking, profileName, assistantName, mobileVisible }: ConversationPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(true);
  const scrollContainersRef = useRef<Array<HTMLDivElement | null>>([]);
  const allMessages = useMemo(
    () => interimMessage ? [...messages, interimMessage] : messages,
    [interimMessage, messages]
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollContainersRef.current.forEach((container) => {
        if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [allMessages]);

  const renderContent = (panelIndex: number) => (
    <>
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[var(--text-primary)]">Conversation</div>
          <div className="truncate text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{profileName} · Fresh session</div>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
          {listening && <span className="rounded-full bg-red-500/10 px-2 py-1 text-red-500">Listening</span>}
          {speaking && <span className="rounded-full bg-[var(--accent-primary)]/10 px-2 py-1 text-[var(--accent-primary)]">Speaking</span>}
        </div>
      </header>
      <div
        ref={(element) => { scrollContainersRef.current[panelIndex] = element; }}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sleek-scrollbar sm:p-4"
      >
        {allMessages.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16l-4 3v-4a7 7 0 1 1 4 1Z" /></svg>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">Hold the microphone and ask a policy question.</p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">Arabic and English are detected automatically.</p>
          </div>
        ) : allMessages.map((message) => <MessageCard key={message.id} message={message} assistantName={assistantName} />)}
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden h-[76dvh] w-[86%] flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border-color)] bg-[var(--bg-primary)]/88 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl md:flex">
        {renderContent(0)}
      </aside>
      <section className={`fixed inset-x-2 bottom-12 z-40 flex max-h-[52dvh] flex-col overflow-hidden rounded-t-3xl border border-b-0 border-[var(--border-color)] bg-[var(--bg-primary)]/94 shadow-[0_-18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition-transform md:hidden ${mobileVisible ? (mobileOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3.25rem)]') : 'translate-y-[110%]'}`}>
        <button type="button" onClick={() => setMobileOpen((value) => !value)} className="flex h-7 shrink-0 items-center justify-center" aria-label="Toggle conversation history">
          <span className="h-1 w-10 rounded-full bg-[var(--text-tertiary)]/35" />
        </button>
        {renderContent(1)}
      </section>
    </>
  );
}
