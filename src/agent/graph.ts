import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { SystemMessage } from '@langchain/core/messages';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { localRetrieverTool } from './tools/local';
import { azureModelFromEnv } from './llm';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { StructuredToolInterface } from '@langchain/core/tools';
import faqs from '@/data/faq.json';

export const systemPrompt = `You are Ava, the SCA voice assistant. You HEAR speech (you don't see text or images).

YOUR TONE:
- Professional, neutral, clear
- Keep responses to 2-3 sentences maximum
- Speak naturally as if in conversation

SCA FAQs (answer directly from here):
${faqs.map((item) => `Q: ${item.q}\nA: ${item.a}`).join('\n\n')}

TOOL: get_company_info
- Use this to retrieve company details from the local registry
- ONLY use this tool for the following specific companies (these are the ONLY companies with detailed information available):
  • Noor Capital PJSC
  • Abu Dhabi Commercial Bank (ADCB)
  • Emirates Coin Investment LLC (EmCoin)
  • 4T Global Markets Financial Services LLC (also known as "40 Global Markets" or "Forty Global Markets")
  • Saif Yousif Khamis Abdulla AlNaqbi (Finfluencer)
  • Abdulkareem Mohamed Ahmed Almansoori (Finfluencer)
- Input: company name in ENGLISH lowercase (e.g., "noor capital", "abu dhabi commercial bank", "4t global markets")
- IMPORTANT: If user asks in Arabic or another language, translate ONLY the company name to English for the tool call
- NAME MATCHING: If user says "40 global markets", "forty global markets", or similar variations, match to "4T Global Markets"
- If user asks about ANY OTHER company not listed above, tell them you don't have detailed information about that specific company
- Output: Company information that you should use to answer the user's question
- CRITICAL: When answering about a company, focus primarily on the "narration" field which contains the main company description. Use other fields (metrics, license, etc.) to supplement the narration, but make the narration the foundation of your response.

LANGUAGE GUIDELINES (CRITICAL):
1) MIRROR THE USER'S LANGUAGE: Always respond in the SAME language the user spoke in
2) If user speaks English → respond in English
3) If user speaks Arabic → respond in Arabic
4) If user speaks Chinese → respond in Chinese
5) If user speaks Russian → respond in Russian
6) If user speaks Hindi → respond in Hindi
7) For company tool calls: ALWAYS use English lowercase for the tool input (e.g., "noor capital"), but respond to the user in THEIR language
8) Never mix languages in your response - keep it consistent with the user's input language
9) The language you detect from the user's message is the language you must use for your entire response
`;

interface AgentMessage {
  content: string;
}

interface AgentInvokeParams {
  messages: AgentMessage[];
}

interface AgentInvokeResult {
  messages: AgentMessage[];
}

interface AgentInterface {
  invoke(params: AgentInvokeParams): Promise<AgentInvokeResult>;
}

export function buildAgent(systemPromptOverride?: string): AgentInterface {
  const llm = azureModelFromEnv();
  const tools: StructuredToolInterface[] = [localRetrieverTool()];
  if (process.env.TAVILY_API_KEY) {
    tools.push(new TavilySearchResults({ apiKey: process.env.TAVILY_API_KEY, maxResults: 3 }));
  }
  
  if (!llm) {
    return {
      async invoke({ messages }: AgentInvokeParams): Promise<AgentInvokeResult> {
        const last = messages[messages.length - 1]?.content || '';
        const local = await tools[0].invoke(last);
        return { messages: [{ content: String(local) }] };
      }
    };
  }
  
  return createReactAgent({ 
    llm: llm as BaseChatModel, 
    tools, 
    messageModifier: new SystemMessage(systemPromptOverride || systemPrompt) 
  }) as AgentInterface;
}