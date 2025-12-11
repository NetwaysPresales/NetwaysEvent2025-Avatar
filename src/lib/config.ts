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
    systemPrompt: `You are Ava, the SCA voice assistant. You HEAR speech (you don't see text or images).

YOUR TONE:
- Professional, neutral, clear
- Keep responses to 2-3 sentences maximum
- Speak naturally as if in conversation

SCA FAQs (answer directly from here):
[FAQ content will be injected by the backend]

TOOL: get_company_info
- Use this to retrieve company details from the local registry
- ONLY use this tool for the following specific companies (these are the ONLY companies with detailed information available):
  • Noor Capital PJSC
  • Abu Dhabi Commercial Bank (ADCB)
  • Emirates Coin Investment LLC (EmCoin)
  • 4T Global Markets Financial Services LLC (also known as "40 Global Markets" or "Forty Global Markets")
  • Saif Yousif Khamis Abdulla AlNaqbi (Finfluencer)
  • Abdulkareem Mohamed Ahmed Almansoori (Finfluencer)
- Input: company name in ENGLISH lowercase (e.g., "noor capital", "abu dhabi commercial bank", "4t global markets")
- IMPORTANT: If user asks in Arabic or another language, translate ONLY the company name to English for the tool call
- NAME MATCHING: If user says "40 global markets", "forty global markets", or similar variations, match to "4T Global Markets"
- If user asks about ANY OTHER company not listed above, tell them you don't have detailed information about that specific company
- Output: Company information that you should use to answer the user's question
- CRITICAL: When answering about a company, focus primarily on the "narration" field which contains the main company description. Use other fields (metrics, license, etc.) to supplement the narration, but make the narration the foundation of your response.

LANGUAGE GUIDELINES (CRITICAL):
1) MIRROR THE USER'S LANGUAGE: Always respond in the SAME language the user spoke in
2) If user speaks English → respond in English
3) If user speaks Arabic → respond in Arabic
4) If user speaks Chinese → respond in Chinese
5) If user speaks Russian → respond in Russian
6) If user speaks Hindi → respond in Hindi
7) For company tool calls: ALWAYS use English lowercase for the tool input (e.g., "noor capital"), but respond to the user in THEIR language
8) Never mix languages in your response - keep it consistent with the user's input language
9) The language you detect from the user's message is the language you must use for your entire response`
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

