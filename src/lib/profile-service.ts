/**
 * Profile Service
 * 
 * High-level abstraction layer for profile operations.
 * Handles all database + blob storage operations with proper error handling
 * and transaction-like guarantees.
 * 
 * This service ensures:
 * - If upload succeeds but DB update fails, blob is cleaned up
 * - If DB update succeeds but blob upload fails, operation fails cleanly
 * - All operations verify ownership
 * - Clear error messages for all failure cases
 */

import { db, transaction } from './db';
import { uploadAsset, deleteAsset, CONTAINERS } from './blob-storage';
import { getMediaUrl } from './media-service';
import { getDefaultAvatarConfig, getDefaultSpeechConfig, getDefaultAzureOpenAIConfig, getDefaultTTSConfig } from './config';
import { Prisma } from '@prisma/client';
import type { AvatarConfig, SpeechConfig, TTSConfig, AzureOpenAIConfig, STTConfig } from '@/types/avatar';

export interface CreateProfileInput {
  userId: string;
  name: string;
  avatarConfig?: AvatarConfig;
  speechConfig?: SpeechConfig;
  ttsConfig?: TTSConfig;
  openaiConfig?: AzureOpenAIConfig;
  sttConfig?: STTConfig;
  appTitle?: string;
  appDescription?: string;
  theme?: 'light' | 'dark';
  accentColor?: { r: number; g: number; b: number };
}

export interface UpdateProfileInput {
  name?: string;
  avatarConfig?: AvatarConfig;
  speechConfig?: SpeechConfig;
  ttsConfig?: TTSConfig;
  openaiConfig?: AzureOpenAIConfig;
  sttConfig?: STTConfig;
  appTitle?: string;
  appDescription?: string;
  theme?: 'light' | 'dark';
  accentColor?: { r: number; g: number; b: number };
}

export interface UploadAssetResult {
  blobUrl: string;
  sasUrl: string;
  filename: string;
}

/**
 * Create a new profile
 * 
 * @param input - Profile creation data
 * @returns Created profile
 * @throws Error if user doesn't exist or creation fails
 */
export async function createProfile(input: CreateProfileInput) {
  // Verify user exists
  const user = await db.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Create profile in database
  const profile = await db.profile.create({
    data: {
      userId: input.userId,
      name: input.name,
      avatarConfig: (input.avatarConfig || getDefaultAvatarConfig()) as unknown as Prisma.InputJsonValue,
      speechConfig: (input.speechConfig || getDefaultSpeechConfig()) as unknown as Prisma.InputJsonValue,
      ttsConfig: (input.ttsConfig || getDefaultTTSConfig()) as unknown as Prisma.InputJsonValue,
      openaiConfig: (input.openaiConfig || getDefaultAzureOpenAIConfig()) as unknown as Prisma.InputJsonValue,
      sttConfig: (input.sttConfig || {}) as unknown as Prisma.InputJsonValue,
      appTitle: input.appTitle || 'Azure Avatar App',
      appDescription: input.appDescription || 'Your AI-powered virtual assistant.',
      theme: input.theme || 'light',
      accentColor: input.accentColor || { r: 16, g: 185, b: 129 }, // emerald-500
    },
  });

  return profile;
}

/**
 * Get a profile by ID (with ownership verification)
 * 
 * @param userId - User ID
 * @param profileId - Profile ID
 * @returns Profile or null if not found
 */
export async function getProfile(userId: string, profileId: string) {
  const profile = await db.profile.findFirst({
    where: {
      id: profileId,
      userId: userId,
    },
  });

  return profile;
}

/**
 * List all profiles for a user
 * 
 * @param userId - User ID
 * @returns Array of profiles
 */
export async function listProfiles(userId: string) {
  const profiles = await db.profile.findMany({
    where: {
      userId: userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return profiles;
}

/**
 * Update a profile
 * 
 * @param userId - User ID (for ownership verification)
 * @param profileId - Profile ID
 * @param updates - Fields to update
 * @returns Updated profile
 * @throws Error if profile not found or unauthorized
 */
export async function updateProfile(
  userId: string,
  profileId: string,
  updates: UpdateProfileInput
) {
  // Verify ownership
  const existing = await db.profile.findFirst({
    where: {
      id: profileId,
      userId: userId,
    },
  });

  if (!existing) {
    throw new Error('Profile not found or unauthorized');
  }

  // Update profile
  const profile = await db.profile.update({
    where: {
      id: profileId,
    },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.avatarConfig !== undefined && { avatarConfig: updates.avatarConfig as unknown as Prisma.InputJsonValue }),
      ...(updates.speechConfig !== undefined && { speechConfig: updates.speechConfig as unknown as Prisma.InputJsonValue }),
      ...(updates.ttsConfig !== undefined && { ttsConfig: updates.ttsConfig as unknown as Prisma.InputJsonValue }),
      ...(updates.openaiConfig !== undefined && { openaiConfig: updates.openaiConfig as unknown as Prisma.InputJsonValue }),
      ...(updates.sttConfig !== undefined && { sttConfig: updates.sttConfig as unknown as Prisma.InputJsonValue }),
      ...(updates.appTitle !== undefined && { appTitle: updates.appTitle }),
      ...(updates.appDescription !== undefined && { appDescription: updates.appDescription }),
      ...(updates.theme !== undefined && { theme: updates.theme }),
      ...(updates.accentColor !== undefined && { accentColor: updates.accentColor }),
    },
  });

  return profile;
}

/**
 * Upload a profile asset (logo or background) with transaction-like guarantees
 * 
 * This function ensures:
 * 1. Ownership is verified before upload
 * 2. Old asset is deleted if exists
 * 3. New asset is uploaded to blob storage
 * 4. Database is updated with new blob URL
 * 5. If DB update fails, uploaded blob is cleaned up
 * 6. Returns both blob URL and SAS URL for immediate use
 * 
 * @param userId - User ID (for ownership verification)
 * @param profileId - Profile ID
 * @param assetType - 'logo' | 'background'
 * @param file - File buffer
 * @param filename - Original filename
 * @param contentType - MIME type
 * @returns Upload result with blob URL, SAS URL, and filename
 * @throws Error if upload fails or ownership verification fails
 */
export async function uploadProfileAsset(
  userId: string,
  profileId: string,
  assetType: 'logo' | 'background',
  file: Buffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<UploadAssetResult> {
  // Step 1: Verify ownership BEFORE any operations
  const profile = await db.profile.findFirst({
    where: {
      id: profileId,
      userId: userId,
    },
    select: {
      id: true,
      logoBlobUrl: true,
      backgroundBlobUrl: true,
    },
  });

  if (!profile) {
    throw new Error('Profile not found or unauthorized');
  }

  // Step 2: Get old blob URL (for cleanup)
  const oldBlobUrl = assetType === 'logo' ? profile.logoBlobUrl : profile.backgroundBlobUrl;
  let newBlobUrl: string | null = null;

  try {
    // Step 3: Upload new asset to blob storage
    newBlobUrl = await uploadAsset(file, {
      userId: userId,
      profileId: profileId,
      filename: filename,
      contentType: contentType,
      container: CONTAINERS.AVATAR_ASSETS,
    });

    // Step 4: Update database in transaction
    // If this fails, we'll clean up the uploaded blob in the catch block
    await transaction(async (tx) => {
      await tx.profile.update({
        where: {
          id: profileId,
        },
        data: {
          ...(assetType === 'logo' ? { logoBlobUrl: newBlobUrl } : { backgroundBlobUrl: newBlobUrl }),
        },
      });

      // Delete old asset AFTER successful DB update
      // If DB update succeeds but delete fails, that's okay - old blob will just remain
      // (we can clean it up later with a cleanup job)
      if (oldBlobUrl) {
        await deleteAsset(oldBlobUrl).catch((error) => {
          // Log but don't fail the operation
          console.warn(`Failed to delete old asset ${oldBlobUrl}:`, error);
        });
      }
    });

    // Step 5: Generate SAS URL for immediate use
    const sasUrl = await getMediaUrl(userId, newBlobUrl, { expiresInMinutes: 60 });

    return {
      blobUrl: newBlobUrl,
      sasUrl: sasUrl,
      filename: filename,
    };
  } catch (error) {
    // Step 6: Cleanup: If DB update failed, delete the uploaded blob
    if (newBlobUrl) {
      try {
        await deleteAsset(newBlobUrl);
      } catch (cleanupError) {
        // Log cleanup failure but don't mask the original error
        console.error(`Failed to cleanup uploaded blob ${newBlobUrl}:`, cleanupError);
      }
    }

    // Re-throw original error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to upload asset: ${errorMessage}`);
  }
}

/**
 * Delete a profile asset (logo or background)
 * 
 * @param userId - User ID (for ownership verification)
 * @param profileId - Profile ID
 * @param assetType - 'logo' | 'background'
 * @throws Error if profile not found or unauthorized
 */
export async function deleteProfileAsset(
  userId: string,
  profileId: string,
  assetType: 'logo' | 'background'
) {
  // Verify ownership
  const profile = await db.profile.findFirst({
    where: {
      id: profileId,
      userId: userId,
    },
    select: {
      id: true,
      logoBlobUrl: true,
      backgroundBlobUrl: true,
    },
  });

  if (!profile) {
    throw new Error('Profile not found or unauthorized');
  }

  const blobUrl = assetType === 'logo' ? profile.logoBlobUrl : profile.backgroundBlobUrl;

  if (!blobUrl) {
    // No asset to delete, but that's okay
    return;
  }

  // Delete from blob storage and update DB in transaction
  await transaction(async (tx) => {
    // Update DB first (remove reference)
    await tx.profile.update({
      where: {
        id: profileId,
      },
      data: {
        ...(assetType === 'logo' ? { logoBlobUrl: null } : { backgroundBlobUrl: null }),
      },
    });

    // Then delete from blob storage
    // If delete fails, that's okay - we've already removed the reference
    await deleteAsset(blobUrl).catch((error) => {
      console.warn(`Failed to delete asset ${blobUrl}:`, error);
    });
  });
}

/**
 * Get a SAS URL for a profile asset
 * 
 * @param userId - User ID (for ownership verification)
 * @param profileId - Profile ID
 * @param assetType - 'logo' | 'background'
 * @param expiresInMinutes - Expiration time (default: 60)
 * @returns SAS URL
 * @throws Error if profile not found or asset doesn't exist
 */
export async function getProfileAssetUrl(
  userId: string,
  profileId: string,
  assetType: 'logo' | 'background',
  expiresInMinutes: number = 60
): Promise<string> {
  // Get profile to retrieve blob URL
  const profile = await db.profile.findFirst({
    where: {
      id: profileId,
      userId: userId,
    },
    select: {
      logoBlobUrl: true,
      backgroundBlobUrl: true,
    },
  });

  if (!profile) {
    throw new Error('Profile not found or unauthorized');
  }

  const blobUrl = assetType === 'logo' ? profile.logoBlobUrl : profile.backgroundBlobUrl;
  
  if (!blobUrl) {
    throw new Error(`Asset of type '${assetType}' not found for profile ${profileId}`);
  }

  // Use unified media service to generate SAS URL
  return await getMediaUrl(userId, blobUrl, { expiresInMinutes, verifyOwnership: true });
}

/**
 * Delete a profile and all associated data
 * 
 * This will cascade delete:
 * - Knowledge files (and their blob storage files)
 * - Entity templates and instances (and their blob storage files)
 * - Conversations and messages
 * - Profile backups
 * 
 * Profile assets (logo/background) are also deleted from blob storage.
 * 
 * @param userId - User ID (for ownership verification)
 * @param profileId - Profile ID
 * @throws Error if profile not found or unauthorized
 */
export async function deleteProfile(userId: string, profileId: string) {
  // Verify ownership
  const profile = await db.profile.findFirst({
    where: {
      id: profileId,
      userId: userId,
    },
    select: {
      id: true,
      logoBlobUrl: true,
      backgroundBlobUrl: true,
    },
  });

  if (!profile) {
    throw new Error('Profile not found or unauthorized');
  }

  // Delete assets from blob storage
  const assetsToDelete: string[] = [];
  if (profile.logoBlobUrl) assetsToDelete.push(profile.logoBlobUrl);
  if (profile.backgroundBlobUrl) assetsToDelete.push(profile.backgroundBlobUrl);

  // Delete profile (cascade will handle related records)
  await db.profile.delete({
    where: {
      id: profileId,
    },
  });

  // Clean up blob storage assets (non-blocking)
  // If these fail, that's okay - they're orphaned but can be cleaned up later
  for (const blobUrl of assetsToDelete) {
    await deleteAsset(blobUrl).catch((error) => {
      console.warn(`Failed to delete asset ${blobUrl} during profile deletion:`, error);
    });
  }
}

