/**
 * Asset URL Utilities
 * 
 * Utilities for working with asset URLs (blob URLs vs API endpoint URLs)
 */

/**
 * Check if a URL is a blob storage URL (starts with https://)
 */
export function isBlobUrl(url: string | null): boolean {
  if (!url) return false;
  return url.startsWith('https://');
}

/**
 * Extract blob URL from API endpoint URL or return the URL if it's already a blob URL
 */
export function extractBlobUrl(url: string | null, existingBlobUrl: string | null): string | null {
  if (!url) return null;
  // If it's already a blob URL, use it
  if (isBlobUrl(url)) return url;
  // If it's an API endpoint URL, the blob URL hasn't changed, use existing
  return existingBlobUrl;
}

