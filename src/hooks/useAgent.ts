'use client';

import { useRef, useState, useCallback } from 'react';
import type { AzureOpenAIConfig } from '@/types/avatar';
import type { EntityVisualizationResult } from '@/types/entity-visualization';

type UseAgentProps = {
    openAIConfig: AzureOpenAIConfig;
    profileId: string;
};

export function useAgent({ openAIConfig, profileId }: UseAgentProps) {
    const conversationIdRef = useRef<string | null>(null);
    const processingRef = useRef(false);
    const lastMessageRef = useRef('');
    const [currentEntityVisualization, setCurrentEntityVisualization] = useState<EntityVisualizationResult | null>(null);
    const currentEntityVisualizationRef = useRef<EntityVisualizationResult | null>(null);
    const isSpeakingAboutEntityRef = useRef(false);

    const updateEntityVisualization = useCallback((visualization: EntityVisualizationResult | null, isSpeaking: boolean) => {
        setCurrentEntityVisualization(visualization);
        currentEntityVisualizationRef.current = visualization;
        isSpeakingAboutEntityRef.current = isSpeaking;
    }, []);

    const sendMessage = async (message: string): Promise<string | null> => {
        if (!message.trim()) return null;

        // Prevent duplicate processing of the same message
        if (processingRef.current || lastMessageRef.current === message) {
            return null;
        }

        processingRef.current = true;
        lastMessageRef.current = message;

        try {
            const res = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userText: message,
                    profileId,
                    conversationId: conversationIdRef.current || undefined,
                })
            });

            if (!res.ok) {
                console.error('Agent HTTP error', res.status);
                return null;
            }

            const data = await res.json().catch(() => ({ reply: '', entityVisualization: null, conversationId: null }));
            const reply = String(data?.reply || '').trim();
            const entityVisualization = data?.entityVisualization || null;
            const conversationId = data?.conversationId;

            // Update conversation ID if provided
            if (conversationId) {
                conversationIdRef.current = conversationId;
            }

            if (reply) {
                // If API returned entity visualization, use it directly
                if (entityVisualization) {
                    updateEntityVisualization(entityVisualization, true);
                } else {
                    updateEntityVisualization(null, false);
                }

                return reply;
            }
            return null;
        } catch (e) {
            console.error('Agent call failed', e);
            return null;
        } finally {
            processingRef.current = false;
            setTimeout(() => {
                lastMessageRef.current = '';
            }, 1000);
        }
    };

    return {
        sendMessage,
        currentEntityVisualization,
        updateEntityVisualization,
        currentEntityVisualizationRef,
        isSpeakingAboutEntityRef
    };
}
