'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, Dispatch, SetStateAction } from 'react';
import type { AvatarConfig, SpeechConfig, TTSConfig, AzureOpenAIConfig, STTConfig } from '@/types/avatar';
import {
    getDefaultSpeechConfig,
    getDefaultAvatarConfig,
    getDefaultTTSConfig,
    getDefaultAzureOpenAIConfig
} from '@/lib/config';
import { AvatarProfile } from '@/types/profile';

interface SettingsContextType {
    // Profile Management
    currentProfile: AvatarProfile | null;
    profiles: AvatarProfile[];
    loadProfile: (id: string) => Promise<void>;
    refreshProfiles: () => Promise<AvatarProfile[]>;
    saveCurrentProfile: () => Promise<void>;
    createNewProfile: (name: string) => Promise<void>;
    deleteProfile: (id: string) => Promise<void>;

    // Configs (These reflect the CURRENT profile state)
    speechConfig: SpeechConfig;
    setSpeechConfig: Dispatch<SetStateAction<SpeechConfig>>;
    avatarConfig: AvatarConfig;
    setAvatarConfig: Dispatch<SetStateAction<AvatarConfig>>;
    ttsConfig: TTSConfig;
    setTTSConfig: Dispatch<SetStateAction<TTSConfig>>;
    openAIConfig: AzureOpenAIConfig;
    setOpenAIConfig: Dispatch<SetStateAction<AzureOpenAIConfig>>;
    sttConfig: STTConfig;

    // UI State (Linked to Profile)
    theme: 'dark' | 'light';
    setTheme: Dispatch<SetStateAction<'dark' | 'light'>>;
    appTitle: string;
    setAppTitle: Dispatch<SetStateAction<string>>;
    appDescription: string;
    setAppDescription: Dispatch<SetStateAction<string>>;
    logoUrl: string;
    setLogoUrl: Dispatch<SetStateAction<string>>;

    // Backgrounds (Linked to Profile)
    backgroundUrl: string | null;
    setBackgroundUrl: Dispatch<SetStateAction<string | null>>;

    // Visibility (Local UI state)
    showSpeechApiKey: boolean;
    setShowSpeechApiKey: Dispatch<SetStateAction<boolean>>;
    showOpenAIApiKey: boolean;
    setShowOpenAIApiKey: Dispatch<SetStateAction<boolean>>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {

    // Config States
    const [speechConfig, setSpeechConfig] = useState<SpeechConfig>(getDefaultSpeechConfig());
    const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(getDefaultAvatarConfig());
    const [openAIConfig, setOpenAIConfig] = useState<AzureOpenAIConfig>(getDefaultAzureOpenAIConfig());
    const [ttsConfig, setTTSConfig] = useState<TTSConfig>(getDefaultTTSConfig());
    const [sttConfig] = useState<STTConfig>({
        locales: ['en-US', 'ar-AE', 'ar-SA', 'ar-EG', 'zh-CN', 'ru-RU', 'hi-IN'],
        continuousConversation: false
    });

    const [theme, setTheme] = useState<'dark' | 'light'>('light');

    // Load theme from local storage on mount
    useEffect(() => {
        const savedTheme = window.localStorage.getItem('app_theme') as 'dark' | 'light';
        if (savedTheme) setTheme(savedTheme);
    }, []);

    // Persist theme
    useEffect(() => {
        window.localStorage.setItem('app_theme', theme);
    }, [theme]);
    const [appTitle, setAppTitle] = useState('Netways Avatar');
    const [appDescription, setAppDescription] = useState('AI-powered voice assistant');
    const [logoUrl, setLogoUrl] = useState<string>('');
    const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);

    // Profile State
    const [profiles, setProfiles] = useState<AvatarProfile[]>([]);
    const [currentProfile, setCurrentProfile] = useState<AvatarProfile | null>(null);

    // Initial Load
    useEffect(() => {
        refreshProfiles().then(async (loadedProfiles) => {
            if (loadedProfiles.length > 0) {
                // Try load last used or default
                const lastId = window.localStorage.getItem('lastProfileId');
                const target = lastId ? loadedProfiles.find(p => p.id === lastId) : loadedProfiles[0];
                if (target) await loadProfile(target.id);
            }
        });
    }, []);

    // Sync title/meta
    useEffect(() => {
        document.title = appTitle;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) metaDesc.setAttribute('content', appDescription);
    }, [appTitle, appDescription]);

    const refreshProfiles = async () => {
        try {
            const res = await fetch('/api/profiles');
            const data = await res.json();
            if (data.profiles) {
                setProfiles(data.profiles);
                return data.profiles as AvatarProfile[];
            }
        } catch (e) {
            console.error('Failed to load profiles', e);
        }
        return [];
    };

    const loadProfile = async (id: string) => {
        try {
            const res = await fetch(`/api/profiles/${id}`);
            const profile = await res.json();

            if (profile && !profile.error) {
                setCurrentProfile(profile);
                window.localStorage.setItem('lastProfileId', id);

                // Hydrate State with Smart Defaults (Merge env vars if profile is missing keys)
                const defaultSpeech = getDefaultSpeechConfig();
                const loadedSpeech = profile.speechConfig || {};
                setSpeechConfig({
                    ...defaultSpeech,
                    ...loadedSpeech,
                    apiKey: loadedSpeech.apiKey || defaultSpeech.apiKey,
                    region: loadedSpeech.region || defaultSpeech.region
                } as SpeechConfig);

                setAvatarConfig(profile.avatarConfig || getDefaultAvatarConfig());
                setTTSConfig(profile.ttsConfig || getDefaultTTSConfig());

                const defaultOpenAI = getDefaultAzureOpenAIConfig();
                const loadedOpenAI = profile.openAIConfig || {};
                setOpenAIConfig({
                    ...defaultOpenAI,
                    ...loadedOpenAI,
                    apiKey: loadedOpenAI.apiKey || defaultOpenAI.apiKey,
                    endpoint: loadedOpenAI.endpoint || defaultOpenAI.endpoint,
                    deploymentName: loadedOpenAI.deploymentName || defaultOpenAI.deploymentName
                } as AzureOpenAIConfig);
                // We don't have a setTTSConfig exposed in context type yet, but we need to ensure it's loaded if we had a setter.
                // CURRENT LIMITATION: ttsConfig is static in this context implementation (line 62: const [ttsConfig] = useState...).
                // To support per-profile voice, we must allow setting it.
                // For this step I will only ensure it is saved if it exists in the profile, 
                // but to *load* it, I need to add setTTSConfig to the context. 
                // Let's assume for now we just save it if available from a future 'set' implementation, 
                // OR we accept that we need to refactor context to support changing TTS config.

                // Refactoring context adds risk. I will add it to the 'updated' object using the *current* persistent state if it was editable, 
                // but since it's not editable in UI yet (no setTTSConfig exposed), it will keep saving default.
                // However, the user wants to see the VOICE name in the card. 
                // If I don't implement loading/saving speech voice, it will always be default.

                // For this task, I will ensure 'ttsConfig' is part of the saved object. 
                // Since I can't change the context state structure easily without breaking usage in other files 
                // (need to check usages of useSettings().ttsConfig), I will leave the *state* as is 
                // but ensure the *profile* object constructed includes it from the parameters.

                // Wait, if I can't set it, I can't load it to UI.
                // I MUST add setTTSConfig support to context to fix the root cause.
                // But first let's just make sure the SAVE function includes it.

                // Theme is global now, do not override from profile
                // setTheme(profile.theme || 'light');
                setAppTitle(profile.appTitle || 'Netways Avatar');
                setAppDescription(profile.appDescription || 'AI-powered voice assistant');

                // Assets
                setLogoUrl(profile.logo ? `/api/profiles/${id}/assets?file=${profile.logo}` : '');
                setBackgroundUrl(profile.background ? `/api/profiles/${id}/assets?file=${profile.background}` : null);
            }
        } catch (e) {
            console.error('Failed to load profile details', e);
        }
    };

    const saveCurrentProfile = async () => {
        if (!currentProfile) return;

        // Parse logo filename
        let logoFilename = currentProfile.logo;
        if (logoUrl.includes('/api/profiles/')) {
            const url = new URL(logoUrl, window.location.origin);
            logoFilename = url.searchParams.get('file');
        } else if (!logoUrl) {
            logoFilename = null;
        }

        // Parse background filename
        let bgFilename = currentProfile.background;
        if (backgroundUrl && backgroundUrl.includes('/api/profiles/')) {
            const url = new URL(backgroundUrl, window.location.origin);
            bgFilename = url.searchParams.get('file');
        } else if (!backgroundUrl) {
            bgFilename = null;
        }

        const updated: AvatarProfile = {
            ...currentProfile,
            avatarConfig,
            speechConfig,
            ttsConfig,
            openAIConfig,
            theme,
            appTitle,
            appDescription,
            logo: logoFilename,
            background: bgFilename,
        };

        try {
            await fetch(`/api/profiles/${currentProfile.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated)
            });
            await refreshProfiles();
        } catch (e) {
            console.error('Failed to save profile', e);
        }
    };

    const createNewProfile = async (name: string) => {
        try {
            const res = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();
            if (data.profile) {
                await refreshProfiles();
                // Optionally auto-switch
                // await loadProfile(data.profile.id);
            }
        } catch (e) {
            console.error('Failed to create profile', e);
        }
    };

    const deleteProfile = async (id: string) => {
        if (!confirm('Are you sure you want to delete this profile?')) return;
        try {
            await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
            const remaining = await refreshProfiles();
            if (currentProfile?.id === id && remaining.length > 0) {
                loadProfile(remaining[0].id);
            } else if (remaining.length === 0) {
                // If all deleted, maybe create default again or handle empty state
                window.location.reload();
            }
        } catch (e) {
            console.error('Failed to delete profile', e);
        }
    };

    // UI states non-persistent
    const [showSpeechApiKey, setShowSpeechApiKey] = useState(false);
    const [showOpenAIApiKey, setShowOpenAIApiKey] = useState(false);

    return (
        <SettingsContext.Provider value={{
            currentProfile, profiles, loadProfile, refreshProfiles, saveCurrentProfile, createNewProfile, deleteProfile,
            speechConfig, setSpeechConfig,
            avatarConfig, setAvatarConfig,
            ttsConfig, setTTSConfig,
            openAIConfig, setOpenAIConfig,
            sttConfig,
            theme, setTheme,
            appTitle, setAppTitle,
            appDescription, setAppDescription,
            logoUrl, setLogoUrl,
            backgroundUrl, setBackgroundUrl,
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
