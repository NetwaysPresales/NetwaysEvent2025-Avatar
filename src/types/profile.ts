import { AvatarConfig, SpeechConfig, AzureOpenAIConfig, TTSConfig } from './avatar';

export interface AvatarProfile {
    id: string;
    name: string;
    created: number;
    updated: number;

    // Configurations
    avatarConfig: AvatarConfig;
    speechConfig: SpeechConfig;
    openAIConfig: AzureOpenAIConfig;
    ttsConfig: TTSConfig;

    // Assets (filenames relative to profile assets folder)
    logo: string | null;
    background: string | null; // Can be image or video

    // Settings
    appTitle: string;
    appDescription: string;
    theme: 'dark' | 'light';
}

export interface ProfileSummary {
    id: string;
    name: string;
    avatarUrl: string | null; // Constructed URL for frontend
}
