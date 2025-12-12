'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import type { AvatarConfig, SpeechConfig, TTSConfig, AzureOpenAIConfig, STTConfig } from '@/types/avatar';
import {
    getDefaultSpeechConfig,
    getDefaultAvatarConfig,
    getDefaultTTSConfig,
    getDefaultAzureOpenAIConfig
} from '@/lib/config';

interface SettingsContextType {
    // Configs
    speechConfig: SpeechConfig;
    setSpeechConfig: Dispatch<SetStateAction<SpeechConfig>>;
    avatarConfig: AvatarConfig;
    setAvatarConfig: Dispatch<SetStateAction<AvatarConfig>>;
    ttsConfig: TTSConfig;
    openAIConfig: AzureOpenAIConfig;
    setOpenAIConfig: Dispatch<SetStateAction<AzureOpenAIConfig>>;
    sttConfig: STTConfig;

    // UI State
    theme: 'dark' | 'light';
    setTheme: Dispatch<SetStateAction<'dark' | 'light'>>;
    appTitle: string;
    setAppTitle: Dispatch<SetStateAction<string>>;
    appDescription: string;
    setAppDescription: Dispatch<SetStateAction<string>>;
    logoUrl: string;
    setLogoUrl: Dispatch<SetStateAction<string>>;


    // Backgrounds
    bgRefreshTrigger: number;
    refreshBackground: () => void;

    // Visibility
    showSpeechApiKey: boolean;
    setShowSpeechApiKey: Dispatch<SetStateAction<boolean>>;
    showOpenAIApiKey: boolean;
    setShowOpenAIApiKey: Dispatch<SetStateAction<boolean>>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    // Helper to get from local storage or default
    const getStored = <T,>(key: string, defaultVal: T): T => {
        if (typeof window === 'undefined') return defaultVal;
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultVal;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return defaultVal;
        }
    };

    // Helper to set to local storage
    const usePersistedState = <T,>(key: string, defaultValue: T) => {
        const [state, setState] = useState<T>(defaultValue);
        const [isInitialized, setIsInitialized] = useState(false);

        useEffect(() => {
            // Load from storage on mount
            const stored = getStored(key, defaultValue);
            setState(stored);
            setIsInitialized(true);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [key]); // Run once on mount per key

        useEffect(() => {
            // Save to storage on change, only after we've initialized matches
            if (isInitialized) {
                try {
                    window.localStorage.setItem(key, JSON.stringify(state));
                } catch (error) {
                    console.warn(`Error writing localStorage key "${key}":`, error);
                }
            }
        }, [key, state, isInitialized]);

        return [state, setState] as const;
    };

    const [speechConfig, setSpeechConfig] = usePersistedState<SpeechConfig>('speechConfig_v2', getDefaultSpeechConfig());
    const [avatarConfig, setAvatarConfig] = usePersistedState<AvatarConfig>('avatarConfig_v2', getDefaultAvatarConfig());
    const [ttsConfig] = useState<TTSConfig>(getDefaultTTSConfig()); // Not persisting TTS config for now as it wasn't requested/editable
    const [openAIConfig, setOpenAIConfig] = usePersistedState<AzureOpenAIConfig>('openAIConfig_v2', getDefaultAzureOpenAIConfig());
    const [sttConfig] = useState<STTConfig>({
        locales: ['en-US', 'ar-AE', 'ar-SA', 'ar-EG', 'zh-CN', 'ru-RU', 'hi-IN'],
        continuousConversation: false
    });

    const [theme, setTheme] = usePersistedState<'dark' | 'light'>('theme_v2', 'light');
    const [appTitle, setAppTitle] = usePersistedState<string>('appTitle_v3', 'Netways Avatar');
    const [appDescription, setAppDescription] = usePersistedState<string>('appDescription_v1', 'AI-powered voice assistant');

    const [logoUrl, setLogoUrl] = usePersistedState<string>('logoUrl_v2', '/logo.png');

    // Background refresh trigger - separate from persistence as actual source is API
    const [bgRefreshTrigger, setBgRefreshTrigger] = useState(0);
    const refreshBackground = () => setBgRefreshTrigger(prev => prev + 1);

    // Validating document title and description update
    useEffect(() => {
        document.title = appTitle;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', appDescription);
        }
    }, [appTitle, appDescription]);

    // UI states that don't need persistence
    const [showSpeechApiKey, setShowSpeechApiKey] = useState(false);
    const [showOpenAIApiKey, setShowOpenAIApiKey] = useState(false);

    return (
        <SettingsContext.Provider value={{
            speechConfig, setSpeechConfig,
            avatarConfig, setAvatarConfig,
            ttsConfig,
            openAIConfig, setOpenAIConfig,
            sttConfig,
            theme, setTheme,
            appTitle, setAppTitle,
            appDescription, setAppDescription,
            logoUrl, setLogoUrl,
            bgRefreshTrigger, refreshBackground,
            showSpeechApiKey, setShowSpeechApiKey,
            showOpenAIApiKey, setShowOpenAIApiKey
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
