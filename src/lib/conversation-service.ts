/**
 * Conversation Service
 * 
 * Handles conversation persistence in the database.
 * Conversations are linked to profiles and users for proper isolation.
 */

import { db, transaction } from './db';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Get or create a conversation for a profile
 * 
 * @param userId - User ID
 * @param profileId - Profile ID
 * @param conversationId - Optional existing conversation ID
 * @returns Conversation ID
 */
export async function getOrCreateConversation(
  userId: string,
  profileId: string,
  conversationId?: string
): Promise<string> {
  // If conversationId provided, verify it belongs to this user/profile
  if (conversationId) {
    const existing = await db.conversation.findFirst({
      where: {
        id: conversationId,
        userId,
        profileId,
      },
    });
    
    if (existing) {
      return conversationId;
    }
    // If not found or doesn't match, create new
  }

  // Create new conversation
  const conversation = await transaction(async (tx) => {
    return await tx.conversation.create({
      data: {
        userId,
        profileId,
      },
    });
  });

  return conversation.id;
}

/**
 * Load conversation messages from database
 * 
 * @param conversationId - Conversation ID
 * @param userId - User ID (for ownership verification)
 * @returns Array of messages
 */
export async function loadConversationMessages(
  conversationId: string,
  userId: string
): Promise<ConversationMessage[]> {
  try {
    const conversation = await db.conversation.findFirst({
      where: {
        id: conversationId,
        userId, // CRITICAL: Ensures user can only access their own conversations
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!conversation) {
      // Conversation doesn't exist or user doesn't have access
      return [];
    }

    return conversation.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));
  } catch (error) {
    console.error('[Conversation Service] Failed to load messages:', error);
    return []; // Return empty array on error to allow conversation to continue
  }
}

/**
 * Save messages to conversation
 * 
 * @param conversationId - Conversation ID
 * @param userId - User ID (for ownership verification)
 * @param messages - Messages to save
 */
export async function saveConversationMessages(
  conversationId: string,
  userId: string,
  messages: ConversationMessage[]
): Promise<void> {
  // Verify ownership
  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found or unauthorized');
  }

  // Save messages
  await transaction(async (tx) => {
    // Delete existing messages (we'll replace with full history)
    await tx.conversationMessage.deleteMany({
      where: {
        conversationId,
      },
    });

    // Insert new messages
    await tx.conversationMessage.createMany({
      data: messages.map((msg) => ({
        conversationId,
        role: msg.role,
        content: msg.content,
      })),
    });

    // Update conversation timestamp
    await tx.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        updatedAt: new Date(),
      },
    });
  });
}

/**
 * Get recent conversations for a profile
 * 
 * @param userId - User ID
 * @param profileId - Profile ID
 * @param limit - Maximum number of conversations to return
 * @returns Array of conversation summaries
 */
export async function getRecentConversations(
  userId: string,
  profileId: string,
  limit: number = 10
): Promise<Array<{ id: string; createdAt: Date; updatedAt: Date; messageCount: number }>> {
  const conversations = await db.conversation.findMany({
    where: {
      userId,
      profileId,
    },
    include: {
      _count: {
        select: {
          messages: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: limit,
  });

  return conversations.map((conv) => ({
    id: conv.id,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messageCount: conv._count.messages,
  }));
}

