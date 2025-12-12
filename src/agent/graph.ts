import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { SystemMessage } from '@langchain/core/messages';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { localRetrieverTool } from './tools/local';
import { knowledgeBaseTool } from './tools/knowledge';
import { azureModelFromEnv } from './llm';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { StructuredToolInterface } from '@langchain/core/tools';

export const systemPrompt = `You are a helpful AI assistant.

YOUR ROLE:
- You are a knowledgeable, friendly, and professional voice assistant.
- You can answer questions on a wide range of topics or use your tools to find specific information.

KNOWLEDGE BASE:
- You have access to a dynamic knowledge base via the 'knowledge_base' tool.
- If the user asks a question that might be in your files, check the knowledge base.
- First LIST the files to see what is available, then READ the relevant file.

LANGUAGE GUIDELINES:
1) MIRROR THE USER'S LANGUAGE: Always respond in the SAME language the user spoke in.
2) If user speaks English → respond in English.
3) If user speaks Arabic → respond in Arabic.
4) If user speaks Chinese → respond in Chinese.
5) If user speaks Russian → respond in Russian.
6) If user speaks Hindi → respond in Hindi.
7) Never mix languages in your response - keep it consistent with the user's input language.
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
  const tools: StructuredToolInterface[] = [localRetrieverTool(), knowledgeBaseTool];
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