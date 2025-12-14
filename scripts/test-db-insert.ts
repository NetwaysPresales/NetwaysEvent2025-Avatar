/**
 * Test Database Insert Operations
 * Usage: npm run test:db:insert
 * 
 * This script tests inserting data into the database to verify
 * the Prisma implementation is working correctly.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

import { db, closeDb } from '../src/lib/db';

async function testInserts() {
  try {
    console.log('🧪 Testing Database Insert Operations\n');

    // Test 1: Create a test user
    console.log('1. Creating test user...');
    const testUser = await db.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        name: 'Test User',
      },
    });
    console.log(`✓ User created: ${testUser.id} (${testUser.email})`);

    // Test 2: Create a profile for the user
    console.log('\n2. Creating test profile...');
    const testProfile = await db.profile.create({
      data: {
        userId: testUser.id,
        name: 'Test Profile',
        avatarConfig: {
          character: 'Harry',
          style: 'business',
        },
        speechConfig: {
          region: 'westeurope',
          apiKey: 'test-key',
        },
        ttsConfig: {
          voice: 'en-US-AvaMultilingualNeural',
        },
        openaiConfig: {
          endpoint: 'https://test.openai.azure.com',
          apiKey: 'test-key',
          deploymentName: 'gpt-4',
          systemPrompt: 'You are a helpful assistant.',
        },
        sttConfig: {
          locales: ['en-US'],
          continuousConversation: false,
        },
        appTitle: 'Test Avatar App',
        appDescription: 'A test profile for database verification',
        theme: 'light',
        accentColor: {
          primary: '#10b981',
          secondary: '#059669',
        },
      },
    });
    console.log(`✓ Profile created: ${testProfile.id} (${testProfile.name})`);

    // Test 3: Create a knowledge file entry
    console.log('\n3. Creating test knowledge file entry...');
    const testKnowledgeFile = await db.knowledgeFile.create({
      data: {
        userId: testUser.id,
        profileId: testProfile.id,
        filename: 'test-knowledge.md',
        blobUrl: 'https://teststorage.blob.core.windows.net/knowledge/test.md',
        azureSearchIndexed: false,
        chunkCount: 0,
        embeddingModel: 'text-embedding-ada-002',
      },
    });
    console.log(`✓ Knowledge file created: ${testKnowledgeFile.id}`);

    // Test 4: Create an entity template
    console.log('\n4. Creating test entity template...');
    const testEntityTemplate = await db.entityTemplate.create({
      data: {
        userId: testUser.id,
        profileId: testProfile.id,
        name: 'Company Template',
        description: 'Template for company entities',
        structure: {
          sections: [
            {
              id: 'basic-info',
              title: 'Basic Information',
              fields: [
                { id: 'name', type: 'text', label: 'Company Name' },
                { id: 'industry', type: 'text', label: 'Industry' },
              ],
            },
          ],
        },
      },
    });
    console.log(`✓ Entity template created: ${testEntityTemplate.id}`);

    // Test 5: Create an entity instance
    console.log('\n5. Creating test entity instance...');
    const testEntityInstance = await db.entityInstance.create({
      data: {
        userId: testUser.id,
        profileId: testProfile.id,
        templateId: testEntityTemplate.id,
        name: 'Test Company',
        identifier: 'TEST-COMPANY-001',
        description: 'A test company entity',
        data: {
          'basic-info': {
            name: 'Test Company Inc.',
            industry: 'Technology',
          },
        },
        isActive: true,
      },
    });
    console.log(`✓ Entity instance created: ${testEntityInstance.id}`);

    // Test 6: Create a conversation
    console.log('\n6. Creating test conversation...');
    const testConversation = await db.conversation.create({
      data: {
        userId: testUser.id,
        profileId: testProfile.id,
        messages: {
          create: [
            {
              role: 'user',
              content: 'Hello, this is a test message.',
            },
            {
              role: 'assistant',
              content: 'Hello! This is a test response.',
            },
          ],
        },
      },
      include: {
        messages: true,
      },
    });
    console.log(`✓ Conversation created: ${testConversation.id} with ${testConversation.messages.length} messages`);

    // Test 7: Verify data retrieval
    console.log('\n7. Verifying data retrieval...');
    const retrievedUser = await db.user.findUnique({
      where: { id: testUser.id },
      include: {
        profiles: true,
        knowledgeFiles: true,
        entityTemplates: true,
        entityInstances: true,
        conversations: {
          include: {
            messages: true,
          },
        },
      },
    });

    if (retrievedUser) {
      console.log(`✓ User retrieved with:`);
      console.log(`  - ${retrievedUser.profiles.length} profile(s)`);
      console.log(`  - ${retrievedUser.knowledgeFiles.length} knowledge file(s)`);
      console.log(`  - ${retrievedUser.entityTemplates.length} entity template(s)`);
      console.log(`  - ${retrievedUser.entityInstances.length} entity instance(s)`);
      console.log(`  - ${retrievedUser.conversations.length} conversation(s)`);
      
      if (retrievedUser.conversations[0]) {
        console.log(`  - ${retrievedUser.conversations[0].messages.length} message(s) in first conversation`);
      }
    }

    // Test 8: Test transaction
    console.log('\n8. Testing transaction...');
    await db.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({
        where: { id: testProfile.id },
      });
      
      if (profile) {
        await tx.profile.update({
          where: { id: testProfile.id },
          data: {
            appTitle: 'Updated Test Avatar App',
          },
        });
      }
    });
    console.log('✓ Transaction completed successfully');

    // Test 9: Cleanup - Delete test data
    console.log('\n9. Cleaning up test data...');
    await db.user.delete({
      where: { id: testUser.id },
    });
    console.log('✓ Test data cleaned up (CASCADE deleted all related records)');

    console.log('\n✅ All database operations successful!');
    console.log('\nDatabase implementation is working correctly.');
  } catch (error: any) {
    console.error('\n❌ Database operation failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

testInserts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

