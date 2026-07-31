'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AzureOpenAIConfig } from '@/types/avatar';
import type { EntityVisualizationResponse } from '@/types/entity-visualization';
import type { ConversationSource } from '@/types/conversation-ui';
import type { DocumentVisualization } from '@/types/document-visualization';
import { takeNextSpeechSegment } from '@/lib/text-processing';

type UseAgentProps = {
  openAIConfig: AzureOpenAIConfig;
  profileId: string;
};

export interface AgentMessageInput {
  text: string;
  locale?: string;
  languageLabel?: string;
}

export interface AgentStreamCallbacks {
  onStart?: (event: { messageId: string; conversationId: string; createdAt: string }) => void;
  onToken?: (event: { messageId: string; delta: string; content: string }) => void;
  onSentence?: (sentence: string) => void;
  onRetrieval?: (status: 'searching' | 'grounded' | 'none' | 'error', sources?: ConversationSource[]) => void;
  onDone?: (event: { messageId: string; conversationId: string; completedAt: string }) => void;
  onError?: (message: string) => void;
}

export function useAgent({ profileId }: UseAgentProps) {
  const conversationIdRef = useRef<string | null>(null);
  const processingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [currentEntityVisualization, setCurrentEntityVisualization] = useState<EntityVisualizationResponse | null>(null);
  const [currentDocumentVisualization, setCurrentDocumentVisualization] = useState<DocumentVisualization | null>(null);
  const documentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentDocumentVisualizationRef = useRef<DocumentVisualization | null>(null);
  const documentTimerStartedRef = useRef(false);
  const currentEntityVisualizationRef = useRef<EntityVisualizationResponse | null>(null);
  const isSpeakingAboutEntityRef = useRef(false);

  const updateEntityVisualization = useCallback((visualization: EntityVisualizationResponse | null, isSpeaking: boolean) => {
    setCurrentEntityVisualization(visualization);
    currentEntityVisualizationRef.current = visualization;
    isSpeakingAboutEntityRef.current = isSpeaking;
  }, []);

  const abortAgent = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    processingRef.current = false;
  }, []);

  const resetConversation = useCallback(() => {
    abortAgent();
    conversationIdRef.current = null;
    updateEntityVisualization(null, false);
    setCurrentDocumentVisualization(null);
    currentDocumentVisualizationRef.current = null;
    documentTimerStartedRef.current = false;
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
  }, [abortAgent, updateEntityVisualization]);

  const sendMessage = useCallback(async (
    input: AgentMessageInput,
    callbacks: AgentStreamCallbacks = {}
  ): Promise<string | null> => {
    if (!input.text.trim() || processingRef.current) return null;

    abortAgent();
    processingRef.current = true;
    updateEntityVisualization(null, false);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let fullReply = '';
    let sentenceBuffer = '';
    let activeMessageId = crypto.randomUUID();

    const startDocumentTimerWithNarration = () => {
      const visualization = currentDocumentVisualizationRef.current;
      if (!visualization || documentTimerStartedRef.current) return;
      documentTimerStartedRef.current = true;
      if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
      const duration = Math.min(Math.max(visualization.displayDurationMs || 20000, 20000), 30000);
      documentTimerRef.current = setTimeout(() => {
        setCurrentDocumentVisualization(null);
        currentDocumentVisualizationRef.current = null;
        documentTimerStartedRef.current = false;
        documentTimerRef.current = null;
      }, duration);
    };

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userText: input.text,
          profileId,
          conversationId: conversationIdRef.current || undefined,
          detectedLocale: input.locale,
          detectedLanguage: input.languageLabel,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`Agent request failed (${response.status})`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processPayload = (payload: string) => {
        const parsed = JSON.parse(payload);
        if (parsed.event === 'conversation') {
          conversationIdRef.current = parsed.data.conversationId;
          activeMessageId = parsed.data.assistantMessageId;
          callbacks.onStart?.({
            messageId: activeMessageId,
            conversationId: parsed.data.conversationId,
            createdAt: parsed.data.createdAt,
          });
        } else if (parsed.event === 'content') {
          const chunk = String(parsed.data || '');
          fullReply += chunk;
          sentenceBuffer += chunk;
          callbacks.onToken?.({ messageId: activeMessageId, delta: chunk, content: fullReply });

          let nextSegment = takeNextSpeechSegment(sentenceBuffer);
          while (nextSegment) {
            if (nextSegment.segment) {
              startDocumentTimerWithNarration();
              callbacks.onSentence?.(nextSegment.segment);
            }
            sentenceBuffer = nextSegment.remainder;
            nextSegment = takeNextSpeechSegment(sentenceBuffer);
          }
        } else if (parsed.event === 'retrieval') {
          callbacks.onRetrieval?.(parsed.data.status);
        } else if (parsed.event === 'sources') {
          callbacks.onRetrieval?.(parsed.data.status, parsed.data.sources);
        } else if (parsed.event === 'tool') {
          updateEntityVisualization(parsed.data, true);
        } else if (parsed.event === 'document') {
          const visualization = parsed.data as DocumentVisualization;
          setCurrentDocumentVisualization(visualization);
          currentDocumentVisualizationRef.current = visualization;
          documentTimerStartedRef.current = false;
          if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
          // Safety fallback for a tool-only/error turn. Normal countdown begins
          // with the first narrated sentence so evidence and speech overlap.
          documentTimerRef.current = setTimeout(() => {
            setCurrentDocumentVisualization(null);
            currentDocumentVisualizationRef.current = null;
            documentTimerStartedRef.current = false;
            documentTimerRef.current = null;
          }, 60000);
        } else if (parsed.event === 'done') {
          startDocumentTimerWithNarration();
          conversationIdRef.current = parsed.conversationId;
          callbacks.onDone?.({
            messageId: parsed.messageId || activeMessageId,
            conversationId: parsed.conversationId,
            completedAt: parsed.completedAt || new Date().toISOString(),
          });
        } else if (parsed.event === 'error') {
          callbacks.onError?.(String(parsed.data || 'Agent response failed'));
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const data = event.split('\n').find((line) => line.startsWith('data:'));
          if (data) processPayload(data.replace(/^data:\s*/, ''));
        }
      }

      if (buffer.trim()) {
        const data = buffer.split('\n').find((line) => line.startsWith('data:'));
        if (data) processPayload(data.replace(/^data:\s*/, ''));
      }
      if (sentenceBuffer.trim()) {
        startDocumentTimerWithNarration();
        callbacks.onSentence?.(sentenceBuffer.trim());
      }
      return fullReply;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Agent streaming failed', error);
        callbacks.onError?.((error as Error).message);
      }
      return null;
    } finally {
      processingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [abortAgent, profileId, updateEntityVisualization]);

  useEffect(() => () => {
    if (documentTimerRef.current) clearTimeout(documentTimerRef.current);
  }, []);

  return {
    sendMessage,
    abortAgent,
    resetConversation,
    currentEntityVisualization,
    currentDocumentVisualization,
    updateEntityVisualization,
    currentEntityVisualizationRef,
    isSpeakingAboutEntityRef,
  };
}
