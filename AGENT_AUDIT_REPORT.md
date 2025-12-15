# Agent & Tools Audit Report
**Date**: 2025-12-15  
**Status**: 🔴 CRITICAL ISSUES FOUND

---

## 📋 TOOLS INVENTORY

### ✅ Active Tools (3)

1. **`knowledge_base`** (`DynamicStructuredTool`)
   - **File**: `src/agent/tools/knowledge.ts`
   - **Purpose**: Access dynamic knowledge base files
   - **Schema**: `{ query: string }`
   - **Status**: ✅ Working (after LangChain v1.x upgrade)
   - **Uses**: Database cache (`getCachedKnowledgeFiles`)

2. **`get_entity_info`** (`tool()`)
   - **File**: `src/agent/tools/entity-visualization.ts:141`
   - **Purpose**: Retrieve entity information by UUID (text-only, no UI)
   - **Input**: UUID string
   - **Status**: ✅ Working
   - **Returns**: Formatted text for LLM context

3. **`visualize_entity`** (`tool()`)
   - **File**: `src/agent/tools/entity-visualization.ts:252`
   - **Purpose**: Trigger UI visualization of entity
   - **Input**: UUID string
   - **Status**: ⚠️ **BROKEN** (see Critical Issues)
   - **Returns**: JSON with visualization data

### 🔧 Optional Tools (1)

4. **`TavilySearchResults`** (from `@langchain/community`)
   - **File**: `src/agent/graph.ts:70`
   - **Purpose**: Web search via Tavily API
   - **Status**: ✅ Working (if `TAVILY_API_KEY` is set)
   - **Conditional**: Only added if API key exists

---

## 📁 FILE STRUCTURE

```
src/agent/
├── graph.ts                    # Agent builder (✅ Working)
├── llm.ts                      # LLM config (⚠️ Uses env vars, not profile)
└── tools/
    ├── knowledge.ts            # Knowledge base tool (✅ Working)
    └── entity-visualization.ts # Entity tools (⚠️ Parsing broken)
```

---

## 🔴 CRITICAL ISSUES

### 1. **BROKEN: Entity Visualization Never Triggers** 🔴🔴🔴

**Location**: `src/app/api/agent/route.ts:136`

**Problem**: 
```typescript
if (msg instanceof ToolMessage && msg.name === 'visualize_entity') {
  // ❌ ToolMessage DOES NOT HAVE A 'name' PROPERTY!
  // This condition NEVER matches - feature is completely broken
}
```

**Why It's Broken**:
- `ToolMessage` has `content` and `tool_call_id`, NOT `name`
- Tool name is on `AIMessage.tool_calls[].name`
- Need to match `AIMessage` with tool calls → find corresponding `ToolMessage` by `tool_call_id`

**Impact**: 
- Entity visualization **NEVER** appears in UI
- Feature is completely non-functional
- Silent failure (no errors logged)

**Fix Required**: See `LANGCHAIN_FIXES_PRIORITY.md` for correct implementation

---

### 2. **LLM Uses Environment Variables Instead of Profile Config** 🔴

**Location**: `src/agent/llm.ts:4-37`

**Problem**:
- `azureModelFromEnv()` reads from `process.env.*`
- Should use profile's `openaiConfig` from database
- All users share same LLM config (security/privacy issue)

**Impact**:
- Can't have per-profile LLM settings
- API keys exposed via `NEXT_PUBLIC_*` env vars (security risk)
- No user-specific model/deployment selection

**Fix**: Pass `openAIConfig` from profile to `buildAgent()`

---

### 3. **Legacy Code: Dead Export** 🟡

**Location**: `src/agent/tools/knowledge.ts:102-111`

**Problem**:
```typescript
export const knowledgeBaseTool = new DynamicStructuredTool({...});
// ❌ This is NEVER used - only createKnowledgeBaseTool() is called
// Should be DELETED
```

**Impact**: 
- Dead code clutter
- Confusing for developers
- No functional impact

**Fix**: Delete lines 97-111

---

### 4. **HACK Comment: Knowledge Injection** 🟡

**Location**: `src/app/api/agent/route.ts:73-74`

**Problem**:
```typescript
// HACK: Inject knowledge files from cache into system prompt
// TODO: Replace with Azure AI Search integration when ready
```

**Impact**:
- Temporary solution that should be replaced
- Knowledge files dumped into system prompt (token waste)
- No semantic search (only keyword matching)

**Fix**: Implement Azure AI Search (see `AZURE_AI_SEARCH_ARCHITECTURE.md`)

---

## ⚠️ MEDIUM ISSUES

### 5. **Tool Schema Inconsistency**

- `knowledge_base`: Uses `DynamicStructuredTool` with explicit zod schema ✅
- `get_entity_info`: Uses `tool()` with inferred schema ⚠️
- `visualize_entity`: Uses `tool()` with inferred schema ⚠️

**Recommendation**: Standardize on `DynamicStructuredTool` for all tools

---

### 6. **No Error Handling for Tool Failures**

**Location**: `src/app/api/agent/route.ts:112-127`

**Problem**: If agent invocation fails, generic error message returned
- No logging of which tool failed
- No retry logic
- User gets unhelpful error

---

### 7. **Conversation History Not Properly Handled**

**Location**: `src/app/api/agent/route.ts:95-103`

**Problem**: 
- System messages filtered out (correct)
- But tool calls/responses might not be properly preserved
- Could lose context between requests

---

## ✅ WHAT'S WORKING

1. ✅ Agent builds correctly with LangChain v1.x
2. ✅ Tools are properly scoped with `userId`/`profileId`
3. ✅ Knowledge base tool works (database-backed)
4. ✅ Entity info tool works (UUID-based lookup)
5. ✅ Security: All tools verify user/profile ownership
6. ✅ Conversation persistence works
7. ✅ System prompt injection works

---

## 🗑️ LEGACY CODE TO DELETE

### Immediate Deletion:

1. **`src/agent/tools/knowledge.ts:97-111`**
   ```typescript
   // DELETE THIS ENTIRE BLOCK:
   export const knowledgeBaseTool = new DynamicStructuredTool({...});
   ```

### Already Deleted (Good!):
- ✅ `src/agent/tools/local.ts` (was `localRetrieverTool`)
- ✅ All references to `sca` tool
- ✅ All references to `identifier` field

---

## 🔧 RECOMMENDED FIXES (Priority Order)

### 🔴 CRITICAL (Do First)

1. **Fix Tool Message Parsing** (`src/app/api/agent/route.ts:134-159`)
   - Match `AIMessage.tool_calls` → find `ToolMessage` by `tool_call_id`
   - See `LANGCHAIN_FIXES_PRIORITY.md` for code

2. **Use Profile LLM Config** (`src/agent/llm.ts`)
   - Pass `openAIConfig` from profile to `buildAgent()`
   - Remove `NEXT_PUBLIC_*` env var usage

### 🟡 HIGH (Do Next)

3. **Delete Legacy Export** (`src/agent/tools/knowledge.ts:97-111`)
   - Remove unused `knowledgeBaseTool` export

4. **Standardize Tool Creation**
   - Convert entity tools to `DynamicStructuredTool` with explicit schemas

5. **Improve Error Handling**
   - Add specific error messages for tool failures
   - Log which tool failed and why

### 🟢 MEDIUM (Nice to Have)

6. **Replace Knowledge HACK**
   - Implement Azure AI Search integration
   - Semantic search instead of keyword matching

7. **Add Tool Call Logging**
   - Log all tool invocations for debugging
   - Track tool usage metrics

---

## 📊 SUMMARY

| Category | Count | Status |
|----------|-------|--------|
| **Active Tools** | 3 | ✅ 2 Working, ⚠️ 1 Broken |
| **Critical Issues** | 2 | 🔴 Must Fix |
| **Legacy Code** | 1 | 🗑️ Should Delete |
| **Medium Issues** | 3 | ⚠️ Should Fix |

**Overall Status**: ⚠️ **FUNCTIONAL BUT BROKEN FEATURES**

The agent works for basic queries, but entity visualization is completely broken due to incorrect tool message parsing. This is a critical bug that needs immediate attention.

