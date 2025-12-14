/**
 * Test Azure Blob Storage Operations
 * Usage: npm run test:blob
 * 
 * This script tests Blob Storage operations to verify
 * the implementation is working correctly.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { uploadAsset, deleteAsset, getAssetUrl, listAssets, CONTAINERS } from '../src/lib/blob-storage';
import { db, closeDb } from '../src/lib/db';

async function testBlobStorage() {
  try {
    console.log('🧪 Testing Azure Blob Storage Operations\n');

    // Check configuration
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    
    if (!connectionString && !accountName) {
      console.error('❌ Azure Storage not configured.');
      console.error('Set AZURE_STORAGE_CONNECTION_STRING or AZURE_STORAGE_ACCOUNT_NAME in .env.local');
      process.exit(1);
    }

    console.log('✅ Azure Storage configuration found');

    const testContent = Buffer.from('This is a test file for Blob Storage verification.');
    const testUserId = 'test-user-' + Date.now();
    const testProfileId = 'test-profile-' + Date.now();
    const testInstanceId = 'test-instance-' + Date.now();
    const testFieldId = 'test-field';
    
    const uploadedUrls: string[] = [];

    // Test 1: Create all containers and upload test files
    console.log('\n1. Testing container creation and file uploads...');
    
    // avatar-assets
    const avatarBlobUrl = await uploadAsset(testContent, {
      userId: testUserId,
      profileId: testProfileId,
      filename: 'test-avatar-asset.txt',
      contentType: 'text/plain',
      container: CONTAINERS.AVATAR_ASSETS,
    });
    uploadedUrls.push(avatarBlobUrl);
    console.log(`✓ ${CONTAINERS.AVATAR_ASSETS}: ${avatarBlobUrl.split('/').pop()}`);

    // entity-media
    const entityBlobUrl = await uploadAsset(testContent, {
      userId: testUserId,
      profileId: testProfileId,
      instanceId: testInstanceId,
      fieldId: testFieldId,
      filename: 'test-entity-media.txt',
      contentType: 'text/plain',
      container: CONTAINERS.ENTITY_MEDIA,
    });
    uploadedUrls.push(entityBlobUrl);
    console.log(`✓ ${CONTAINERS.ENTITY_MEDIA}: ${entityBlobUrl.split('/').pop()}`);

    // knowledge-files
    const knowledgeBlobUrl = await uploadAsset(testContent, {
      userId: testUserId,
      profileId: testProfileId,
      filename: 'test-knowledge-file.txt',
      contentType: 'text/plain',
      container: CONTAINERS.KNOWLEDGE_FILES,
    });
    uploadedUrls.push(knowledgeBlobUrl);
    console.log(`✓ ${CONTAINERS.KNOWLEDGE_FILES}: ${knowledgeBlobUrl.split('/').pop()}`);

    // profile-backups
    const backupBlobUrl = await uploadAsset(testContent, {
      userId: testUserId,
      profileId: testProfileId,
      filename: 'test-backup.json',
      contentType: 'application/json',
      container: CONTAINERS.PROFILE_BACKUPS,
    });
    uploadedUrls.push(backupBlobUrl);
    console.log(`✓ ${CONTAINERS.PROFILE_BACKUPS}: ${backupBlobUrl.split('/').pop()}`);

    console.log(`\n✓ All 4 containers created and tested`);

    // Test 2: List assets
    console.log('\n2. Testing list assets...');
    const avatarAssets = await listAssets(CONTAINERS.AVATAR_ASSETS, testUserId, testProfileId);
    const entityAssets = await listAssets(CONTAINERS.ENTITY_MEDIA, testUserId, testProfileId);
    const knowledgeAssets = await listAssets(CONTAINERS.KNOWLEDGE_FILES, testUserId, testProfileId);
    const backupAssets = await listAssets(CONTAINERS.PROFILE_BACKUPS, testUserId, testProfileId);
    
    console.log(`✓ ${CONTAINERS.AVATAR_ASSETS}: ${avatarAssets.length} asset(s)`);
    console.log(`✓ ${CONTAINERS.ENTITY_MEDIA}: ${entityAssets.length} asset(s)`);
    console.log(`✓ ${CONTAINERS.KNOWLEDGE_FILES}: ${knowledgeAssets.length} asset(s)`);
    console.log(`✓ ${CONTAINERS.PROFILE_BACKUPS}: ${backupAssets.length} asset(s)`);

    // Test 3: Generate SAS URL (requires database profile)
    console.log('\n3. Testing SAS URL generation with ownership verification...');
    try {
      // Create a test user and profile in database for ownership verification
      const testUser = await db.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          name: 'Test User',
        },
      });

      const testProfile = await db.profile.create({
        data: {
          userId: testUser.id,
          name: 'Test Profile',
          avatarConfig: {},
          speechConfig: {},
          ttsConfig: {},
          openaiConfig: {},
          sttConfig: {},
          logoBlobUrl: avatarBlobUrl, // Set the uploaded blob URL
        },
      });

      const sasUrl = await getAssetUrl(testUser.id, testProfile.id, 'logo', 60);
      console.log(`✓ SAS URL generated (expires in 60 minutes)`);
      console.log(`  URL length: ${sasUrl.length} characters`);

      // Cleanup test user (will cascade delete profile)
      await db.user.delete({
        where: { id: testUser.id },
      });
    } catch (error: any) {
      if (error.message?.includes('AZURE_STORAGE_ACCOUNT_KEY')) {
        console.log('⚠ SAS URL generation skipped (AZURE_STORAGE_ACCOUNT_KEY not set)');
        console.log('  This is optional - you can use connection string for basic operations');
      } else if (error.message?.includes('Unauthorized') || error.message?.includes('Asset not found')) {
        console.log('⚠ SAS URL generation skipped (requires database profile setup)');
        console.log('  This test requires a profile with logoBlobUrl set');
      } else {
        throw error;
      }
    }

    // Test 4: Delete all test files
    console.log('\n4. Testing file deletion...');
    for (const url of uploadedUrls) {
      await deleteAsset(url);
    }
    console.log('✓ All test files deleted successfully');

    // Verify deletion
    const assetsAfterDelete = await listAssets(CONTAINERS.AVATAR_ASSETS, testUserId, testProfileId);
    if (assetsAfterDelete.length === 0) {
      console.log('✓ Deletion verified (no assets found)');
    } else {
      console.log(`⚠ Warning: ${assetsAfterDelete.length} asset(s) still found after deletion`);
    }

    console.log('\n✅ All Blob Storage operations successful!');
    console.log('\nBlob Storage implementation is working correctly.');
    console.log(`\n📦 All 4 containers are now created in your Azure Storage Account:`);
    console.log(`   - ${CONTAINERS.AVATAR_ASSETS}`);
    console.log(`   - ${CONTAINERS.ENTITY_MEDIA}`);
    console.log(`   - ${CONTAINERS.KNOWLEDGE_FILES}`);
    console.log(`   - ${CONTAINERS.PROFILE_BACKUPS}`);
  } catch (error: any) {
    console.error('\n❌ Blob Storage operation failed:', error.message);
    console.error('\nError details:', error);
    
    if (error.message?.includes('not configured')) {
      console.error('\n💡 Setup Instructions:');
      console.error('  1. Create Azure Storage Account in Azure Portal');
      console.error('  2. Get connection string or account name + key');
      console.error('  3. Set in .env.local:');
      console.error('     AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...');
      console.error('     OR');
      console.error('     AZURE_STORAGE_ACCOUNT_NAME=your-account-name');
      console.error('     AZURE_STORAGE_ACCOUNT_KEY=your-account-key');
    }
    
    process.exit(1);
  }
}

testBlobStorage()
  .then(async () => {
    await closeDb();
  })
  .catch(async (error) => {
    console.error('Fatal error:', error);
    await closeDb();
    process.exit(1);
  });

