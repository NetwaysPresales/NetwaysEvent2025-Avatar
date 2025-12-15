/**
 * Profile Hydration Service
 * 
 * Handles converting raw Profile data into HydratedProfile with defaults
 */

import type { Profile } from '@/types/profile';
import type { AvatarConfig, SpeechConfig, TTSConfig, AzureOpenAIConfig, STTConfig } from '@/types/avatar';
import {
  getDefaultSpeechConfig,
  getDefaultAvatarConfig,
  getDefaultTTSConfig,
  getDefaultAzureOpenAIConfig,
} from '@/lib/config';
import { buildAssetUrl } from '@/lib/asset-url';
import type { AccentColor } from '@/lib/theme';

export interface HydratedProfile {
  speechConfig: SpeechConfig;
  avatarConfig: AvatarConfig;
  ttsConfig: TTSConfig;
  openaiConfig: AzureOpenAIConfig;
  sttConfig: STTConfig;
  appearance: {
    logoUrl: string | null;
    backgroundUrl: string | null;
    appTitle: string;
    appDescription: string;
    theme: 'light' | 'dark';
    accentColor: AccentColor | null;
  };
}

/**
 * Hydrate profile data from API response
 */
export function hydrateProfile(profile: Profile): HydratedProfile {
  const defaultSpeech = getDefaultSpeechConfig();
  const defaultAvatar = getDefaultAvatarConfig();
  const defaultTTS = getDefaultTTSConfig();
  const defaultOpenAI = getDefaultAzureOpenAIConfig();

  // Merge with defaults
  const speechConfig = {
    ...defaultSpeech,
    ...(profile.speechConfig as Partial<SpeechConfig>),
    apiKey: (profile.speechConfig as Partial<SpeechConfig>)?.apiKey || defaultSpeech.apiKey,
    region: (profile.speechConfig as Partial<SpeechConfig>)?.region || defaultSpeech.region,
  } as SpeechConfig;

  const avatarConfig = {
    ...defaultAvatar,
    ...(profile.avatarConfig as Partial<AvatarConfig>),
  } as AvatarConfig;

  const ttsConfig = {
    ...defaultTTS,
    ...(profile.ttsConfig as Partial<TTSConfig>),
  } as TTSConfig;

  const openaiConfig = {
    ...defaultOpenAI,
    ...(profile.openaiConfig as Partial<AzureOpenAIConfig>),
    apiKey: (profile.openaiConfig as Partial<AzureOpenAIConfig>)?.apiKey || defaultOpenAI.apiKey,
    endpoint: (profile.openaiConfig as Partial<AzureOpenAIConfig>)?.endpoint || defaultOpenAI.endpoint,
    deploymentName: (profile.openaiConfig as Partial<AzureOpenAIConfig>)?.deploymentName || defaultOpenAI.deploymentName,
  } as AzureOpenAIConfig;

  // STT config with proper defaults
  const sttConfig: STTConfig = {
    locales: ['en-US', 'ar-AE'], // Default locales
    continuousConversation: true,
    ...(profile.sttConfig as Partial<STTConfig>),
  };

  // Build asset URLs (use API endpoint which redirects to SAS URL)
  const logoUrl = profile.logoBlobUrl ? buildAssetUrl(profile.id, 'logo', 60) : null;
  const backgroundUrl = profile.backgroundBlobUrl
    ? buildAssetUrl(profile.id, 'background', 60)
    : null;

  return {
    speechConfig,
    avatarConfig,
    ttsConfig,
    openaiConfig,
    sttConfig,
    appearance: {
      logoUrl,
      backgroundUrl,
      appTitle: profile.appTitle || 'Netways Avatar',
      appDescription: profile.appDescription || 'AI-powered voice assistant',
      theme: profile.theme || 'light',
      accentColor: profile.accentColor,
    },
  };
}

