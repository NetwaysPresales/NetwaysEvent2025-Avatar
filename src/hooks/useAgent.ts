'use client';

import { useRef, useState, useCallback } from 'react';
import type { AzureOpenAIConfig, Entity } from '@/types/avatar';

type UseAgentProps = {
    openAIConfig: AzureOpenAIConfig;
};

export function useAgent({ openAIConfig }: UseAgentProps) {
    const convoRef = useRef<string[]>([]);
    const processingRef = useRef(false);
    const lastMessageRef = useRef('');
    const [currentEntity, setCurrentEntity] = useState<Entity | null>(null);
    const currentEntityRef = useRef<Entity | null>(null);
    const isSpeakingAboutCompanyRef = useRef(false);

    const updateEntityState = useCallback((entity: Entity | null, isSpeaking: boolean) => {
        setCurrentEntity(entity);
        currentEntityRef.current = entity;
        isSpeakingAboutCompanyRef.current = isSpeaking;
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
            convoRef.current.push(message);
            const res = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    history: convoRef.current.slice(-12),
                    systemPrompt: openAIConfig.systemPrompt
                })
            });

            if (!res.ok) {
                console.error('Agent HTTP error', res.status);
                return null;
            }

            const data = await res.json().catch(() => ({ reply: '', entityDetails: null }));
            const reply = String(data?.reply || '').trim();
            const entityDetails = data?.entityDetails || null;

            if (reply) {
                // If API returned an entity, use it directly
                if (entityDetails) {
                    updateEntityState(entityDetails, true);
                } else {
                    updateEntityState(null, false);
                }

                convoRef.current.push(reply);
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
        currentEntity,
        updateEntityState,
        currentEntityRef,
        isSpeakingAboutCompanyRef
    };
}
