'use client';

import { useEffect, useState } from 'react';
import type { EntityVisualizationResponse } from '@/types/entity-visualization';
import { EntityVisualization } from '@/components/entity';
import type { DocumentVisualization } from '@/types/document-visualization';
import { PdfDocumentViewer } from './PdfDocumentViewer';

type WorkspaceTab = 'sources' | 'entity';

interface AvailableSource {
  id: string;
  filename: string;
  indexed: boolean;
  chunkCount: number;
  pageCount: number | null;
  visualizable: boolean;
}

interface VisualWorkspaceProps {
  entityVisualization: EntityVisualizationResponse | null;
  profileId: string;
  mobileVisible: boolean;
  documentVisualization: DocumentVisualization | null;
}

function describeSource(filename: string): string {
  const normalized = filename.toLowerCase();
  if (normalized.includes('ai_knowledge_base') || normalized.includes('knowledge base')) {
    return 'Organizational overview of Erth Zayed Philanthropies, its purpose, strategic principles, affiliate ecosystem, UAE context, and approved guidance for factual AI responses.';
  }
  if (normalized.includes('hr policy') && normalized.includes('-ar')) {
    return 'Arabic HR guidance covering employee leave, conduct, performance, grievances, disciplinary matters, and the wider employment lifecycle.';
  }
  if (normalized.includes('hr policy')) {
    return 'English HR framework for recruitment, employment terms, leave, attendance, compensation, conduct, performance, grievances, and separation.';
  }
  if (normalized.includes('procurement') && normalized.includes('arabic')) {
    return 'Arabic procurement framework covering sourcing methods, solicitation, approvals, supplier controls, contracting, and purchasing governance.';
  }
  if (normalized.includes('procurement')) {
    return 'Procurement framework for sourcing, tendering, approvals, supplier governance, contracting, guarantees, and purchasing exceptions.';
  }
  if (normalized.includes('accounting')) {
    return 'Accounting policy covering financial records, reconciliations, reporting controls, period-end activities, and accounting responsibilities.';
  }
  if (normalized.includes('finance')) {
    return 'Finance framework covering budgeting, expenditure controls, forecasting, treasury, grants, cash management, and delegated approvals.';
  }
  return 'An indexed policy document available to the agent for grounded answers and page-level evidence.';
}

function SourceLibrary({ availableSources, loading }: { availableSources: AvailableSource[]; loading: boolean }) {
  return (
    <div className="p-4">
      <section className="rounded-[1.4rem] border border-[var(--border-color)]/70 bg-[var(--bg-secondary)]/35 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        <div className="mb-3 flex items-center justify-between gap-3 px-1 pt-1">
          <div>
            <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">Policy library</h3>
            <p className="mt-0.5 text-[10px] leading-4 text-[var(--text-tertiary)]">The agent uses these documents to ground answers and can briefly open the strongest supporting page.</p>
          </div>
          {!!availableSources.length && <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-primary)]/65 px-2.5 py-1 text-[9px] font-semibold text-[var(--text-secondary)] shadow-sm">{availableSources.length}</span>}
        </div>
        <div className="space-y-2">
          {loading ? <div className="rounded-[1.15rem] bg-[var(--bg-primary)]/55 p-4 text-xs text-[var(--text-tertiary)] shadow-sm">Loading sources...</div> : availableSources.map((source) => (
            <article key={source.id} className="group rounded-[1.15rem] border border-[var(--border-color)]/70 bg-[var(--bg-primary)]/68 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl transition duration-200 hover:-translate-y-px hover:border-[var(--accent-primary)]/25 hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)]">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                  <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" d="M7 3h7l4 4v14H7V3Zm7 0v5h5M10 13h5m-5 4h5" /></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="break-words text-[11px] font-semibold leading-4 text-[var(--text-primary)]">{source.filename}</div>
                  <p className="mt-1.5 text-[10px] leading-[1.55] text-[var(--text-secondary)]">{describeSource(source.filename)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-[var(--border-color)]/60 pt-2.5 text-[9px] font-medium text-[var(--text-tertiary)]">
                {source.pageCount && <span>{source.pageCount} pages</span>}
                {source.pageCount && <span className="h-0.5 w-0.5 rounded-full bg-current" />}
                <span>{source.chunkCount} indexed sections</span>
                <span className="ml-auto uppercase tracking-[0.12em]">{source.filename.toLowerCase().includes('-ar') || source.filename.toLowerCase().includes('arabic') ? 'Arabic' : 'English'}</span>
              </div>
            </article>
          ))}
          {!loading && !availableSources.length && <div className="rounded-[1.15rem] border border-dashed border-[var(--border-color)] p-5 text-center text-xs text-[var(--text-tertiary)]">No indexed policy sources are available.</div>}
        </div>
      </section>
    </div>
  );
}

export function VisualWorkspace({ entityVisualization, profileId, mobileVisible, documentVisualization }: VisualWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('sources');
  const [availableSources, setAvailableSources] = useState<AvailableSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const entity = entityVisualization?.visualizationData;

  useEffect(() => {
    const controller = new AbortController();
    setLoadingSources(true);
    fetch(`/api/profiles/${encodeURIComponent(profileId)}/knowledge`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(`Source request failed (${response.status})`)))
      .then((payload: { files?: AvailableSource[] }) => setAvailableSources(payload.files || []))
      .catch((error) => {
        if ((error as Error).name !== 'AbortError') console.error('[Visual Workspace] Failed to load sources:', error);
      })
      .finally(() => setLoadingSources(false));
    return () => controller.abort();
  }, [profileId]);

  useEffect(() => {
    if (documentVisualization) setActiveTab('sources');
  }, [documentVisualization]);

  const tabs: Array<{ id: WorkspaceTab; label: string; count?: number }> = [
    { id: 'sources', label: 'Sources', count: availableSources.length },
    { id: 'entity', label: 'Entity', count: entity ? 1 : 0 },
  ];
  const content = (
    <>
      <header className="shrink-0 px-4 pb-3 pt-4">
        <div className="px-1 pb-3">
          <div className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Evidence</div>
          <div className="mt-0.5 text-[10px] text-[var(--text-tertiary)]">Grounded sources and visual context</div>
        </div>
        <nav className="flex gap-1 rounded-xl border border-[var(--border-color)]/60 bg-[var(--bg-secondary)]/60 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]" aria-label="Evidence views">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${activeTab === tab.id ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-[0_1px_4px_rgba(0,0,0,0.1)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
              {tab.label}{tab.count ? ` ${tab.count}` : ''}
            </button>
          ))}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto sleek-scrollbar">
        {activeTab === 'sources' && (documentVisualization
          ? <PdfDocumentViewer visualization={documentVisualization} />
          : <SourceLibrary availableSources={availableSources} loading={loadingSources} />)}
        {activeTab === 'entity' && (entity ? <EntityVisualization data={entity} isVisible /> : <div className="flex h-48 items-center justify-center px-8 text-center text-xs text-[var(--text-tertiary)]">Structured entity details will appear when the agent identifies a relevant record.</div>)}
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden h-[76dvh] w-[86%] flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[var(--bg-primary)]/84 shadow-[0_24px_70px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-2xl md:flex">{content}</aside>
      <section className={`fixed inset-x-2 bottom-12 z-40 flex max-h-[52dvh] min-h-[22rem] flex-col overflow-hidden rounded-t-3xl border border-b-0 border-[var(--border-color)] bg-[var(--bg-primary)]/94 shadow-[0_-18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl transition-transform md:hidden ${mobileVisible ? 'translate-y-0' : 'translate-y-[110%]'}`}>{content}</section>
    </>
  );
}
