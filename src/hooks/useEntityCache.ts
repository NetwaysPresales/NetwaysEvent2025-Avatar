/**
 * Entity Cache Hook
 * 
 * Client-side caching for entities, similar to useMediaUrl.
 * Preloads and caches entities when a profile is selected.
 */

'use client';

import { useState, useEffect, useRef } from 'react';

// Cache for entities: key = profileId, value = { entities, expiresAt }
const entityCache = new Map<string, { entities: any[]; expiresAt: number }>();
const pendingFetches = new Map<string, Promise<any[]>>();

/**
 * Clear cached entities for a profile
 */
export function clearEntityCache(profileId: string) {
  entityCache.delete(profileId);
  pendingFetches.delete(profileId);
}

/**
 * Clear all cached entities
 */
export function clearAllEntityCache() {
  entityCache.clear();
  pendingFetches.clear();
}

/**
 * React hook for fetching and caching entities
 * 
 * @param profileId - Profile ID to fetch entities for
 * @param enabled - Whether to fetch (default: true)
 * @returns Array of entities, or null if loading/error
 */
export function useEntityCache(
  profileId: string | null,
  enabled: boolean = true
): any[] | null {
  const [entities, setEntities] = useState<any[] | null>(null);
  const currentProfileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !profileId) {
      setEntities(null);
      currentProfileIdRef.current = null;
      return;
    }

    currentProfileIdRef.current = profileId;

    const fetchEntities = async () => {
      // Check cache first
      const cached = entityCache.get(profileId);
      if (cached && cached.expiresAt > Date.now()) {
        if (currentProfileIdRef.current === profileId) {
          setEntities(cached.entities);
        }
        return;
      }

      // If already fetching, wait for it
      if (pendingFetches.has(profileId)) {
        try {
          const fetchedEntities = await pendingFetches.get(profileId);
          if (currentProfileIdRef.current === profileId) {
            setEntities(fetchedEntities);
          }
        } catch (error) {
          console.error(`[useEntityCache] Error waiting for pending fetch for ${profileId}:`, error);
          if (currentProfileIdRef.current === profileId) {
            setEntities(null);
          }
        }
        return;
      }

      // Start new fetch
      const fetchPromise = (async () => {
        try {
          const res = await fetch(`/api/profiles/${profileId}/entities`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
          });

          if (!res.ok) {
            console.error(`[useEntityCache] Failed to fetch entities for ${profileId}:`, res.status);
            return [];
          }

          const data = await res.json();
          if (data?.entities) {
            // Cache for 1 hour
            const expiresAt = Date.now() + (60 * 60 * 1000);
            entityCache.set(profileId, { entities: data.entities, expiresAt });
            return data.entities;
          }
          return [];
        } catch (error) {
          console.error(`[useEntityCache] Error fetching entities for ${profileId}:`, error);
          return [];
        } finally {
          pendingFetches.delete(profileId);
        }
      })();

      pendingFetches.set(profileId, fetchPromise);
      const fetchedEntities = await fetchPromise;

      if (currentProfileIdRef.current === profileId) {
        setEntities(fetchedEntities);
      }
    };

    fetchEntities();
  }, [profileId, enabled]);

  return entities;
}

/**
 * Preload entities for a profile (for eager loading)
 * 
 * @param profileId - Profile ID to preload
 * @returns Promise that resolves when preload is complete
 */
export async function preloadEntities(profileId: string): Promise<void> {
  // Check if already cached
  const cached = entityCache.get(profileId);
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
      const res = await fetch(`/api/profiles/${profileId}/entities`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });

      if (!res.ok) {
        console.error(`[preloadEntities] Failed to preload entities for ${profileId}:`, res.status);
        return [];
      }

      const data = await res.json();
      if (data?.entities) {
        const expiresAt = Date.now() + (60 * 60 * 1000);
        entityCache.set(profileId, { entities: data.entities, expiresAt });
        return data.entities;
      }
      return [];
    } catch (error) {
      console.error(`[preloadEntities] Error preloading entities for ${profileId}:`, error);
      return [];
    } finally {
      pendingFetches.delete(profileId);
    }
  })();

  pendingFetches.set(profileId, fetchPromise);
  await fetchPromise;
}

