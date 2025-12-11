/**
 * SSML (Speech Synthesis Markup Language) utilities
 */

import type { TTSConfig } from '@/types/avatar';

/**
 * HTML encode text to prevent SSML injection
 */
export function htmlEncode(text: string): string {
  const entityMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };

  return String(text).replace(/[&<>"'\/]/g, (match) => entityMap[match]);
}

/**
 * Create SSML string with advanced prosody controls
 */
export function createSSML(
  text: string, 
  voice: string, 
  endingSilenceMs: number = 0,
  ttsConfig?: TTSConfig
): string {
  const encodedText = htmlEncode(text);
  
  // Build prosody attributes from config
  let prosodyAttrs = '';
  if (ttsConfig?.speakingRate) {
    prosodyAttrs += ` rate="${ttsConfig.speakingRate}"`;
  }
  if (ttsConfig?.pitch) {
    prosodyAttrs += ` pitch="${ttsConfig.pitch > 0 ? '+' : ''}${ttsConfig.pitch}%"`;
  }
  if (ttsConfig?.volume) {
    prosodyAttrs += ` volume="${ttsConfig.volume}"`;
  }

  // Wrap in prosody tag if any attributes are set
  const contentWithProsody = prosodyAttrs 
    ? `<prosody${prosodyAttrs}>${encodedText}</prosody>`
    : encodedText;

  const silenceBreak = endingSilenceMs > 0 
    ? `<break time='${endingSilenceMs}ms' />` 
    : '';

  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${voice}'><mstts:leadingsilence-exact value='0'/>${contentWithProsody}${silenceBreak}</voice></speak>`;
}

