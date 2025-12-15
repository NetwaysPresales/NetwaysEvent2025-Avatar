# LangChain Critical Fixes - Priority Order

## 🔴 IMMEDIATE FIXES (Do These First)

### 1. Fix Tool Message Parsing (BREAKS FEATURE)

**File**: `src/app/api/agent/route.ts:134-159`

**Current (BROKEN)**:
```typescript
if (msg instanceof ToolMessage && msg.name === 'visualize_entity') {
  // ❌ ToolMessage has no 'name' property - this NEVER matches
}
```

**Fixed**:
```typescript
// Find AIMessage with tool calls for 'visualize_entity'
for (let i = 0; i < result.messages.length; i++) {
  const msg = result.messages[i];
  
  if (msg instanceof AIMessage && msg.tool_calls) {
    for (const toolCall of msg.tool_calls) {
      if (toolCall.name === 'visualize_entity') {
        // Find corresponding ToolMessage by tool_call_id
        const toolMessage = result.messages.find(
          (m) => m instanceof ToolMessage && m.tool_call_id === toolCall.id
        );
        
        if (toolMessage) {
          try {
            const content = typeof toolMessage.content === 'string' 
              ? toolMessage.content 
              : JSON.stringify(toolMessage.content);
            const parsed = JSON.parse(content);
            
            if (parsed.found === true && parsed.entityId) {
              if (parsed.visualizationData && parsed.entityName && parsed.agentContext) {
                entityVisualization = {
                  entityId: parsed.entityId,
                  entityName: parsed.entityName,
                  visualizationData: parsed.visualizationData,
                  agentContext: parsed.agentContext,
                  visualize: true,
                };
                break; // Found it, exit loops
              }
            }
          } catch (error) {
            console.error('[API] Failed to parse entity tool response:', error);
          }
        }
      }
    }
  }
}
```

**Why Critical**: Entity visualization feature is completely broken - it never triggers.

---

### 2. Remove Security Vulnerability: NEXT_PUBLIC API Keys

**File**: `src/agent/llm.ts:6-8`

**Current (INSECURE)**:
```typescript
const apiKey = process.env.AZURE_OPENAI_API_KEY
  || process.env.NEXT_PUBLIC_AZURE_OPENAI_API_KEY  // ❌ EXPOSED TO CLIENT
  || process.env.OPENAI_API_KEY;
```

**Fixed**:
```typescript
// Server-side only - NEVER expose secrets via NEXT_PUBLIC_
const apiKey = process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('[LLM] Azure OpenAI API key not configured');
  return null;
}
```

**Also fix**: `src/lib/config.ts:50-52` - Remove `NEXT_PUBLIC_AZURE_OPENAI_API_KEY` usage

**Why Critical**: API keys exposed in browser = anyone can use your Azure credits.

---

### 3. Fix Reply Extraction (Handles Tool Calls Correctly)

**File**: `src/app/api/agent/route.ts:113-120`

**Current (BROKEN WITH TOOLS)**:
```typescript
result = await agent.invoke({ messages: langchainMessages });
const last = result.messages[result.messages.length - 1];
reply = String(last?.content ?? '').trim();  // ❌ Last might be ToolMessage
```

**Fixed**:
```typescript
result = await agent.invoke({ messages: langchainMessages });

// Find the final AIMessage (not a tool call request)
let reply = '';
for (let i = result.messages.length - 1; i >= 0; i--) {
  const msg = result.messages[i];
  if (msg instanceof AIMessage) {
    // Check if this is a final response (no tool_calls) or tool call request
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      // This is a final response
      reply = String(msg.content ?? '').trim();
      break;
    }
    // Otherwise, this is a tool call request - keep looking
  }
}

if (!reply) {
  console.warn('[API] No final response found in agent result');
  reply = 'I apologize, but I was unable to generate a response. Please try again.';
}
```

**Why Critical**: With tool calls, the last message might be a ToolMessage, causing empty replies.

---

## 🟠 HIGH PRIORITY (Do Next)

### 4. Add Type Safety Validation

**File**: `src/agent/graph.ts:88`, `src/agent/tools/entity-visualization.ts:201`

**Current**:
```typescript
return createReactAgent({
  llm: llm as BaseChatModel,  // ❌ No validation
}) as AgentInterface;

const structure = entity.structure as unknown as EntityStructure;  // ❌ Dangerous
```

**Fixed**:
```typescript
// Validate LLM
if (!llm || typeof (llm as any).invoke !== 'function') {
  throw new Error('Invalid LLM instance provided');
}

// Validate entity structure
function isValidEntityStructure(obj: unknown): obj is EntityStructure {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'layout' in obj &&
    'fields' in obj &&
    Array.isArray((obj as { fields: unknown }).fields) &&
    typeof (obj as { layout: unknown }).layout === 'string'
  );
}

const structure = entity.structure;
if (!isValidEntityStructure(structure)) {
  throw new Error(`Invalid entity structure for entity ${entity.id}`);
}
```

---

### 5. Use Profile LLM Configuration

**File**: `src/agent/graph.ts:55`, `src/app/api/agent/route.ts:88-92`

**Current**:
```typescript
const llm = azureModelFromEnv();  // ❌ Ignores profile config
```

**Fixed**:
```typescript
// In buildAgent function - make it async or pass profile
export async function buildAgent(config: BuildAgentConfig): Promise<AgentInterface> {
  const { getProfile } = await import('@/lib/profile-service');
  
  // Try to get profile-specific LLM config
  let llm: BaseChatModel | null = null;
  
  if (config.userId && config.profileId) {
    const profile = await getProfile(config.userId, config.profileId);
    const openAIConfig = profile?.openaiConfig as { 
      apiKey?: string; 
      endpoint?: string; 
      deploymentName?: string;
      apiVersion?: string;
    } | null;
    
    if (openAIConfig?.apiKey && openAIConfig?.endpoint) {
      // Use profile-specific config
      const { AzureChatOpenAI } = await import('@langchain/openai');
      let instanceName = openAIConfig.endpoint;
      try {
        const u = new URL(openAIConfig.endpoint);
        instanceName = u.hostname.split('.')[0] || openAIConfig.endpoint;
      } catch {}
      
      llm = new AzureChatOpenAI({
        azureOpenAIApiKey: openAIConfig.apiKey,
        azureOpenAIApiInstanceName: instanceName,
        azureOpenAIApiDeploymentName: openAIConfig.deploymentName || 'gpt-4o-mini',
        azureOpenAIApiVersion: openAIConfig.apiVersion || '2024-08-01-preview',
        temperature: 0,
      });
    }
  }
  
  // Fallback to env vars if no profile config
  if (!llm) {
    llm = azureModelFromEnv();
  }
  
  // ... rest of function
}
```

**Note**: This requires making `buildAgent` async and updating the caller in `route.ts`.

---

## 🟡 MEDIUM PRIORITY (Important but not blocking)

### 6. Add Token Limit Handling

**File**: `src/lib/knowledge-service.ts:122-128`

Add token counting before injecting knowledge files into system prompt.

### 7. Improve Knowledge Tool Search

**File**: `src/agent/tools/knowledge.ts:60-77`

Replace simple `includes()` with proper search (fuzzy matching or Azure AI Search).

### 8. Include Tool Messages in Conversation History

**File**: `src/app/api/agent/route.ts:95-103`, `src/lib/conversation-service.ts`

Store tool calls and tool messages in conversation history for better context.

---

## Testing After Fixes

1. **Test Tool Message Parsing**:
   ```typescript
   // Create a test that verifies visualize_entity tool calls are detected
   const testMessages = [
     new HumanMessage("Show me entity XYZ"),
     new AIMessage("", {
       tool_calls: [{
         id: "call_123",
         name: "visualize_entity",
         args: { input: "uuid-here" }
       }]
     }),
     new ToolMessage("{\"found\": true, ...}", "call_123")
   ];
   // Verify entityVisualization is extracted correctly
   ```

2. **Test Security**:
   - Build the app and check browser bundle for API keys
   - Verify `NEXT_PUBLIC_AZURE_OPENAI_API_KEY` is not in client code

3. **Test Reply Extraction**:
   - Test with tool calls to ensure final reply is extracted correctly
   - Test without tool calls to ensure normal flow works

---

## Verification Checklist

- [ ] Tool message parsing fixed and tested
- [ ] NEXT_PUBLIC API keys removed from client bundle
- [ ] Reply extraction handles tool calls correctly
- [ ] Type safety validations added
- [ ] Profile LLM config integrated
- [ ] Token limits handled
- [ ] Knowledge search improved
- [ ] Tool messages in conversation history
- [ ] All tests passing
- [ ] Security audit passed

