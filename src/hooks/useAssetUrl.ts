/**
 * Hook for fetching authenticated asset URLs (Profile logos/backgrounds)
 * 
 * Convenience wrapper for profile assets. Uses the unified media service
 * on the backend via /api/profiles/[id]/assets endpoint.
 * 
 * For other media types (entity media, etc.), use useMediaUrl hook directly.
 * 
 * Fetches SAS URLs from the API with proper authentication
 * Caches URLs to prevent unnecessary re-fetches
 */

'use client';

import { useState, useEffect, useRef } from 'react';

// Cache for asset URLs: key = `${profileId}:${assetType}`, value = { url, expiresAt }
const urlCache = new Map<string, { url: string; expiresAt: number }>();

// Pending fetch promises to prevent duplicate requests for the same asset
const pendingFetches = new Map<string, Promise<string | null>>();

/**
 * Clear cached URL for a specific asset
 */
export function clearAssetUrlCache(profileId: string, assetType: 'logo' | 'background') {
  const cacheKey = `${profileId}:${assetType}`;
  urlCache.delete(cacheKey);
  pendingFetches.delete(cacheKey);
}

/**
 * Fetch an asset URL (logo or background) with authentication
 */
export function useAssetUrl(
  profileId: string | null,
  assetType: 'logo' | 'background',
  enabled: boolean = true
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const cacheKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !profileId) {
      setUrl(null);
      cacheKeyRef.current = null;
      return;
    }

    const cacheKey = `${profileId}:${assetType}`;
    cacheKeyRef.current = cacheKey;

    // Check cache first
    const cached = urlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      setUrl(cached.url);
      return;
    }

    // If cached but expired, clear it
    if (cached) {
      urlCache.delete(cacheKey);
    }

    let cancelled = false;

    async function fetchUrl() {
      // Check if there's already a pending fetch for this asset
      const existingFetch = pendingFetches.get(cacheKey);
      if (existingFetch) {
        // Wait for the existing fetch to complete
        try {
          const result = await existingFetch;
          if (!cancelled && cacheKeyRef.current === cacheKey && result) {
            setUrl(result);
          }
        } catch {
          // If existing fetch failed, we'll handle it below
        }
        return;
      }

      // Create new fetch promise
      const fetchPromise = (async () => {
        try {
          const res = await fetch(
            `/api/profiles/${profileId}/assets?assetType=${assetType}&expiresInMinutes=60`,
            {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Accept': 'application/json',
              },
            }
          );

          if (!res.ok) {
            if (res.status === 401) {
              console.warn(`[useAssetUrl] Unauthorized access to ${assetType} for profile ${profileId}`);
            } else if (res.status === 404) {
              // Asset doesn't exist, that's okay
              return null;
            } else {
              console.error(`[useAssetUrl] Failed to fetch ${assetType}:`, res.status);
            }
            return null;
          }

          // Parse JSON response with SAS URL
          const data = await res.json();
          if (data?.url) {
            // Cache the URL (expires 5 minutes before the SAS token expires to be safe)
            const expiresAt = Date.now() + (55 * 60 * 1000); // 55 minutes
            urlCache.set(cacheKey, { url: data.url, expiresAt });
            return data.url;
          }
          return null;
        } catch (error) {
          console.error(`[useAssetUrl] Error fetching ${assetType}:`, error);
          return null;
        } finally {
          // Remove from pending fetches
          pendingFetches.delete(cacheKey);
        }
      })();

      // Store the fetch promise so other hooks can wait for it
      pendingFetches.set(cacheKey, fetchPromise);

      try {
        const result = await fetchPromise;
        if (!cancelled && cacheKeyRef.current === cacheKey && result) {
          setUrl(result);
        } else if (!cancelled && cacheKeyRef.current === cacheKey) {
          setUrl(null);
        }
      } catch {
        if (!cancelled && cacheKeyRef.current === cacheKey) {
          setUrl(null);
        }
      }
    }

    fetchUrl();

    return () => {
      cancelled = true;
    };
  }, [profileId, assetType, enabled]);

  return url;
}

