/**
 * Unified Media URL Hook
 * 
 * React hook for fetching authenticated SAS URLs for any blob URL.
 * Handles caching, expiration, and re-fetching.
 * 
 * Works with all media types:
 * - Profile assets (logo/background)
 * - Entity media files (images/videos)
 * - Knowledge files
 * - Any other blob URLs
 */

'use client';

import { useState, useEffect, useRef } from 'react';

// Cache for media URLs: key = blobUrl, value = { url, expiresAt }
const urlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Clear cached URL for a specific blob URL
 */
export function clearMediaUrlCache(blobUrl: string) {
  urlCache.delete(blobUrl);
}

/**
 * Clear all cached media URLs
 */
export function clearAllMediaUrlCache() {
  urlCache.clear();
}

/**
 * React hook for fetching authenticated media URLs
 * 
 * @param blobUrl - Blob URL to fetch SAS URL for
 * @param options - Options for URL fetching
 * @returns SAS URL or null if not available/loading
 */
export function useMediaUrl(
  blobUrl: string | null,
  options: {
    expiresInMinutes?: number;
    enabled?: boolean;
  } = {}
): string | null {
  const { expiresInMinutes = 60, enabled = true } = options;
  const [url, setUrl] = useState<string | null>(null);
  const cacheKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !blobUrl) {
      setUrl(null);
      cacheKeyRef.current = null;
      return;
    }

    // Check if it's already a SAS URL (has query params)
    if (blobUrl.includes('?') && blobUrl.includes('sig=')) {
      // Already a SAS URL, use it directly
      setUrl(blobUrl);
      return;
    }

    cacheKeyRef.current = blobUrl;

    // Check cache first
    const cached = urlCache.get(blobUrl);
    if (cached && cached.expiresAt > Date.now()) {
      setUrl(cached.url);
      return;
    }

    // If cached but expired, clear it
    if (cached) {
      urlCache.delete(blobUrl);
    }

    let cancelled = false;

    async function fetchUrl() {
      try {
        const res = await fetch(
          `/api/media?blobUrl=${encodeURIComponent(blobUrl)}&expiresInMinutes=${expiresInMinutes}`,
          {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (cancelled || cacheKeyRef.current !== blobUrl) return;

        if (!res.ok) {
          if (res.status === 401) {
            console.warn(`[useMediaUrl] Unauthorized access to blob: ${blobUrl}`);
          } else if (res.status === 403) {
            console.warn(`[useMediaUrl] Access denied to blob: ${blobUrl}`);
          } else if (res.status === 404) {
            console.warn(`[useMediaUrl] Blob not found: ${blobUrl}`);
          } else {
            console.error(`[useMediaUrl] Failed to fetch media URL:`, res.status);
          }
          setUrl(null);
          return;
        }

        // Parse JSON response with SAS URL
        const data = await res.json();
        if (data?.url && !cancelled && cacheKeyRef.current === blobUrl) {
          // Cache the URL (expires 5 minutes before the SAS token expires to be safe)
          const cacheExpiresAt = Date.now() + ((expiresInMinutes - 5) * 60 * 1000);
          urlCache.set(blobUrl, { url: data.url, expiresAt: cacheExpiresAt });
          setUrl(data.url);
        } else if (!cancelled && cacheKeyRef.current === blobUrl) {
          setUrl(null);
        }
      } catch (error) {
        if (!cancelled && cacheKeyRef.current === blobUrl) {
          console.error(`[useMediaUrl] Error fetching media URL:`, error);
          setUrl(null);
        }
      }
    }

    fetchUrl();

    return () => {
      cancelled = true;
    };
  }, [blobUrl, expiresInMinutes, enabled]);

  return url;
}

