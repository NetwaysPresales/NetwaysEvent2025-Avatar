import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { buildSystemPromptWithKnowledge, buildSystemPromptWithEntities } from '@/lib/knowledge-service';
import {
  getOrCreateConversation,
  loadConversationMessages,
  saveConversationMessages,
} from '@/lib/conversation-service';
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { buildAgent } from '@/agent/graph';
import type { EntityVisualizationResult, EntityVisualizationResponse } from '@/types/entity-visualization';

/**
 * POST /api/agent
 * Process a user message through the LLM agent
 * 
 * Body:
 * - userText: string (required)
 * - profileId: string (required)
 * - conversationId?: string (optional - if not provided, creates new conversation)
 * - systemPrompt?: string (optional - overrides profile system prompt)
 * 
 * Returns:
 * - reply: string
 * - conversationId: string
 * - entityLicense?: string (if entity visualization triggered)
 * - entityDetails?: Entity (if entity visualization triggered)
 */
export async function POST(req: NextRequest) {
  try {
    // Authentication
    const session = await requireAuth();

    const body = await req.json();
    const userText = String((body?.userText ?? body?.message) || '').trim();
    const profileId = body?.profileId;
    const conversationId = body?.conversationId ? String(body.conversationId) : undefined;
    const systemPrompt = body?.systemPrompt ? String(body.systemPrompt) : undefined;

    // Validate required fields
    if (!userText || typeof userText !== 'string' || userText.trim().length === 0) {
      return NextResponse.json({ error: 'userText is required and must be a non-empty string' }, { status: 400 });
    }

    if (!profileId || typeof profileId !== 'string') {
      return NextResponse.json({ error: 'profileId is required and must be a valid string' }, { status: 400 });
    }

    // Verify profile ownership
    const profile = await getProfile(session.userId, profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found or unauthorized' }, { status: 404 });
    }

    // Get or create conversation
    const effectiveConversationId = await getOrCreateConversation(
      session.userId,
      profileId,
      conversationId
    );

    // Load conversation history from database
    const conversationMessages = await loadConversationMessages(
      effectiveConversationId,
      session.userId
    );

    // Build agent (using profile's system prompt if available, otherwise provided one)
    const openAIConfig = profile.openaiConfig as { systemPrompt?: string } | null;
    let baseSystemPrompt = systemPrompt || openAIConfig?.systemPrompt || '';
    
    // HACK: Inject knowledge files from cache into system prompt
    // TODO: Replace with Azure AI Search integration when ready
    baseSystemPrompt = await buildSystemPromptWithKnowledge(
      session.userId,
      profileId,
      baseSystemPrompt
    );
    
    // Inject available entity information into system prompt
    baseSystemPrompt = await buildSystemPromptWithEntities(
      session.userId,
      profileId,
      baseSystemPrompt
    );
    
    const agent = buildAgent({
      systemPrompt: baseSystemPrompt,
      userId: session.userId,
      profileId,
    });

    // Convert conversation messages to LangChain messages
    const langchainMessages = conversationMessages.map((msg) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      }
      // Skip system messages in history (they're in the system prompt)
      return null;
    }).filter((msg): msg is HumanMessage | AIMessage => msg !== null);

    // Add current user message
    langchainMessages.push(new HumanMessage(userText));

    // Process message
    let result;
    let reply = '';
    
    try {
      result = await agent.invoke({ messages: langchainMessages });
      const last = result.messages[result.messages.length - 1];
      reply = String(last?.content ?? '').trim();
      
      if (!reply) {
        console.warn('[API] Agent returned empty reply');
        reply = 'I apologize, but I was unable to generate a response. Please try again.';
      }
    } catch (error) {
      console.error('[API] Agent invocation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      reply = `I encountered an error while processing your request: ${errorMessage}. Please try again.`;
      // Create a minimal result structure for error handling
      result = { messages: [] };
    }

    // Check if get_entity tool was called with visualize=true
    let entityVisualization: EntityVisualizationResponse | null = null;

    // Search through all messages to find visualize_entity tool calls
    // Process in reverse to get the most recent visualization
    for (let i = result.messages.length - 1; i >= 0; i--) {
      const msg = result.messages[i];
      if (msg instanceof ToolMessage && msg.name === 'visualize_entity') {
        try {
          const parsed = JSON.parse(msg.content);
          // If visualize_entity was called, it always visualizes (that's what it does!)
          if (parsed.found === true && parsed.entityId) {
            // Validate the structure matches our expected format
            if (parsed.visualizationData && parsed.entityName && parsed.agentContext) {
              entityVisualization = {
                entityId: parsed.entityId,
                entityName: parsed.entityName,
                visualizationData: parsed.visualizationData,
                agentContext: parsed.agentContext,
                visualize: true,
              };
              // Use the most recent visualization found
              break;
            }
          }
        } catch (error) {
          // Tool message might not be JSON, that's okay - skip it
          console.error('[API] Failed to parse entity tool response:', error);
        }
      }
    }

    // Save conversation to database (user message + assistant reply)
    // Only save if we got a valid reply
    if (reply) {
      try {
        const updatedMessages = [
          ...conversationMessages,
          { role: 'user' as const, content: userText },
          { role: 'assistant' as const, content: reply },
        ];
        
        await saveConversationMessages(
          effectiveConversationId,
          session.userId,
          updatedMessages
        );
      } catch (error) {
        // Log but don't fail the request if saving history fails
        console.error('[API] Failed to save conversation history:', error);
      }
    }

    return NextResponse.json({
      reply,
      conversationId: effectiveConversationId,
      entityVisualization,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Agent error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


