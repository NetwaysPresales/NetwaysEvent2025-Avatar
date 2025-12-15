import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { SystemMessage, type BaseMessage } from '@langchain/core/messages';
import { TavilySearchResults } from '@langchain/community/tools/tavily_search';
import { createKnowledgeBaseTool } from './tools/knowledge';
import { getEntityInfoTool, getEntityVisualizationTool } from './tools/entity-visualization';
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

interface AgentInvokeParams {
  messages: BaseMessage[];
}

interface AgentInvokeResult {
  messages: BaseMessage[];
}

interface AgentInterface {
  invoke(params: AgentInvokeParams): Promise<AgentInvokeResult>;
}

export interface BuildAgentConfig {
  systemPrompt?: string;
  userId?: string;
  profileId?: string;
}

export function buildAgent(config?: BuildAgentConfig | string): AgentInterface {
  // Backward compatibility: if string is passed, treat as systemPrompt
  const systemPromptOverride = typeof config === 'string' ? config : config?.systemPrompt;
  const userId = typeof config === 'object' ? config?.userId : undefined;
  const profileId = typeof config === 'object' ? config?.profileId : undefined;

  const llm = azureModelFromEnv();
  const tools: StructuredToolInterface[] = [];
  
  // Add knowledge base tool if user/profile context is provided
  if (userId && profileId) {
    tools.push(createKnowledgeBaseTool(userId, profileId));
  }
  
  // Add entity tools if user/profile context is provided
  if (userId && profileId) {
    tools.push(getEntityInfoTool(userId, profileId));
    tools.push(getEntityVisualizationTool(userId, profileId));
  }
  
  if (process.env.TAVILY_API_KEY) {
    tools.push(new TavilySearchResults({ apiKey: process.env.TAVILY_API_KEY, maxResults: 3 }));
  }

  if (!llm) {
    return {
      async invoke(): Promise<AgentInvokeResult> {
        const { AIMessage } = await import('@langchain/core/messages');
        return { messages: [new AIMessage('LLM not configured. Please check your environment variables.')] };
      }
    };
  }

  return createReactAgent({
    llm: llm as BaseChatModel,
    tools,
    messageModifier: new SystemMessage(systemPromptOverride || systemPrompt)
  }) as AgentInterface;
}