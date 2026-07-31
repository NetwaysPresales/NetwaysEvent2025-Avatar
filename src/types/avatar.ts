// Avatar configuration types
export interface AvatarConfig {
  character: string;
  style: string;
  avatarType?: 'video' | 'photo';
  photoAvatarBaseModel?: string;
  customized: boolean;
  useBuiltInVoice: boolean;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  transparentBackground?: boolean;
  videoCrop?: boolean;
}

// Speech configuration types
export interface SpeechConfig {
  region: string;
  apiKey: string;
  privateEndpoint?: string;
  enablePrivateEndpoint: boolean;
}

// TTS configuration types
export interface TTSConfig {
  voice: string;
  customVoiceEndpointId?: string;
  // Advanced TTS options
  speakingRate?: number; // 0.5 to 2.0
  pitch?: number; // -50 to +50
  volume?: number; // 0 to 100
  useSSML?: boolean;
}

// STT configuration types (based on official Azure Speech SDK)
export interface STTConfig {
  locales: string[];
  continuousConversation: boolean;
  // Advanced STT options (confirmed from Azure documentation)
  profanityFilter?: 'masked' | 'removed' | 'raw';          // Profanity filtering
  enableDiarization?: boolean;                              // Speaker identification
  enableWordLevelTimestamps?: boolean;                      // Word timing
  outputFormat?: 'simple' | 'detailed';                     // Output detail level
  customModelEndpointId?: string;                           // Custom Speech model
}

// Azure OpenAI configuration types
export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  systemPrompt: string;
  initialMessage?: string;
}

// WebRTC types
export interface ICEServerConfig {
  urls: string[];
  username: string;
  credential: string;
}

export interface AvatarEventData {
  event: {
    eventType: string;
  };
  offset?: number;
}

// Session state types
export type SessionState = 'idle' | 'connecting' | 'connected' | 'speaking' | 'disconnected' | 'error';

// Entity/Company data types
export interface EntityCoordinates {
  lat: number;
  lng: number;
}

export interface EntityMetrics {
  // Financial Services
  aumAEDBn?: number;
  clients?: number;
  annualVolumeAEDBn?: number;
  complianceScore?: number;
  // Banking
  marketCapAEDBn?: number;
  dividendYieldPct?: number;
  // VASP/Crypto
  userGrowthPct?: number;
  // Finfluencers
  audience?: number;
  recommendationSuccessPct?: number;
}

export interface Entity {
  name: string;
  license: string;
  type: string;
  status: string;
  emirate?: string;
  issueDate?: string;
  expiryDate?: string | null;
  coordinates?: EntityCoordinates;
  metrics?: EntityMetrics;
  narration?: string;
}

