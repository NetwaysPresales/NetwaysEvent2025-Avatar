/**
 * Knowledge File Cache
 * 
 * Downloads knowledge files from Blob Storage and caches them on disk.
 * Files are downloaded once when avatar session starts, then read from cache.
 */

import { db } from './db';
import { downloadBlobAsText } from './blob-storage';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

const CACHE_DIR = path.join(process.cwd(), '.cache', 'knowledge');

/**
 * Ensure cache directory exists
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {
    // Directory might already exist, ignore
  }
}

/**
 * Get cache file path for a knowledge file
 */
function getCacheFilePath(userId: string, profileId: string, fileId: string): string {
  const hash = createHash('md5').update(`${userId}-${profileId}-${fileId}`).digest('hex');
  return path.join(CACHE_DIR, `${hash}.txt`);
}

/**
 * Preload all knowledge files for a profile into cache
 * 
 * @param userId - User ID
 * @param profileId - Profile ID
 * @returns Array of cached file contents
 */
export async function preloadKnowledgeFiles(
  userId: string,
  profileId: string
): Promise<Array<{ filename: string; content: string }>> {
  await ensureCacheDir();

  // Get all knowledge files for this profile
  const knowledgeFiles = await db.knowledgeFile.findMany({
    where: {
      userId,
      profileId,
    },
    orderBy: {
      uploadedAt: 'asc',
    },
  });

  if (knowledgeFiles.length === 0) {
    return [];
  }

  const cachedFiles: Array<{ filename: string; content: string }> = [];

  // Download and cache each file
  for (const file of knowledgeFiles) {
    try {
      const cachePath = getCacheFilePath(userId, profileId, file.id);
      
      // Check if already cached (and not stale - could add timestamp check later)
      try {
        const cachedContent = await fs.readFile(cachePath, 'utf-8');
        cachedFiles.push({ filename: file.filename, content: cachedContent });
        continue;
      } catch {
        // Not cached, download it
      }

      // Download from Blob Storage
      const content = await downloadBlobAsText(file.blobUrl);
      
      // Format based on file type
      let formattedContent = content;
      const fileExtension = file.filename.split('.').pop()?.toLowerCase();
      if (fileExtension === 'json') {
        try {
          const parsed = JSON.parse(content);
          formattedContent = JSON.stringify(parsed, null, 2);
        } catch {
          // If parsing fails, use raw content
          formattedContent = content;
        }
      }

      // Cache to disk
      await fs.writeFile(cachePath, formattedContent, 'utf-8');
      
      cachedFiles.push({ filename: file.filename, content: formattedContent });
    } catch (error) {
      console.error(`[Knowledge Cache] Failed to cache knowledge file ${file.filename}:`, error);
      // Continue with other files even if one fails
    }
  }

  return cachedFiles;
}

/**
 * Get cached knowledge file content
 * 
 * @param userId - User ID
 * @param profileId - Profile ID
 * @returns Array of cached file contents
 */
export async function getCachedKnowledgeFiles(
  userId: string,
  profileId: string
): Promise<Array<{ filename: string; content: string }>> {
  await ensureCacheDir();

  // Get all knowledge files for this profile
  const knowledgeFiles = await db.knowledgeFile.findMany({
    where: {
      userId,
      profileId,
    },
    orderBy: {
      uploadedAt: 'asc',
    },
  });

  if (knowledgeFiles.length === 0) {
    return [];
  }

  const cachedFiles: Array<{ filename: string; content: string }> = [];

  // Read from cache
  for (const file of knowledgeFiles) {
    try {
      const cachePath = getCacheFilePath(userId, profileId, file.id);
      const content = await fs.readFile(cachePath, 'utf-8');
      cachedFiles.push({ filename: file.filename, content });
    } catch (error) {
      console.error(`[Knowledge Cache] Failed to read cached file ${file.filename}:`, error);
      // If cache miss, file wasn't preloaded - skip it
    }
  }

  return cachedFiles;
}

/**
 * Clear cache for a profile
 */
export async function clearKnowledgeCache(userId: string, profileId: string): Promise<void> {
  try {
    const knowledgeFiles = await db.knowledgeFile.findMany({
      where: { userId, profileId },
      select: { id: true },
    });

    for (const file of knowledgeFiles) {
      const cachePath = getCacheFilePath(userId, profileId, file.id);
      try {
        await fs.unlink(cachePath);
      } catch {
        // File might not exist, ignore
      }
    }
  } catch (error) {
    console.error('[Knowledge Cache] Failed to clear cache:', error);
  }
}

