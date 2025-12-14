# Critical Analysis: LangChain Agent Implementation

## Executive Summary

The current LangChain agent implementation has **severe architectural flaws** that make it **incompatible with multi-user, stateless deployment**. The code is riddled with **hardcoded paths**, **no user context**, **file system dependencies**, and **fragile parsing logic**. This requires a **complete redesign** to work in the target architecture.

**Note**: This analysis is complemented by:
- `AZURE_AI_SEARCH_ARCHITECTURE.md` - Complete vector search solution for the knowledge base
- `ENTITY_VISUALIZATION_SYSTEM.md` - Customizable entity visualization system with templates and instances

---

## 1. Critical Architecture Issues

### 1.1 No User/Profile Context
**CRITICAL PROBLEM**: The agent has no idea which user or profile it's serving.

**Current Code** (`api/agent/route.ts:14-22`):
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  const userText = String((body?.userText ?? body?.message) || '').trim();
  const history = Array.isArray(body?.conversationHistory) ? body.conversationHistory : [];
  const systemPrompt = body?.systemPrompt ? String(body.systemPrompt) : undefined;
  
  const agent = buildAgent(systemPrompt);
  // ❌ No user ID, no profile ID, no authorization check
}
```

**Issues**:
- **No authentication**: Anyone can call this endpoint
- **No user isolation**: All users share the same knowledge base
- **No profile-specific tools**: Can't access profile-specific knowledge files
- **Security vulnerability**: Users can access other users' data

**Required Fix**:
```typescript
export async function POST(req: NextRequest) {
  // Get authenticated user
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const body = await req.json();
  const profileId = body.profileId; // Must be provided by client
  
  // Verify user owns this profile
  const profile = await db.query(
    'SELECT * FROM profiles WHERE id = $1 AND user_id = $2',
    [profileId, session.userId]
  );
  
  if (profile.rows.length === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  
  // Build agent with profile-specific context
  const agent = buildAgent({
    userId: session.userId,
    profileId: profileId,
    systemPrompt: profile.rows[0].openai_config.systemPrompt,
    openAIConfig: profile.rows[0].openai_config,
  });
  
  // ... rest of code
}
```

### 1.2 Hardcoded File System Paths
**CRITICAL PROBLEM**: Multiple hardcoded paths that break in stateless architecture.

**Current Code**:
- `tools/knowledge.ts:5`: `const KNOWLEDGE_DIR = path.join(process.cwd(), 'src', 'knowledge');`
- `tools/local.ts:6`: `const KNOWLEDGE_FILE = path.join(process.cwd(), 'src', 'knowledge', 'sca_entities.json');`
- `api/agent/route.ts:51`: `const filePath = path.join(process.cwd(), 'src', 'knowledge', 'sca_entities.json');`

**Issues**:
- **Won't work in Azure Web Apps**: File system is read-only
- **Not profile-specific**: All profiles share the same knowledge base
- **Not user-specific**: All users share the same data
- **Hardcoded entity file**: `sca_entities.json` is hardcoded

**Required Fix**: Move to Azure AI Search with vector embeddings for semantic search.

**See `AZURE_AI_SEARCH_ARCHITECTURE.md` for complete implementation details.**

**Key Components**:
1. **Azure AI Search Index**: Stores document chunks with vector embeddings
2. **Per-user/per-preset partitioning**: All queries filtered by `user_id` and `profile_id`
3. **Semantic search**: Uses Azure OpenAI embeddings for meaning-based search
4. **Document processing**: Chunks documents intelligently and generates embeddings

**Implementation Overview**:
```typescript
// tools/knowledge-vector.ts - Vector search knowledge base
export function createKnowledgeBaseTool(
  userId: string,
  profileId: string,
  config: AzureSearchConfig
) {
  return tool(
    async (input: string) => {
      // Handle "list" command
      if (input.trim().toLowerCase().includes('list')) {
        const files = await db.query(
          'SELECT DISTINCT source_file FROM knowledge_base_index WHERE user_id = $1 AND profile_id = $2',
          [userId, profileId]
        );
        if (files.rows.length === 0) return "The knowledge base is empty.";
        return `Available files: ${files.rows.map(f => f.source_file).join(', ')}.`;
      }

      // Semantic vector search
      // 1. Generate embedding for query
      const queryEmbedding = await generateEmbeddings([input], config.azureOpenAI);
      
      // 2. Vector search with user/profile filter (CRITICAL for security)
      const filter = `user_id eq '${userId}' and profile_id eq '${profileId}'`;
      const results = await vectorSearch(searchClient, queryEmbedding[0], {
        filter, // Security: Only search within user's preset
        topK: 5,
        minScore: 0.7,
      });

      if (results.length === 0) {
        return `No relevant information found for: "${input}"`;
      }

      // 3. Format results with source attribution
      return results.map(r => 
        `[Source: ${r.source_file}, Relevance: ${(r.score * 100).toFixed(1)}%]\n${r.chunk_text}`
      ).join('\n\n---\n\n');
    },
    {
      name: 'knowledge_base',
      description: 'Search the profile-specific knowledge base using semantic search. Input can be "list" to see files, or a question/topic to find relevant information.'
    }
  );
}
```

**Critical Security**: All queries MUST filter by `user_id` and `profile_id` server-side. Never trust client-provided filters.

**Benefits over file-based approach**:
- ✅ **Semantic understanding**: Finds relevant content even with different wording
- ✅ **Scalable**: Works with thousands of documents
- ✅ **Fast**: Vector search is much faster than scanning files
- ✅ **Isolated**: Complete per-user/per-preset data isolation
- ✅ **Stateless**: No file system dependencies

### 1.3 Hardcoded Entity Lookup
**CRITICAL PROBLEM**: Entity lookup is hardcoded to a specific file and format.

**Current Code** (`tools/local.ts:6-69`):
```typescript
const KNOWLEDGE_FILE = path.join(process.cwd(), 'src', 'knowledge', 'sca_entities.json');
// ... hardcoded entity matching logic ...
```

**Issues**:
- **Hardcoded file**: `sca_entities.json` is hardcoded
- **Hardcoded matching logic**: Specific to one use case
- **Not flexible**: Can't have different entity types per profile
- **Fragile parsing**: Regex-based matching is error-prone
- **No visualization**: Entities can't display custom visuals
- **No user configuration**: Can't customize entity structure or content

**Required Fix**: Implement customizable entity visualization system.

**See `ENTITY_VISUALIZATION_SYSTEM.md` for complete implementation details.**
```typescript
// LEGACY: This old entity lookup approach is replaced by the entity visualization system
// See ENTITY_VISUALIZATION_SYSTEM.md for the new implementation using createEntityVisualizationTool

**Key Components**:
1. **Entity Templates**: Define visualization structure (sections, fields, layout)
2. **Entity Instances**: Store actual entity data with media files
3. **Entity Tool**: LangChain tool that retrieves entity by ID/identifier
4. **UI Components**: Configuration interface and visualization display

**Implementation Overview**:
```typescript
// tools/entity-visualization.ts - Customizable entity tool
export function createEntityVisualizationTool(
  userId: string,
  profileId: string
) {
  return tool(
    async (input: string): Promise<string> => {
      // Query entity instance with user/profile filter (CRITICAL for security)
      const entityResult = await db.query(
        `SELECT ei.*, et.structure
         FROM entity_instances ei
         INNER JOIN entity_templates et ON ei.template_id = et.id
         WHERE ei.profile_id = $1 AND ei.user_id = $2 AND ei.is_active = TRUE
           AND (ei.id::text = $3 OR ei.identifier = $3)`,
        [profileId, userId, input.trim()]
      );

      if (entityResult.rows.length === 0) {
        return JSON.stringify({ found: false, error: 'Entity not found.' });
      }

      const entity = entityResult.rows[0];
      const visualizationData = buildVisualizationData(entity, entity.structure);
      const agentContext = buildAgentContext(entity, entity.structure, entity.data);

      return JSON.stringify({
        found: true,
        entityId: entity.id,
        entityName: entity.name,
        visualizationData,
        agentContext // Agent uses this to discuss the entity
      });
    },
    {
      name: 'show_entity',
      description: 'Display entity information and visualization. Input: entity identifier.'
    }
  );
}
```

**Key Features**:
- ✅ **Custom visualization structures**: Users define sections, fields, layouts
- ✅ **Media support**: Images, videos, text stored in Blob Storage
- ✅ **Multiple instances**: Each preset can have many entities
- ✅ **Dynamic agent integration**: Agent calls tool with entity ID
- ✅ **Per-user/per-preset partitioning**: Complete data isolation
- ✅ **UI configuration**: Visual builder for templates and instances

**Database Schema**:
- `entity_templates`: Stores visualization structure definitions
- `entity_instances`: Stores entity data instances
- `entity_media_files`: Tracks media files in Blob Storage

// Better matching algorithm (legacy - replaced by entity visualization system)
function findEntity(entities: Entity[], query: string): Entity | null {
  const normalizedQuery = normalizeQuery(query);
  
  // Try exact match first
  let found = entities.find(e => 
    normalizeQuery(e.name) === normalizedQuery
  );
  
  if (found) return found;
  
  // Try fuzzy match (use a library like fuse.js)
  // Note: For knowledge base, use Azure AI Search (see AZURE_AI_SEARCH_ARCHITECTURE.md)
  // For entities, can use fuzzy matching or optionally index in Azure AI Search as well
  return null;
}
```

### 1.4 Agent Built at Module Level
**CRITICAL PROBLEM**: Agent is built once per module load, not per request.

**Current Code** (`graph.ts:47-68`):
```typescript
export function buildAgent(systemPromptOverride?: string): AgentInterface {
  const llm = azureModelFromEnv(); // ❌ Uses env vars, not user config
  const tools: StructuredToolInterface[] = [localRetrieverTool(), knowledgeBaseTool];
  // ❌ Tools are created once, not per-request
  // ❌ No user/profile context
}
```

**Issues**:
- **Shared state**: All requests share the same agent instance
- **No per-user LLM config**: Uses env vars instead of profile config
- **Tools not scoped**: Tools can't access request-specific context
- **Memory leak potential**: Agent instances might not be cleaned up

**Required Fix**: Build agent per-request with proper context:
```typescript
interface AgentConfig {
  userId: string;
  profileId: string;
  systemPrompt: string;
  openAIConfig: AzureOpenAIConfig;
  tools?: string[]; // Which tools to enable
}

export function buildAgent(config: AgentConfig): AgentInterface {
  // Create LLM from profile config, not env vars
  const llm = new AzureChatOpenAI({
    azureOpenAIApiKey: config.openAIConfig.apiKey,
    azureOpenAIApiInstanceName: extractInstanceName(config.openAIConfig.endpoint),
    azureOpenAIApiDeploymentName: config.openAIConfig.deploymentName,
    azureOpenAIApiVersion: '2024-08-01-preview',
    temperature: 0,
  });
  
  // Build tools with profile context
  const tools: StructuredToolInterface[] = [];
  
  // Always include knowledge base (profile-specific)
  tools.push(createKnowledgeBaseTool(config.profileId, config.userId));
  
  // Conditionally include entity visualization tool if profile has entities
  const entityCount = await db.query(
    'SELECT COUNT(*) FROM entity_instances WHERE profile_id = $1 AND user_id = $2 AND is_active = TRUE',
    [config.profileId, config.userId]
  );
  if (entityCount.rows[0].count > 0) {
    tools.push(createEntityVisualizationTool(config.userId, config.profileId));
  }
  
  // Conditionally include Tavily search if enabled in profile
  if (config.openAIConfig.enableWebSearch && process.env.TAVILY_API_KEY) {
    tools.push(new TavilySearchResults({ 
      apiKey: process.env.TAVILY_API_KEY, 
      maxResults: 3 
    }));
  }
  
  return createReactAgent({
    llm,
    tools,
    messageModifier: new SystemMessage(config.systemPrompt)
  }) as AgentInterface;
}
```

### 1.5 LLM Configuration Inconsistency
**CRITICAL PROBLEM**: LLM config mixes env vars and user-provided config inconsistently.

**Current Code** (`llm.ts:4-37`):
```typescript
export function azureModelFromEnv(): BaseChatModel | null {
  // Accept either server-side AZURE_* or NEXT_PUBLIC_* (user provided)
  const apiKey = process.env.AZURE_OPENAI_API_KEY
    || process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY
    || process.env.OPENAI_API_KEY;
  // ❌ Falls back to env vars if user config missing
  // ❌ No validation
  // ❌ No per-request context
}
```

**Issues**:
- **Security risk**: Falls back to shared env vars
- **No validation**: Doesn't check if user's API key is valid
- **Inconsistent**: Sometimes uses user config, sometimes env vars
- **No error handling**: Returns null silently

**Required Fix**:
```typescript
interface LLMConfig {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
  apiVersion?: string;
}

export function createLLMFromConfig(config: LLMConfig): BaseChatModel {
  // Validate config
  if (!config.apiKey || !config.endpoint || !config.deploymentName) {
    throw new Error('Invalid LLM configuration: missing required fields');
  }
  
  // Validate endpoint format
  let instanceName: string;
  try {
    const url = new URL(config.endpoint);
    instanceName = url.hostname.split('.')[0];
    if (!instanceName) {
      throw new Error('Invalid endpoint format');
    }
  } catch {
    throw new Error('Invalid endpoint URL');
  }
  
  return new AzureChatOpenAI({
    azureOpenAIApiKey: config.apiKey,
    azureOpenAIApiInstanceName: instanceName,
    azureOpenAIApiDeploymentName: config.deploymentName,
    azureOpenAIApiVersion: config.apiVersion || '2024-08-01-preview',
    temperature: 0,
    maxRetries: 3,
    timeout: 30000, // 30 seconds
  });
}
```

---

## 2. Hardcoded Flow Issues

### 2.1 System Prompt Configuration Issues
**PROBLEM**: While users CAN configure the system prompt via `openAIConfig.systemPrompt`, there are still issues with the default fallback and language guidelines.

**Current Flow**:
1. User configures `openAIConfig.systemPrompt` in profile settings ✅
2. It's sent from client (`useAgent.ts:43`) to API ✅
3. API passes it to `buildAgent(systemPrompt)` ✅
4. Falls back to hardcoded default if not provided ❌

**Current Code** (`graph.ts:10-29`):
```typescript
export const systemPrompt = `You are a helpful AI assistant.
// ... hardcoded default with hardcoded language list ...
LANGUAGE GUIDELINES:
1) MIRROR THE USER'S LANGUAGE: Always respond in the SAME language the user spoke in.
2) If user speaks English → respond in English.
3) If user speaks Arabic → respond in Arabic.
4) If user speaks Chinese → respond in Chinese.
5) If user speaks Russian → respond in Russian.
6) If user speaks Hindi → respond in Hindi.
7) Never mix languages in your response - keep it consistent with the user's input language.
`;
```

**Issues**:
- **Default fallback has hardcoded languages**: Languages don't match STT config
- **Language guidelines not auto-injected**: Users must manually add language guidelines to their custom prompts
- **Inconsistency**: If user provides custom prompt without language guidelines, agent won't know supported languages
- **No template system**: Can't inject dynamic parts (like supported languages) into user's custom prompt

**Required Fix**: Support prompt templates with dynamic injection:
```typescript
interface PromptTemplate {
  // Allow users to use placeholders in their prompts
  template: string;
  injectLanguageGuidelines: boolean; // Auto-inject language guidelines
  injectToolDescriptions: boolean; // Auto-inject available tools
}

export function buildSystemPrompt(
  userPrompt: string, // From profile.openai_config.systemPrompt
  sttConfig: STTConfig,
  availableTools: string[] = []
): string {
  let prompt = userPrompt;
  
  // Check if user wants language guidelines auto-injected
  // Option 1: Check for placeholder {{LANGUAGE_GUIDELINES}}
  if (prompt.includes('{{LANGUAGE_GUIDELINES}}')) {
    const languageGuidelines = buildLanguageGuidelines(sttConfig);
    prompt = prompt.replace('{{LANGUAGE_GUIDELINES}}', languageGuidelines);
  }
  // Option 2: Auto-append if not present (configurable per profile)
  else if (shouldAutoInjectLanguageGuidelines(userPrompt)) {
    const languageGuidelines = buildLanguageGuidelines(sttConfig);
    prompt = `${prompt}\n\n${languageGuidelines}`;
  }
  
  // Inject tool descriptions if placeholder exists
  if (prompt.includes('{{AVAILABLE_TOOLS}}')) {
    const toolDescriptions = availableTools
      .map(tool => `- ${tool}`)
      .join('\n');
    prompt = prompt.replace('{{AVAILABLE_TOOLS}}', `Available tools:\n${toolDescriptions}`);
  }
  
  return prompt;
}

function buildLanguageGuidelines(sttConfig: STTConfig): string {
  // Extract supported languages from STT config
  const languages = sttConfig.locales.map(locale => {
    const [lang, country] = locale.split('-');
    return { code: lang, name: getLanguageName(lang) };
  }).filter((v, i, a) => a.findIndex(l => l.code === v.code) === i); // Unique
  
  const languageList = languages.map((lang, index) => {
    return `${index + 2}) If user speaks ${lang.name} → respond in ${lang.name}.`;
  }).join('\n');
  
  return `LANGUAGE GUIDELINES:
1) MIRROR THE USER'S LANGUAGE: Always respond in the SAME language the user spoke in.
${languageList}
${languages.length + 2}) Never mix languages in your response - keep it consistent with the user's input language.`;
}

function shouldAutoInjectLanguageGuidelines(prompt: string): boolean {
  // Check if prompt already has language guidelines
  const hasLanguageGuidelines = /language|lang|speak|respond.*language/i.test(prompt);
  return !hasLanguageGuidelines;
}

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    'en': 'English',
    'ar': 'Arabic',
    'zh': 'Chinese',
    'ru': 'Russian',
    'hi': 'Hindi',
    'fr': 'French',
    'es': 'Spanish',
    'de': 'German',
    'ja': 'Japanese',
    'ko': 'Korean',
  };
  return names[code.toLowerCase()] || code.toUpperCase();
}
```

**Alternative Approach**: Make it configurable in profile:
```typescript
// Add to profile config
interface OpenAIConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  systemPrompt: string;
  promptSettings?: {
    autoInjectLanguageGuidelines?: boolean; // Default: true
    autoInjectToolDescriptions?: boolean; // Default: false
    languageGuidelinesPosition?: 'append' | 'prepend' | 'replace'; // Default: 'append'
  };
}
```

### 2.2 Hardcoded Tool Selection
**PROBLEM**: Tools are hardcoded, not configurable per profile.

**Current Code** (`graph.ts:49-52`):
```typescript
const tools: StructuredToolInterface[] = [localRetrieverTool(), knowledgeBaseTool];
if (process.env.TAVILY_API_KEY) {
  tools.push(new TavilySearchResults({ apiKey: process.env.TAVILY_API_KEY, maxResults: 3 }));
}
```

**Issues**:
- **Always includes entity tool**: Even if profile doesn't need it
- **Tavily is env-based**: Not per-profile configurable
- **No tool configuration**: Can't disable tools per profile
- **Hardcoded maxResults**: Should be configurable

**Required Fix**: Make tools configurable:
```typescript
interface ToolConfig {
  enableEntityLookup: boolean;
  enableWebSearch: boolean;
  webSearchMaxResults?: number;
  enableKnowledgeBase: boolean; // Always true, but for consistency
}

export function buildAgent(config: AgentConfig & { toolConfig: ToolConfig }): AgentInterface {
  const tools: StructuredToolInterface[] = [];
  
  // Knowledge base is always enabled (profile-specific)
  tools.push(createKnowledgeBaseTool(config.profileId, config.userId));
  
  // Entity visualization is optional
  if (config.toolConfig.enableEntityLookup) {
    tools.push(createEntityVisualizationTool(config.userId, config.profileId));
  }
  
  // Web search is optional and configurable
  if (config.toolConfig.enableWebSearch && process.env.TAVILY_API_KEY) {
    tools.push(new TavilySearchResults({
      apiKey: process.env.TAVILY_API_KEY,
      maxResults: config.toolConfig.webSearchMaxResults || 3,
    }));
  }
  
  // ... rest of agent building
}
```

### 2.3 Fragile Entity Extraction
**PROBLEM**: Entity extraction uses fragile regex parsing.

**Current Code** (`api/agent/route.ts:34-46`):
```typescript
for (const msg of result.messages) {
  // Check if this is a tool message from get_company_info (LEGACY - replaced by show_entity)
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
```

**Issues**:
- **Fragile regex**: Breaks if format changes
- **Type checking is weak**: `'name' in msg` is not type-safe
- **No error handling**: Fails silently if regex doesn't match
- **Hardcoded tool name**: `'get_company_info'` is hardcoded (LEGACY - should use 'show_entity')
- **Legacy approach**: This entire pattern is replaced by the new entity visualization system (see `ENTITY_VISUALIZATION_SYSTEM.md`)

**Required Fix**: Use proper LangChain message types with the new entity visualization system:
```typescript
import { ToolMessage } from '@langchain/core/messages';

// In agent result processing - Updated for new entity system
for (const msg of result.messages) {
  if (msg instanceof ToolMessage && msg.name === 'show_entity') {
    const toolOutput = msg.content;
    
    // Use structured JSON output (new entity system always returns JSON)
    try {
      const parsed = JSON.parse(toolOutput);
      if (parsed.found && parsed.entityId) {
        // Entity visualization data is already structured
        entityVisualization = {
          entityId: parsed.entityId,
          entityName: parsed.entityName,
          templateId: parsed.templateId,
          visualizationData: parsed.visualizationData,
          agentContext: parsed.agentContext
        };
        break;
      }
    } catch (error) {
      console.error('Failed to parse entity visualization:', error);
      // No fallback needed - new system always returns valid JSON
    }
  }
}
```

**Better Fix**: Use the new entity visualization system (see `ENTITY_VISUALIZATION_SYSTEM.md`):
```typescript
// The new entity visualization tool uses 'show_entity' as the tool name
// and returns structured JSON with visualization data

// In API route - Updated for new entity system
for (const msg of result.messages) {
  if (msg instanceof ToolMessage && msg.name === 'show_entity') {
    try {
      const parsed = JSON.parse(msg.content);
      if (parsed.found && parsed.entityId) {
        // Entity visualization data is already in the parsed response
        entityVisualization = {
          entityId: parsed.entityId,
          entityName: parsed.entityName,
          templateId: parsed.templateId,
          visualizationData: parsed.visualizationData,
          agentContext: parsed.agentContext
        };
        break;
      }
    } catch {
      // Fallback handling
    }
  }
}
```

---

## 3. Stateless Architecture Issues

### 3.1 Conversation History is Client-Side Only
**PROBLEM**: Conversation history is stored in React ref, lost on refresh.

**Current Code** (`useAgent.ts:11-42`):
```typescript
const convoRef = useRef<string[]>([]);
// ... 
convoRef.current.push(message);
const res = await fetch('/api/agent', {
  body: JSON.stringify({
    message,
    history: convoRef.current.slice(-12), // ❌ Only last 12 messages
  })
});
```

**Issues**:
- **Lost on refresh**: History is in memory only
- **Limited context**: Only 12 messages
- **No persistence**: Can't resume conversations
- **No multi-device**: History not synced across devices

**Required Fix**: Store in database:
```typescript
// Database schema addition
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT conversations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id),
  CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT conversation_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX idx_conversations_profile_id ON conversations(profile_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
```

```typescript
// api/agent/route.ts - Load history from database
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const { profileId, message, conversationId } = await req.json();
  
  // Load conversation history from database
  let history: HumanMessage[] = [];
  if (conversationId) {
    const messages = await db.query(
      `SELECT role, content FROM conversation_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC 
       LIMIT 50`, // Last 50 messages
      [conversationId]
    );
    
    history = messages.rows
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => m.role === 'user' 
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
      );
  }
  
  // ... agent invocation ...
  
  // Save messages to database
  const conversationIdToUse = conversationId || await createConversation(profileId, session.userId);
  await db.query(
    'INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
    [conversationIdToUse, 'user', message]
  );
  await db.query(
    'INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1, $2, $3)',
    [conversationIdToUse, 'assistant', reply]
  );
  
  return NextResponse.json({ 
    reply, 
    conversationId: conversationIdToUse,
    entityDetails 
  });
}
```

### 3.2 No Rate Limiting
**PROBLEM**: API has no rate limiting, can be abused.

**Required Fix**: Add rate limiting middleware:
```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
  analytics: true,
});

export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const { success, remaining } = await ratelimit.limit(`agent:${userId}`);
  return { allowed: success, remaining };
}

// In API route
const rateLimit = await checkRateLimit(session.userId);
if (!rateLimit.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429, headers: { 'Retry-After': '60' } }
  );
}
```

---

## 4. Security Issues

### 4.1 No Authentication
**CRITICAL**: API route has no authentication.

**Required Fix**: Add authentication middleware (see Architecture Migration Plan).

### 4.2 API Keys in Client Code
**PROBLEM**: User API keys might be exposed in client-side code.

**Current Code**: `useAgent.ts` sends `openAIConfig` which contains API keys.

**Required Fix**: 
- **Option 1**: Keep API keys server-side, use session-based auth
- **Option 2**: Encrypt API keys before storing in database
- **Option 3**: Use Azure Key Vault for key storage

### 4.3 No Input Validation
**PROBLEM**: No validation of user input or system prompt.

**Required Fix**:
```typescript
// Validate input
if (!userText || userText.length > 10000) {
  return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
}

// Validate system prompt length
if (systemPrompt && systemPrompt.length > 50000) {
  return NextResponse.json({ error: 'System prompt too long' }, { status: 400 });
}

// Sanitize input (prevent prompt injection)
const sanitizedInput = sanitizeInput(userText);
```

---

## 5. Performance Issues

### 5.1 No Caching
**PROBLEM**: Knowledge base files are read from disk/Blob Storage on every request. **NOTE**: With Azure AI Search architecture, this is replaced by vector search queries, which are much more efficient.

**Required Fix**: Add caching layer:
```typescript
// lib/cache.ts
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// NOTE: With Azure AI Search, caching is less critical as vector search is fast
// But can cache query results for frequently asked questions
export async function getCachedKnowledgeQuery(profileId: string, query: string): Promise<SearchResult[] | null> {
  const key = `knowledge:${profileId}:${hashQuery(query)}`;
  return await redis.get(key);
}

export async function cacheKnowledgeQuery(profileId: string, query: string, results: SearchResult[], ttl: number = 3600): Promise<void> {
  const key = `knowledge:${profileId}:${hashQuery(query)}`;
  await redis.setex(key, ttl, content);
}
```

### 5.2 No Streaming
**PROBLEM**: Agent response is returned all at once, no streaming.

**Required Fix**: Implement streaming for better UX:
```typescript
// Use LangChain streaming
const stream = await agent.stream({ messages });

return new Response(
  new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`)
        );
      }
      controller.close();
    },
  }),
  {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  }
);
```

---

## 6. Recommended Refactoring

### 6.1 New Agent Architecture
```typescript
// agent/factory.ts
interface AgentFactoryConfig {
  userId: string;
  profileId: string;
  conversationId?: string;
}

export class AgentFactory {
  static async create(config: AgentFactoryConfig): Promise<AgentInterface> {
    // Load profile
    const profile = await getProfile(config.profileId, config.userId);
    if (!profile) {
      throw new Error('Profile not found');
    }
    
    // Create LLM from profile config
    const llm = createLLMFromConfig(profile.openai_config);
    
    // Build tools with profile context
    const tools = await this.buildTools(config.profileId, config.userId, profile);
    
    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      profile.openai_config.systemPrompt,
      profile.stt_config
    );
    
    // Create agent
    return createReactAgent({
      llm,
      tools,
      messageModifier: new SystemMessage(systemPrompt),
    }) as AgentInterface;
  }
  
  private static async buildTools(
    profileId: string,
    userId: string,
    profile: AvatarProfile
  ): Promise<StructuredToolInterface[]> {
    const tools: StructuredToolInterface[] = [];
    
    // Always include knowledge base
    tools.push(createKnowledgeBaseTool(profileId, userId));
    
    // Conditionally include other tools
    if (profile.tool_config?.enableEntityLookup) {
      tools.push(createEntityVisualizationTool(userId, profileId));
    }
    
    if (profile.tool_config?.enableWebSearch) {
      tools.push(new TavilySearchResults({
        apiKey: process.env.TAVILY_API_KEY!,
        maxResults: profile.tool_config.webSearchMaxResults || 3,
      }));
    }
    
    return tools;
  }
}
```

### 6.2 Updated API Route
```typescript
// api/agent/route.ts
export async function POST(req: NextRequest) {
  // Authentication
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Rate limiting
  const rateLimit = await checkRateLimit(session.userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
  
  // Parse request
  const { profileId, message, conversationId } = await req.json();
  
  // Validate
  if (!profileId || !message) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  // Verify profile ownership
  const profile = await verifyProfileOwnership(profileId, session.userId);
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }
  
  // Load conversation history
  const history = await loadConversationHistory(conversationId, 50);
  
  // Create agent
  const agent = await AgentFactory.create({
    userId: session.userId,
    profileId,
    conversationId,
  });
  
  // Invoke agent
  const messages = [
    ...history,
    new HumanMessage(message),
  ];
  
  const result = await agent.invoke({ messages });
  const reply = result.messages[result.messages.length - 1]?.content ?? '';
  
  // Extract entity if present
  const entityDetails = await extractEntityFromResult(result, profileId);
  
  // Save to database
  const finalConversationId = await saveConversationMessages(
    conversationId || await createConversation(profileId, session.userId),
    message,
    reply
  );
  
  return NextResponse.json({
    reply,
    conversationId: finalConversationId,
    entityDetails,
  });
}
```

---

## Summary of Critical Issues

1. **CRITICAL**: No user/profile context - complete security vulnerability
2. **CRITICAL**: Hardcoded file system paths - won't work in Azure Web Apps
   - **Solution**: Azure AI Search with vector embeddings (see `AZURE_AI_SEARCH_ARCHITECTURE.md`)
3. **CRITICAL**: No authentication - anyone can access the API
4. **HIGH**: Agent built at module level - shared state issues
5. **HIGH**: Conversation history not persisted - lost on refresh
6. **HIGH**: Hardcoded entity lookup - not flexible
7. **MEDIUM**: Fragile entity extraction - regex-based parsing
8. **MEDIUM**: No rate limiting - can be abused
9. **MEDIUM**: No caching - performance issues
10. **LOW**: No streaming - poor UX for long responses

**Estimated Refactoring Effort**: 3-4 weeks for a senior developer.

**Priority Order**:
1. Add authentication and user context
2. Move knowledge base to Azure AI Search with vector embeddings
   - See `AZURE_AI_SEARCH_ARCHITECTURE.md` for complete implementation
   - Includes per-user/per-preset partitioning
   - Semantic search instead of keyword matching
3. Refactor agent factory to be per-request
4. Add conversation persistence
5. Make tools configurable per profile
6. Add rate limiting and caching
7. Implement streaming responses

