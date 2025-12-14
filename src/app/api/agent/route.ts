import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profile-service';
import { HumanMessage } from '@langchain/core/messages';
import { buildAgent } from '@/agent/graph';
import fs from 'fs/promises';
import path from 'path';

interface Entity {
  name: string;
  license?: string;
  narration?: string;
  [key: string]: unknown;
}

/**
 * POST /api/agent
 * Process a user message through the LLM agent
 * 
 * Body:
 * - userText: string (required)
 * - profileId: string (required)
 * - conversationHistory?: string[]
 * - systemPrompt?: string
 * 
 * Note: Full agent refactoring (per-user/profile context, conversation persistence)
 * will be implemented when agent factory is created. This is a basic migration
 * with authentication and profile ownership verification.
 */
export async function POST(req: NextRequest) {
  try {
    // Authentication
    const session = await requireAuth();

    const body = await req.json();
    const userText = String((body?.userText ?? body?.message) || '').trim();
    const profileId = body?.profileId;
    const history = Array.isArray(body?.conversationHistory)
      ? body.conversationHistory
      : (Array.isArray(body?.history) ? body.history : []);
    const systemPrompt = body?.systemPrompt ? String(body.systemPrompt) : undefined;

    // Validate required fields
    if (!userText) {
      return NextResponse.json({ error: 'userText is required' }, { status: 400 });
    }

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }

    // Verify profile ownership
    const profile = await getProfile(session.userId, profileId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Build agent (using profile's system prompt if available, otherwise provided one)
    const openAIConfig = profile.openaiConfig as { systemPrompt?: string } | null;
    const effectiveSystemPrompt = systemPrompt || openAIConfig?.systemPrompt;
    const agent = buildAgent(effectiveSystemPrompt);

    // Process message
    const messages = [...history.map((m: string) => new HumanMessage(m)), new HumanMessage(userText)];
    const result = await agent.invoke({ messages });
    const last = result.messages[result.messages.length - 1];
    const reply = last?.content ?? '';

    // Check if get_company_info tool was called by looking for ToolMessage
    let entityLicense: string | null = null;
    let entityDetails: Entity | null = null;

    for (const msg of result.messages) {
      // Check if this is a tool message from get_company_info
      if (msg && typeof msg === 'object' && 'name' in msg && msg.name === 'get_company_info') {
        const toolOutput = String(msg?.content || '');
        // Extract license from tool output
        const match = toolOutput.match(/\[SHOW_ENTITY:([A-Z]+-[\w-]+)\]/i);
        if (match) {
          entityLicense = match[1];
          break;
        }
      }
    }

    // If we have a license, look up the full entity details dynamically
    // NOTE: This uses file system temporarily. Will be replaced with entity visualization system.
    // See CONSOLIDATED_PLAN.md Part 6.5 for the planned entity visualization system.
    if (entityLicense) {
      try {
        const filePath = path.join(process.cwd(), 'src', 'knowledge', 'sca_entities.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const entities: Entity[] = JSON.parse(fileContent);
        entityDetails = entities.find((e) => String(e.license || '').toUpperCase() === entityLicense!.toUpperCase()) || null;
      } catch (err) {
        // Entity lookup failed, but continue without entity details
        console.error('[API] Failed to look up entity details:', err);
      }
    }

    return NextResponse.json({ reply, entityLicense, entityDetails });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API] Agent error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


