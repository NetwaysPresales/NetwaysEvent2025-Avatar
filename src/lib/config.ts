/**
 * Configuration utilities
 */

import type { AvatarConfig, SpeechConfig, TTSConfig, AzureOpenAIConfig } from '@/types/avatar';

/**
 * Get default avatar configuration
 */
export function getDefaultAvatarConfig(): AvatarConfig {
  return {
    character: process.env.NEXT_PUBLIC_AVATAR_CHARACTER || 'Harry',
    style: process.env.NEXT_PUBLIC_AVATAR_STYLE || 'business',
    customized: false,
    useBuiltInVoice: false,
    backgroundColor: '#FFFFFFFF',
    backgroundImageUrl: '',
    transparentBackground: false,
    videoCrop: false
  };
}

/**
 * Get default speech configuration
 */
export function getDefaultSpeechConfig(): SpeechConfig {
  return {
    region: process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION || 'westeurope',
    apiKey: process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY || '',
    privateEndpoint: '',
    enablePrivateEndpoint: false
  };
}

/**
 * Get default TTS configuration
 */
export function getDefaultTTSConfig(): TTSConfig {
  return {
    voice: process.env.NEXT_PUBLIC_AVATAR_VOICE || 'en-US-AvaMultilingualNeural',
    customVoiceEndpointId: ''
  };
}

/**
 * Get default Azure OpenAI configuration
 */
export function getDefaultAzureOpenAIConfig(): AzureOpenAIConfig {
  return {
    endpoint: process.env.NEXT_PUBLIC_AZURE_OPENAI_ENDPOINT || '',
    apiKey: process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY || '',
    deploymentName: process.env.NEXT_PUBLIC_AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
    systemPrompt: `You are a helpful AI assistant.

YOUR ROLE:
- You are a knowledgeable, friendly, and professional voice assistant.
- You can answer questions on a wide range of topics or use your tools to find specific information.

KNOWLEDGE BASE:
- You have access to a dynamic knowledge base via the 'knowledge_base' tool.
- If the user asks a question that might be in your files, check the knowledge base.
- First LIST the files to see what is available, then READ the relevant file.

LANGUAGE GUIDELINES:
1) MIRROR THE USER'S LANGUAGE: Always respond in the SAME language the user spoke in.
2) If user speaks English → respond in English.
3) If user speaks Arabic → respond in Arabic.
4) If user speaks Chinese → respond in Chinese.
5) If user speaks Russian → respond in Russian.
6) If user speaks Hindi → respond in Hindi.
7) Never mix languages in your response - keep it consistent with the user's input language.`
  };
}

/**
 * Validate speech configuration
 */
export function validateSpeechConfig(config: SpeechConfig): string | null {
  if (!config.apiKey) {
    return 'Please provide Azure Speech API key';
  }
  if (config.enablePrivateEndpoint && !config.privateEndpoint) {
    return 'Please provide private endpoint URL';
  }
  return null;
}

/**
 * Validate Azure OpenAI configuration
 */
export function validateAzureOpenAIConfig(config: AzureOpenAIConfig): string | null {
  if (!config.endpoint) {
    return 'Please provide Azure OpenAI endpoint';
  }
  if (!config.apiKey) {
    return 'Please provide Azure OpenAI API key';
  }
  if (!config.deploymentName) {
    return 'Please provide deployment name';
  }
  return null;
}

