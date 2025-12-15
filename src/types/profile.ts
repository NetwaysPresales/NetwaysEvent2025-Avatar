import { AvatarConfig, SpeechConfig, AzureOpenAIConfig, TTSConfig, STTConfig } from './avatar';
import { AccentColor } from '@/lib/theme';

/**
 * Profile type matching the database schema
 */
export interface Profile {
  id: string;
  userId: string;
  name: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string

  // Configurations (JSONB from database)
  avatarConfig: AvatarConfig;
  speechConfig: SpeechConfig;
  ttsConfig: TTSConfig;
  openaiConfig: AzureOpenAIConfig;
  sttConfig: STTConfig;

  // Appearance
  appTitle: string | null;
  appDescription: string | null;
  theme: 'light' | 'dark';
  accentColor: AccentColor | null;
  logoShowContainer: boolean;

  // Asset references (Blob Storage URLs)
  logoBlobUrl: string | null;
  backgroundBlobUrl: string | null;
}

/**
 * Legacy AvatarProfile type for backward compatibility
 * @deprecated Use Profile instead. This will be removed after migration.
 */
export interface AvatarProfile {
  id: string;
  name: string;
  created: number;
  updated: number;
  avatarConfig: AvatarConfig;
  speechConfig: SpeechConfig;
  openAIConfig: AzureOpenAIConfig;
  ttsConfig: TTSConfig;
  logo: string | null;
  background: string | null;
  appTitle: string;
  appDescription: string;
  theme: 'dark' | 'light';
}

export interface ProfileSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
}
