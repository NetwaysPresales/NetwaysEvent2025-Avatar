import { NextRequest } from 'next/server';
import { HumanMessage } from '@langchain/core/messages';
import { buildAgent } from '@/agent/graph';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const userText = String((body?.userText ?? body?.message) || '').trim();
  const history = Array.isArray(body?.conversationHistory)
    ? body.conversationHistory
    : (Array.isArray(body?.history) ? body.history : []);
  const systemPrompt = body?.systemPrompt ? String(body.systemPrompt) : undefined;

  const agent = buildAgent(systemPrompt);

  const messages = [...history.map((m: string) => new HumanMessage(m)), new HumanMessage(userText)];
  const result = await agent.invoke({ messages });
  const last = result.messages[result.messages.length - 1];
  const reply = last?.content ?? '';

  // Check if get_company_info tool was called by looking for ToolMessage
  let entityLicense: string | null = null;
  let entityDetails: any = null;

  console.log('[API] Checking', result.messages.length, 'messages for entity');
  for (const msg of result.messages) {
    // Check if this is a tool message from get_company_info
    if (msg && typeof msg === 'object' && 'name' in msg && msg.name === 'get_company_info') {
      const toolOutput = String(msg?.content || '');
      // Extract license from tool output
      const match = toolOutput.match(/\[SHOW_ENTITY:([A-Z]+-[\w-]+)\]/i);
      if (match) {
        entityLicense = match[1];
        console.log('[API] Extracted license:', entityLicense);
        break;
      }
    }
  }

  // If we have a license, look up the full entity details dynamically
  if (entityLicense) {
    try {
      const fs = require('fs/promises');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'src', 'knowledge', 'sca_entities.json');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const entities = JSON.parse(fileContent);
      entityDetails = entities.find((e: any) => String(e.license || '').toUpperCase() === entityLicense!.toUpperCase());
      console.log('[API] Found entity details:', entityDetails?.name);
    } catch (err) {
      console.error('[API] Failed to look up entity details:', err);
    }
  }

  console.log('[API] Final entityLicense:', entityLicense);

  return new Response(
    JSON.stringify({ reply, entityLicense, entityDetails }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}


