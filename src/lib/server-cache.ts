/**
 * Server-Side In-Memory Cache
 * 
 * Caches knowledge files and entities in memory on the server.
 * This allows the agent route to use cached data instead of querying the database every time.
 * 
 * Cache is keyed by userId-profileId combination.
 */

// Cache for knowledge files: key = `${userId}-${profileId}`, value = { files, expiresAt, lastModified }
// lastModified is the max uploadedAt timestamp from the database
const knowledgeCache = new Map<string, { files: Array<{ filename: string; content: string }>; expiresAt: number; lastModified: number }>();

// Cache for entities: key = `${userId}-${profileId}`, value = { entities, expiresAt, lastModified }
// lastModified is the max updatedAt timestamp from the database
const entityCache = new Map<string, { entities: Array<{ id: string; name: string }>; expiresAt: number; lastModified: number }>();

/**
 * Get cache key for a user-profile combination
 */
function getCacheKey(userId: string, profileId: string): string {
  return `${userId}-${profileId}`;
}

/**
 * Set cached knowledge files
 */
export function setCachedKnowledgeFiles(
  userId: string,
  profileId: string,
  files: Array<{ filename: string; content: string }>,
  lastModified: number, // Max uploadedAt timestamp from database
  expiresInMinutes: number = 60
): void {
  const key = getCacheKey(userId, profileId);
  const expiresAt = Date.now() + (expiresInMinutes * 60 * 1000);
  knowledgeCache.set(key, { files, expiresAt, lastModified });
}

/**
 * Get cached knowledge files
 * 
 * @param userId - User ID
 * @param profileId - Profile ID
 * @param currentLastModified - Current max uploadedAt timestamp from database (optional, for validation)
 * @returns Cached files or null if not cached/expired/stale
 */
export function getCachedKnowledgeFiles(
  userId: string,
  profileId: string,
  currentLastModified?: number
): Array<{ filename: string; content: string }> | null {
  const key = getCacheKey(userId, profileId);
  const cached = knowledgeCache.get(key);
  
  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    // Expired, remove from cache
    knowledgeCache.delete(key);
    return null;
  }

  // If currentLastModified is provided, check if database has newer data
  if (currentLastModified !== undefined && cached.lastModified < currentLastModified) {
    // Database has newer data, invalidate cache
    knowledgeCache.delete(key);
    return null;
  }

  return cached.files;
}

/**
 * Clear cached knowledge files for a profile
 */
export function clearCachedKnowledgeFiles(userId: string, profileId: string): void {
  const key = getCacheKey(userId, profileId);
  knowledgeCache.delete(key);
}

/**
 * Set cached entities
 */
export function setCachedEntities(
  userId: string,
  profileId: string,
  entities: Array<{ id: string; name: string }>,
  lastModified: number, // Max updatedAt timestamp from database
  expiresInMinutes: number = 60
): void {
  const key = getCacheKey(userId, profileId);
  const expiresAt = Date.now() + (expiresInMinutes * 60 * 1000);
  entityCache.set(key, { entities, expiresAt, lastModified });
}

/**
 * Get cached entities
 * 
 * @param userId - User ID
 * @param profileId - Profile ID
 * @param currentLastModified - Current max updatedAt timestamp from database (optional, for validation)
 * @returns Cached entities or null if not cached/expired/stale
 */
export function getCachedEntities(
  userId: string,
  profileId: string,
  currentLastModified?: number
): Array<{ id: string; name: string }> | null {
  const key = getCacheKey(userId, profileId);
  const cached = entityCache.get(key);
  
  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    // Expired, remove from cache
    entityCache.delete(key);
    return null;
  }

  // If currentLastModified is provided, check if database has newer data
  if (currentLastModified !== undefined && cached.lastModified < currentLastModified) {
    // Database has newer data, invalidate cache
    entityCache.delete(key);
    return null;
  }

  return cached.entities;
}

/**
 * Clear cached entities for a profile
 */
export function clearCachedEntities(userId: string, profileId: string): void {
  const key = getCacheKey(userId, profileId);
  entityCache.delete(key);
}

/**
 * Clear all caches for a profile
 */
export function clearAllCaches(userId: string, profileId: string): void {
  clearCachedKnowledgeFiles(userId, profileId);
  clearCachedEntities(userId, profileId);
}

