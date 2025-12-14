/**
 * Knowledge Files Cache Hook
 * 
 * Client-side caching for knowledge files, similar to useMediaUrl.
 * Preloads and caches knowledge files when a profile is selected.
 */

'use client';

import { useState, useEffect, useRef } from 'react';

// Cache for knowledge files: key = profileId, value = { files, expiresAt }
const knowledgeCache = new Map<string, { files: Array<{ id: string; filename: string; content: string; uploadedAt: string }>; expiresAt: number }>();
const pendingFetches = new Map<string, Promise<Array<{ id: string; filename: string; content: string; uploadedAt: string }>>>();

/**
 * Clear cached knowledge files for a profile
 */
export function clearKnowledgeCache(profileId: string) {
  knowledgeCache.delete(profileId);
  pendingFetches.delete(profileId);
}

/**
 * Clear all cached knowledge files
 */
export function clearAllKnowledgeCache() {
  knowledgeCache.clear();
  pendingFetches.clear();
}

/**
 * React hook for fetching and caching knowledge files
 * 
 * @param profileId - Profile ID to fetch knowledge files for
 * @param enabled - Whether to fetch (default: true)
 * @returns Array of knowledge files with content, or null if loading/error
 */
export function useKnowledgeCache(
  profileId: string | null,
  enabled: boolean = true
): Array<{ id: string; filename: string; content: string; uploadedAt: string }> | null {
  const [files, setFiles] = useState<Array<{ id: string; filename: string; content: string; uploadedAt: string }> | null>(null);
  const currentProfileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !profileId) {
      setFiles(null);
      currentProfileIdRef.current = null;
      return;
    }

    currentProfileIdRef.current = profileId;

    const fetchKnowledge = async () => {
      // Check cache first
      const cached = knowledgeCache.get(profileId);
      if (cached && cached.expiresAt > Date.now()) {
        if (currentProfileIdRef.current === profileId) {
          setFiles(cached.files);
        }
        return;
      }

      // If already fetching, wait for it
      if (pendingFetches.has(profileId)) {
        try {
          const fetchedFiles = await pendingFetches.get(profileId);
          if (currentProfileIdRef.current === profileId) {
            setFiles(fetchedFiles);
          }
        } catch (error) {
          console.error(`[useKnowledgeCache] Error waiting for pending fetch for ${profileId}:`, error);
          if (currentProfileIdRef.current === profileId) {
            setFiles(null);
          }
        }
        return;
      }

      // Start new fetch
      const fetchPromise = (async () => {
        try {
          const res = await fetch(`/api/profiles/${profileId}/knowledge`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
          });

          if (!res.ok) {
            console.error(`[useKnowledgeCache] Failed to fetch knowledge files for ${profileId}:`, res.status);
            return [];
          }

          const data = await res.json();
          if (data?.files) {
            // Cache for 1 hour
            const expiresAt = Date.now() + (60 * 60 * 1000);
            knowledgeCache.set(profileId, { files: data.files, expiresAt });
            return data.files;
          }
          return [];
        } catch (error) {
          console.error(`[useKnowledgeCache] Error fetching knowledge files for ${profileId}:`, error);
          return [];
        } finally {
          pendingFetches.delete(profileId);
        }
      })();

      pendingFetches.set(profileId, fetchPromise);
      const fetchedFiles = await fetchPromise;

      if (currentProfileIdRef.current === profileId) {
        setFiles(fetchedFiles);
      }
    };

    fetchKnowledge();
  }, [profileId, enabled]);

  return files;
}

/**
 * Preload knowledge files for a profile (for eager loading)
 * 
 * @param profileId - Profile ID to preload
 * @returns Promise that resolves when preload is complete
 */
export async function preloadKnowledgeFiles(profileId: string): Promise<void> {
  // Check if already cached
  const cached = knowledgeCache.get(profileId);
  if (cached && cached.expiresAt > Date.now()) {
    return;
  }

  // Check if already fetching
  if (pendingFetches.has(profileId)) {
    await pendingFetches.get(profileId);
    return;
  }

  // Start fetch
  const fetchPromise = (async () => {
    try {
      const res = await fetch(`/api/profiles/${profileId}/knowledge`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) {
        console.error(`[preloadKnowledgeFiles] Failed to preload knowledge files for ${profileId}:`, res.status);
        return [];
      }

      const data = await res.json();
      if (data?.files) {
        const expiresAt = Date.now() + (60 * 60 * 1000);
        knowledgeCache.set(profileId, { files: data.files, expiresAt });
        return data.files;
      }
      return [];
    } catch (error) {
      console.error(`[preloadKnowledgeFiles] Error preloading knowledge files for ${profileId}:`, error);
      return [];
    } finally {
      pendingFetches.delete(profileId);
    }
  })();

  pendingFetches.set(profileId, fetchPromise);
  await fetchPromise;
}

