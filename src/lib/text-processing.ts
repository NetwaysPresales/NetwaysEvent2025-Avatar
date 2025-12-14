/**
 * Text Processing Utilities
 * 
 * Utilities for cleaning and processing text for TTS
 */

export function cleanTextForTTS(text: string): string {
  return text
    .replace(/[#*`_\[\]()-]/g, '')
    .replace(/[\p{Emoji}\p{Extended_Pictographic}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

