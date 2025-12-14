/**
 * Unified Media Service
 * 
 * Centralized service for generating authenticated SAS URLs for any blob URL.
 * Handles ownership verification and supports all container types:
 * - avatar-assets (profile logos/backgrounds)
 * - entity-media (entity images/videos)
 * - knowledge-files (knowledge base files)
 * - profile-backups (profile backups)
 * 
 * This service replaces the previous getAssetUrl() function and extends it
 * to work with any blob URL, not just profile assets.
 */

import { db } from './db';
import { 
  extractBlobName, 
  extractContainerName, 
  CONTAINERS,
  type ContainerName 
} from './blob-storage';
import { 
  BlobServiceClient, 
  StorageSharedKeyCredential, 
  generateBlobSASQueryParameters, 
  BlobSASPermissions 
} from '@azure/storage-blob';
import { getSecret } from './secrets';

/**
 * Verify ownership/access to a blob URL
 * 
 * @param userId - User ID
 * @param blobUrl - Blob URL to verify
 * @returns true if user has access, false otherwise
 */
async function verifyBlobAccess(userId: string, blobUrl: string): Promise<boolean> {
  try {
    const containerName = extractContainerName(blobUrl);
    const blobName = extractBlobName(blobUrl);
    
    // Extract userId and profileId from blob path
    // Path format: {container}/{userId}/{profileId}/...
    const pathParts = blobName.split('/');
    if (pathParts.length < 2) {
      return false;
    }
    
    const blobUserId = pathParts[0];
    const profileId = pathParts[1];
    
    // Verify the blob belongs to this user
    if (blobUserId !== userId) {
      return false;
    }
    
    // Verify profile ownership
    const profile = await db.profile.findFirst({
      where: {
        id: profileId,
        userId: userId,
      },
      select: {
        id: true,
      },
    });
    
    if (!profile) {
      return false;
    }
    
    // For entity-media, verify entity ownership
    if (containerName === CONTAINERS.ENTITY_MEDIA) {
      // Path: {userId}/{profileId}/{entityId}/{fieldId}/...
      if (pathParts.length < 3) {
        return false;
      }
      const entityId = pathParts[2];
      
      const entity = await db.entity.findFirst({
        where: {
          id: entityId,
          userId: userId,
          profileId: profileId,
        },
        select: {
          id: true,
        },
      });
      
      if (!entity) {
        return false;
      }
    }
    
    // For knowledge-files, verify knowledge file ownership
    if (containerName === CONTAINERS.KNOWLEDGE_FILES) {
      // Find knowledge file by blob URL
      const knowledgeFile = await db.knowledgeFile.findFirst({
        where: {
          blobUrl: blobUrl,
          userId: userId,
          profileId: profileId,
        },
        select: {
          id: true,
        },
      });
      
      if (!knowledgeFile) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('[MediaService] Error verifying blob access:', error);
    return false;
  }
}

/**
 * Generate a SAS URL for any blob URL
 * Verifies ownership/access before generating the SAS token.
 * 
 * @param userId - User ID (for ownership verification)
 * @param blobUrl - Blob URL to generate SAS URL for
 * @param options - Options for SAS URL generation
 * @returns SAS URL with expiration
 * @throws Error if blob URL is invalid, access denied, or SAS generation fails
 */
export async function getMediaUrl(
  userId: string,
  blobUrl: string,
  options: {
    expiresInMinutes?: number;
    verifyOwnership?: boolean;
  } = {}
): Promise<string> {
  const { expiresInMinutes = 60, verifyOwnership = true } = options;
  
  if (!blobUrl) {
    throw new Error('Blob URL is required');
  }
  
  // Validate blob URL format
  let url: URL;
  try {
    url = new URL(blobUrl);
  } catch (error) {
    throw new Error('Invalid blob URL format');
  }
  
  // Verify it's an Azure Blob Storage URL
  if (!url.hostname.includes('.blob.core.windows.net')) {
    throw new Error('Invalid blob storage URL');
  }
  
  // Verify ownership if requested
  if (verifyOwnership) {
    const hasAccess = await verifyBlobAccess(userId, blobUrl);
    if (!hasAccess) {
      throw new Error('Unauthorized: Access denied to this blob');
    }
  }
  
  // Extract container and blob name
  const containerName = extractContainerName(blobUrl);
  const blobName = extractBlobName(blobUrl);
  
  // Get account name from URL
  const accountName = url.hostname.split('.')[0];
  
  // Get account key for SAS token generation
  let accountKey: string | undefined;
  
  // Method 1: Extract from connection string (most common)
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connectionString) {
    const keyMatch = connectionString.match(/AccountKey=([^;]+)/);
    if (keyMatch) {
      accountKey = keyMatch[1];
    }
  }
  
  // Method 2: Use separate account key (alternative)
  if (!accountKey) {
    accountKey = await getSecret('AZURE_STORAGE_ACCOUNT_KEY');
  }
  
  if (!accountKey) {
    throw new Error(
      'Account key not found for SAS token generation. ' +
      'Set AZURE_STORAGE_CONNECTION_STRING (contains the key) or ' +
      'set AZURE_STORAGE_ACCOUNT_KEY in environment variables/Key Vault.'
    );
  }
  
  // Generate SAS token
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'), // Read only
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
    },
    sharedKeyCredential
  ).toString();
  
  // Build SAS URL
  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    sharedKeyCredential
  );
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  
  return `${blockBlobClient.url}?${sasToken}`;
}

/**
 * Batch generate SAS URLs for multiple blob URLs
 * 
 * @param userId - User ID
 * @param blobUrls - Array of blob URLs
 * @param options - Options for SAS URL generation
 * @returns Map of blob URL to SAS URL
 */
export async function getMediaUrls(
  userId: string,
  blobUrls: string[],
  options: {
    expiresInMinutes?: number;
    verifyOwnership?: boolean;
  } = {}
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  // Process in parallel (with reasonable concurrency)
  const promises = blobUrls.map(async (blobUrl) => {
    try {
      const sasUrl = await getMediaUrl(userId, blobUrl, options);
      results.set(blobUrl, sasUrl);
    } catch (error) {
      console.error(`[MediaService] Failed to generate SAS URL for ${blobUrl}:`, error);
      // Don't add to results on error
    }
  });
  
  await Promise.all(promises);
  
  return results;
}

