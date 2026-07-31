import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { buildSystemPromptWithEntities } from '@/lib/knowledge-service';
import {
  getOrCreateConversation,
  loadConversationMessages,
  saveConversationMessages,
} from '@/lib/conversation-service';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { buildAgent } from '@/agent/graph';
import type { EntityVisualizationResponse } from '@/types/entity-visualization';
import type { AzureOpenAIConfig } from '@/types/avatar';
import type { DocumentVisualization } from '@/types/document-visualization';
import { formatTextForDisplay, takeNextSpeechSegment } from '@/lib/text-processing';

function toolOutputText(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object' && 'content' in output) {
    const content = (output as { content: unknown }).content;
    return typeof content === 'string' ? content : JSON.stringify(content);
  }
  return JSON.stringify(output);
}

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
    const detectedLocale = body?.detectedLocale ? String(body.detectedLocale) : undefined;
    const detectedLanguage = body?.detectedLanguage ? String(body.detectedLanguage) : undefined;

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

    // Build agent (always use profile's system prompt from database, fallback to request or default)
    const openAIConfig = profile.openaiConfig as AzureOpenAIConfig | null;
    // Priority: 1) Request body systemPrompt (if provided), 2) Database systemPrompt, 3) Default from config
    let baseSystemPrompt = systemPrompt || openAIConfig?.systemPrompt || '';

    // If still empty, use default from config (shouldn't happen, but safety fallback)
    if (!baseSystemPrompt) {
      const { getDefaultAzureOpenAIConfig } = await import('@/lib/config');
      baseSystemPrompt = getDefaultAzureOpenAIConfig().systemPrompt;
    }

    if (detectedLocale) {
      baseSystemPrompt += `\n\nCURRENT TURN LANGUAGE:\nThe user's speech was auto-detected as ${detectedLanguage || detectedLocale} (${detectedLocale}). Respond entirely in that language for this turn unless the user explicitly asks for another language.`;
    }

    baseSystemPrompt += `\n\nTOOL SELECTION RULES:
- Do not call knowledge_base, visualize_document, or entity tools for greetings, thanks, introductions, capability questions, or casual conversation.
- Use knowledge_base for substantive questions whose answer depends on profile documents.
- Search results are not a complete inventory. Use knowledge_base with query "list" if the user asks which files are available.
- Call visualize_document at most once per user turn. Select the single strongest evidence page, and only visualize it when seeing the page materially helps. Keep visual evidence open for at least 20 seconds; use 20 seconds when unsure.

VOICE RESPONSE STYLE:
- Be concise by default: answer in 2-5 short sentences or no more than 5 compact bullets.
- Lead with the direct answer. Do not restate the user's question or add a long introduction.
- Include only the policy details needed to answer the request; expand only when the user asks for detail.
- Never put a raw technical filename, file extension, underscore-separated name, chunk number, or a standalone "Source:" line in the answer. The interface displays exact filenames separately.
- Add a short in-text citation immediately after the supported claim, using only forms such as "(HR Policy, p. 35)" or "(Finance Policy, pp. 15-17)."
- Do not write citations as sentences. Citations are display metadata and must not be part of the spoken narrative.
- Write for speech: use short complete sentences, natural commas, and clear sentence-ending punctuation. Expand uncommon abbreviations on first use.
- Do not end with generic offers such as "If you want, I can..." unless a necessary clarification is required.`;

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
      enableVisualizations: profile.showEvidencePanel,
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

    // Process message via Streaming Instead of Invoke
    const stream = new ReadableStream({
      async start(controller) {
        const assistantMessageId = crypto.randomUUID();
        let fullReply = '';
        let displayBuffer = '';
        let entityVisualization: EntityVisualizationResponse | null = null;
        let documentVisualizationSent = false;
        let isAborted = false;
        const preserveTechnicalFilenames = /(?:list|show)\s+(?:their\s+|the\s+)?exact\s+filenames|exact\s+filenames\s+only/i.test(userText);
        const emitDisplayContent = (text: string, separator = '') => {
          const displayText = preserveTechnicalFilenames ? text : formatTextForDisplay(text);
          if (!displayText) return;
          const payload = JSON.stringify({
            event: 'content',
            data: `${displayText}${separator}`,
            messageId: assistantMessageId,
          });
          controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
        };
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
          event: 'conversation',
          data: { conversationId: effectiveConversationId, assistantMessageId, createdAt: new Date().toISOString() },
        })}\n\n`));

        // Cleanup function for database saving
        const cleanupAndSave = async () => {
          if (!fullReply.trim()) return;
          try {
            const updatedMessages = [
              ...conversationMessages,
              { role: 'user' as const, content: userText },
              { role: 'assistant' as const, content: fullReply.trim() },
            ];
            await saveConversationMessages(
              effectiveConversationId,
              session.userId,
              updatedMessages
            );
          } catch (error) {
            console.error('[API] Failed to save conversation history:', error);
          }
        };

        // If client aborts early, save what we have
        req.signal.addEventListener('abort', () => {
          isAborted = true;
          console.log('[API] Client aborted stream. Saving partial reply:', fullReply.length, 'chars');
          cleanupAndSave();
        });

        try {
          const events = await agent.streamEvents(
            { messages: langchainMessages },
            { version: 'v2' }
          );

          for await (const rawEvent of events) {
            if (isAborted) break;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const event = rawEvent as any;

            if (event.event === 'on_tool_start' && event.name === 'knowledge_base') {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                event: 'retrieval',
                data: { status: 'searching' },
              })}\n\n`));
            }

            // Handle standard token chunks
            if (event.event === 'on_chat_model_stream') {
              const chunkText = event.data?.chunk?.content;
              if (typeof chunkText === 'string' && chunkText) {
                fullReply += chunkText;
                displayBuffer += chunkText;
                let nextSegment = takeNextSpeechSegment(displayBuffer);
                while (nextSegment) {
                  const markdownLine = /^\s*(?:#{1,6}\s|[-*•]\s|\d+[.)]\s)/.test(nextSegment.segment);
                  emitDisplayContent(nextSegment.segment, markdownLine ? '\n' : ' ');
                  displayBuffer = nextSegment.remainder;
                  nextSegment = takeNextSpeechSegment(displayBuffer);
                }
              }
            }

            if (event.event === 'on_tool_end' && event.name === 'knowledge_base') {
              const rawOutput = event.data?.output?.content ?? event.data?.output ?? '';
              const output = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput);
              const sourcePattern = /\[Source\s+\d+:\s+([^,\]]+)(?:,\s*page\s+(\d+))?(?:,\s*chunk\s+(\d+))?\]/gi;
              const sources: Array<{ filename: string; page?: number; chunk?: number }> = [];
              let match: RegExpExecArray | null;
              while ((match = sourcePattern.exec(output)) !== null) {
                if (!sources.some((source) => source.filename === match![1] && source.page === Number(match![2]) && source.chunk === Number(match![3]))) {
                  sources.push({ filename: match[1].trim(), ...(match[2] ? { page: Number(match[2]) } : {}), ...(match[3] ? { chunk: Number(match[3]) } : {}) });
                }
              }
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                event: 'sources',
                data: { status: sources.length ? 'grounded' : 'none', sources },
              })}\n\n`));
            }

            if (event.event === 'on_tool_end' && event.name === 'visualize_document' && !documentVisualizationSent) {
              try {
                const parsed = JSON.parse(toolOutputText(event.data?.output)) as DocumentVisualization & { found?: boolean };
                if (parsed.found && parsed.knowledgeFileId && parsed.pageNumber && parsed.documentUrl) {
                  documentVisualizationSent = true;
                  const visualization: DocumentVisualization = {
                    knowledgeFileId: parsed.knowledgeFileId,
                    filename: parsed.filename,
                    pageNumber: parsed.pageNumber,
                    quote: parsed.quote,
                    documentUrl: parsed.documentUrl,
                    displayDurationMs: parsed.displayDurationMs,
                  };
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                    event: 'document',
                    data: visualization,
                  })}\n\n`));
                }
              } catch (error) {
                console.error('[API] Failed to parse document visualization:', error);
              }
            }

            // Handle tool outputs (Entity Visualization)
            if (event.event === 'on_tool_end' && event.name === 'visualize_entity') {
              try {
                const parsed = event.data.output;
                if (parsed?.found === true && parsed?.entityId && parsed?.visualizationData) {
                  entityVisualization = {
                    entityId: parsed.entityId,
                    entityName: parsed.entityName,
                    visualizationData: parsed.visualizationData,
                    agentContext: parsed.agentContext,
                    visualize: true,
                  };

                  const payload = JSON.stringify({
                    event: 'tool',
                    data: entityVisualization,
                  });
                  controller.enqueue(new TextEncoder().encode(`data: ${payload}\n\n`));
                }
              } catch (e) {
                console.error('[API] Failed to parse streaming tool response:', e);
              }
            }
          }

          if (!isAborted) {
            if (displayBuffer.trim()) {
              emitDisplayContent(displayBuffer.trim());
              displayBuffer = '';
            }
            // Stream naturally finished. Save full context.
            const endPayload = JSON.stringify({
              event: 'done',
              conversationId: effectiveConversationId,
              messageId: assistantMessageId,
              completedAt: new Date().toISOString(),
            });
            controller.enqueue(new TextEncoder().encode(`data: ${endPayload}\n\n`));
            await cleanupAndSave();
            controller.close();
          }

        } catch (error) {
          console.error('[API] Agent streaming error:', error);
          if (!isAborted) {
            const errorPayload = JSON.stringify({
              event: 'error',
              data: error instanceof Error ? error.message : 'Streaming failed',
            });
            controller.enqueue(new TextEncoder().encode(`data: ${errorPayload}\n\n`));
            controller.close();
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
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


