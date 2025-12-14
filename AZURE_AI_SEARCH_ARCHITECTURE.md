# Azure AI Search Integration: Vector Database Architecture

## Executive Summary

This document provides a **comprehensive architecture** for integrating **Azure AI Search** (formerly Azure Cognitive Search) as a vector database for the knowledge base, with **per-user and per-preset partitioning** to ensure complete data isolation and dynamic semantic search capabilities.

**Key Requirements**:
- ✅ Per-user partitioning (users can only access their own knowledge)
- ✅ Per-preset partitioning (presets have isolated knowledge bases)
- ✅ Semantic/vector search (not just keyword matching)
- ✅ Dynamic agent search (agent can query knowledge base contextually)
- ✅ Scalable architecture (works with Azure Web Apps stateless deployment)

---

## 1. Architecture Overview

### 1.1 Current State
**Problem**: Knowledge base uses simple file system with keyword matching:
- ❌ No semantic understanding
- ❌ No vector search
- ❌ Shared knowledge base (not per-user/preset)
- ❌ Simple string matching (fragile and inaccurate)
- ❌ File system dependency (breaks in stateless deployment)

### 1.2 Proposed Architecture

```
┌─────────────────┐
│   User Uploads  │
│  Knowledge File │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Azure Blob     │
│  Storage        │
│  (Raw Files)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Document       │
│  Processing     │
│  Pipeline       │
│  (Chunking)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Azure OpenAI   │
│  Embeddings API │
│  (text-embedding-│
│   ada-002)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Azure AI       │
│  Search Index   │
│  (Vector +      │
│   Metadata)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agent Tool     │
│  (Vector Search)│
└─────────────────┘
```

**Data Flow**:
1. User uploads file → Stored in Azure Blob Storage
2. Document processing → Chunked into smaller pieces
3. Embedding generation → Each chunk converted to vector
4. Indexing → Vectors + metadata stored in Azure AI Search
5. Query → User query embedded → Vector similarity search

---

## 2. Azure AI Search Index Schema

### 2.1 Index Structure
**Critical**: Index must support filtering by `user_id` and `profile_id` for proper partitioning.

```json
{
  "name": "knowledge-base-index",
  "fields": [
    {
      "name": "id",
      "type": "Edm.String",
      "key": true,
      "searchable": false,
      "filterable": true,
      "retrievable": true
    },
    {
      "name": "user_id",
      "type": "Edm.String",
      "searchable": false,
      "filterable": true,
      "retrievable": true,
      "facetable": false
    },
    {
      "name": "profile_id",
      "type": "Edm.String",
      "searchable": false,
      "filterable": true,
      "retrievable": true,
      "facetable": false
    },
    {
      "name": "chunk_id",
      "type": "Edm.String",
      "searchable": false,
      "filterable": true,
      "retrievable": true
    },
    {
      "name": "source_file",
      "type": "Edm.String",
      "searchable": false,
      "filterable": true,
      "retrievable": true,
      "facetable": true
    },
    {
      "name": "chunk_text",
      "type": "Edm.String",
      "searchable": true,
      "filterable": false,
      "retrievable": true,
      "analyzer": "en.microsoft"
    },
    {
      "name": "chunk_vector",
      "type": "Collection(Edm.Single)",
      "searchable": true,
      "filterable": false,
      "retrievable": false,
      "dimensions": 1536,
      "vectorSearchProfile": "vector-profile"
    },
    {
      "name": "metadata",
      "type": "Edm.String",
      "searchable": false,
      "filterable": false,
      "retrievable": true
    },
    {
      "name": "uploaded_at",
      "type": "Edm.DateTimeOffset",
      "searchable": false,
      "filterable": true,
      "retrievable": true,
      "sortable": true
    }
  ],
  "vectorSearch": {
    "algorithms": [
      {
        "name": "hnsw-config",
        "kind": "hnsw",
        "hnswParameters": {
          "m": 4,
          "efConstruction": 400,
          "efSearch": 500,
          "metric": "cosine"
        }
      }
    ],
    "profiles": [
      {
        "name": "vector-profile",
        "algorithm": "hnsw-config"
      }
    ]
  }
}
```

**Key Design Decisions**:
- **`user_id` and `profile_id` are filterable**: Enables strict partitioning
- **`chunk_vector` is 1536 dimensions**: Matches Azure OpenAI `text-embedding-ada-002`
- **HNSW algorithm**: Efficient approximate nearest neighbor search
- **Cosine similarity**: Standard for semantic search

### 2.2 Composite Partition Key
**Critical**: Use composite key `user_id + profile_id` for queries to ensure isolation:

```typescript
// All queries MUST include these filters
const filter = `user_id eq '${userId}' and profile_id eq '${profileId}'`;
```

---

## 3. Database Schema Updates

### 3.1 Knowledge Files Table
**Update**: Add fields for tracking Azure AI Search indexing status.

```sql
-- Update existing knowledge_files table
ALTER TABLE knowledge_files 
  ADD COLUMN IF NOT EXISTS azure_search_indexed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50) DEFAULT 'text-embedding-ada-002';

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_files_user_profile 
  ON knowledge_files(user_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_files_indexed 
  ON knowledge_files(azure_search_indexed) 
  WHERE azure_search_indexed = FALSE;
```

### 3.2 Document Chunks Table (Optional - for tracking)
**Purpose**: Track individual chunks for debugging and re-indexing.

```sql
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_file_id UUID NOT NULL REFERENCES knowledge_files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_vector_id VARCHAR(255) NOT NULL, -- ID in Azure AI Search
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_chunk_per_file UNIQUE (knowledge_file_id, chunk_index)
);

CREATE INDEX idx_document_chunks_file_id ON document_chunks(knowledge_file_id);
CREATE INDEX idx_document_chunks_vector_id ON document_chunks(chunk_vector_id);
```

---

## 4. Document Processing Pipeline

### 4.1 Chunking Strategy
**Critical**: Documents must be chunked intelligently to preserve context.

```typescript
// lib/document-processing.ts
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export interface Chunk {
  text: string;
  metadata: {
    sourceFile: string;
    chunkIndex: number;
    startChar?: number;
    endChar?: number;
  };
}

export async function chunkDocument(
  content: string,
  filename: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
  } = {}
): Promise<Chunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: options.chunkSize || 1000,
    chunkOverlap: options.chunkOverlap || 200,
    separators: ['\n\n', '\n', '. ', ' ', ''], // Try to split on paragraphs first
  });

  const chunks = await splitter.createDocuments([content], [{
    source: filename,
  }]);

  return chunks.map((chunk, index) => ({
    text: chunk.pageContent,
    metadata: {
      sourceFile: filename,
      chunkIndex: index,
      startChar: chunk.metadata.loc?.char_index?.start,
      endChar: chunk.metadata.loc?.char_index?.end,
    },
  }));
}
```

**Chunking Parameters**:
- **Chunk Size**: 1000 characters (balance between context and token limits)
- **Overlap**: 200 characters (preserves context across chunks)
- **Separators**: Prioritize paragraph breaks to maintain semantic coherence

### 4.2 Embedding Generation
**Critical**: Use Azure OpenAI for embeddings (consistent with LLM).

```typescript
// lib/embeddings.ts
import { AzureOpenAIEmbeddings } from '@langchain/openai';

export async function generateEmbeddings(
  texts: string[],
  config: {
    endpoint: string;
    apiKey: string;
    deploymentName: string;
  }
): Promise<number[][]> {
  const embeddings = new AzureOpenAIEmbeddings({
    azureOpenAIApiKey: config.apiKey,
    azureOpenAIApiInstanceName: config.endpoint.replace('https://', '').replace('.openai.azure.com', ''),
    azureOpenAIApiDeploymentName: config.deploymentName || 'text-embedding-ada-002',
    azureOpenAIApiVersion: '2024-02-15-preview',
  });

  const vectors = await embeddings.embedDocuments(texts);
  return vectors;
}
```

**Embedding Model**: `text-embedding-ada-002`
- **Dimensions**: 1536
- **Cost**: ~$0.0001 per 1K tokens
- **Performance**: Fast and accurate

---

## 5. Azure AI Search Integration

### 5.1 Search Client Setup
```typescript
// lib/azure-search.ts
import { SearchClient, SearchIndexClient, AzureKeyCredential } from '@azure/search-documents';

export interface AzureSearchConfig {
  endpoint: string;
  apiKey: string;
  indexName: string;
}

export function createSearchClient(config: AzureSearchConfig): SearchClient {
  return new SearchClient(
    config.endpoint,
    config.indexName,
    new AzureKeyCredential(config.apiKey)
  );
}

export function createIndexClient(config: AzureSearchConfig): SearchIndexClient {
  return new SearchIndexClient(
    config.endpoint,
    new AzureKeyCredential(config.apiKey)
  );
}
```

### 5.2 Indexing Documents
**Critical**: Must include `user_id` and `profile_id` in every document.

```typescript
// lib/indexing.ts
import { SearchClient } from '@azure/search-documents';

export interface IndexDocument {
  id: string; // Composite: `${userId}_${profileId}_${fileId}_${chunkIndex}`
  user_id: string;
  profile_id: string;
  chunk_id: string;
  source_file: string;
  chunk_text: string;
  chunk_vector: number[];
  metadata: string; // JSON string
  uploaded_at: Date;
}

export async function indexChunks(
  client: SearchClient,
  chunks: Chunk[],
  metadata: {
    userId: string;
    profileId: string;
    fileId: string;
    filename: string;
  }
): Promise<void> {
  const documents: IndexDocument[] = chunks.map((chunk, index) => ({
    id: `${metadata.userId}_${metadata.profileId}_${metadata.fileId}_${index}`,
    user_id: metadata.userId,
    profile_id: metadata.profileId,
    chunk_id: `${metadata.fileId}_${index}`,
    source_file: metadata.filename,
    chunk_text: chunk.text,
    chunk_vector: chunk.embedding, // Must be generated first
    metadata: JSON.stringify(chunk.metadata),
    uploaded_at: new Date(),
  }));

  // Batch upload (Azure AI Search supports up to 1000 docs per batch)
  const batchSize = 100;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    await client.uploadDocuments(batch);
  }
}
```

### 5.3 Vector Search Query
**Critical**: Must filter by `user_id` and `profile_id` for security.

```typescript
// lib/search.ts
export interface SearchResult {
  chunk_text: string;
  source_file: string;
  chunk_id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export async function vectorSearch(
  client: SearchClient,
  queryVector: number[],
  options: {
    userId: string;
    profileId: string;
    topK?: number;
    minScore?: number;
  }
): Promise<SearchResult[]> {
  // CRITICAL: Filter by user and profile for security
  const filter = `user_id eq '${options.userId}' and profile_id eq '${options.profileId}'`;

  const searchResults = await client.search(undefined, {
    vectorSearchOptions: {
      queries: [
        {
          kind: 'vector',
          vector: queryVector,
          kNearestNeighbors: options.topK || 5,
          fields: 'chunk_vector',
        },
      ],
    },
    filter: filter, // Security: Only search within user's preset
    select: ['chunk_text', 'source_file', 'chunk_id', 'metadata'],
    top: options.topK || 5,
  });

  const results: SearchResult[] = [];
  for await (const result of searchResults.results) {
    if (result.score && result.score >= (options.minScore || 0.7)) {
      results.push({
        chunk_text: result.document.chunk_text as string,
        source_file: result.document.source_file as string,
        chunk_id: result.document.chunk_id as string,
        score: result.score,
        metadata: JSON.parse(result.document.metadata as string || '{}'),
      });
    }
  }

  return results;
}
```

**Security Note**: The `filter` parameter is **critical** - it ensures users can only search within their own presets. Never trust client-provided filters.

---

## 6. Updated Knowledge Base Tool

### 6.1 Vector Search Tool
**Replaces**: Current file system-based tool with semantic search.

```typescript
// agent/tools/knowledge-vector.ts
import { tool } from '@langchain/core/tools';
import { createSearchClient } from '@/lib/azure-search';
import { generateEmbeddings } from '@/lib/embeddings';
import { vectorSearch } from '@/lib/search';

export function createKnowledgeBaseTool(
  userId: string,
  profileId: string,
  config: {
    azureSearch: AzureSearchConfig;
    azureOpenAI: {
      endpoint: string;
      apiKey: string;
      deploymentName: string;
    };
  }
) {
  return tool(
    async (input: string) => {
      try {
        const searchClient = createSearchClient(config.azureSearch);

        // Handle "list" command
        if (input.trim().toLowerCase().includes('list') || 
            input.trim().toLowerCase() === 'files') {
          // Query database for files (not search index)
          const files = await db.query(
            'SELECT DISTINCT source_file FROM knowledge_base_index WHERE user_id = $1 AND profile_id = $2',
            [userId, profileId]
          );
          
          if (files.rows.length === 0) {
            return "The knowledge base is empty. Upload files to add knowledge.";
          }
          
          const fileList = files.rows.map(f => f.source_file).join(', ');
          return `Available knowledge files: ${fileList}. Ask me about any topic in these files.`;
        }

        // Semantic search
        // Step 1: Generate embedding for query
        const queryEmbedding = await generateEmbeddings(
          [input],
          config.azureOpenAI
        );

        // Step 2: Vector search with user/profile filter
        const results = await vectorSearch(
          searchClient,
          queryEmbedding[0],
          {
            userId,
            profileId,
            topK: 5, // Return top 5 most relevant chunks
            minScore: 0.7, // Minimum similarity threshold
          }
        );

        if (results.length === 0) {
          return `No relevant information found in the knowledge base for: "${input}". Try rephrasing your question or check if the topic is covered in the uploaded files.`;
        }

        // Step 3: Format results for LLM
        const formattedResults = results
          .map((result, index) => {
            return `[Source: ${result.source_file}, Relevance: ${(result.score * 100).toFixed(1)}%]\n${result.chunk_text}`;
          })
          .join('\n\n---\n\n');

        // Limit total length to avoid token limits
        const maxLength = 4000;
        if (formattedResults.length > maxLength) {
          return formattedResults.slice(0, maxLength) + '\n\n[Results truncated due to length]';
        }

        return formattedResults;

      } catch (error) {
        console.error('[Knowledge Tool] Error:', error);
        return `Error searching knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
    {
      name: 'knowledge_base',
      description: `Search the profile-specific knowledge base using semantic search. 
        Input can be:
        - "list" to see available files
        - A question or topic to search for relevant information
        
        The tool will find the most relevant information from uploaded knowledge files.
        Always use this tool if the user asks about information that might be in the knowledge base.`
    }
  );
}
```

**Key Features**:
- ✅ **Semantic search**: Understands meaning, not just keywords
- ✅ **Automatic filtering**: Only searches user's preset knowledge
- ✅ **Relevance scoring**: Returns most relevant chunks first
- ✅ **Source attribution**: Shows which file the information came from

---

## 7. Document Upload & Indexing API

### 7.1 Upload Endpoint
**Updates**: Existing upload endpoint to trigger indexing.

```typescript
// app/api/profiles/[id]/knowledge/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { uploadToBlobStorage } from '@/lib/blob-storage';
import { chunkDocument } from '@/lib/document-processing';
import { generateEmbeddings } from '@/lib/embeddings';
import { indexChunks } from '@/lib/indexing';
import { createSearchClient } from '@/lib/azure-search';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authentication
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: profileId } = await params;

  // Verify ownership
  const profile = await db.query(
    'SELECT * FROM profiles WHERE id = $1 AND user_id = $2',
    [profileId, session.userId]
  );

  if (profile.rows.length === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Get uploaded file
  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  try {
    // Step 1: Upload to Blob Storage
    const blobUrl = await uploadToBlobStorage(file, {
      userId: session.userId,
      profileId: profileId,
      container: 'knowledge-files',
    });

    // Step 2: Read file content
    const content = await file.text();

    // Step 3: Chunk document
    const chunks = await chunkDocument(content, file.name);

    // Step 4: Generate embeddings
    const embeddings = await generateEmbeddings(
      chunks.map(c => c.text),
      {
        endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
        apiKey: process.env.AZURE_OPENAI_API_KEY!,
        deploymentName: 'text-embedding-ada-002',
      }
    );

    // Step 5: Index in Azure AI Search
    const searchClient = createSearchClient({
      endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
      apiKey: process.env.AZURE_SEARCH_API_KEY!,
      indexName: 'knowledge-base-index',
    });

    // Attach embeddings to chunks
    const chunksWithEmbeddings = chunks.map((chunk, index) => ({
      ...chunk,
      embedding: embeddings[index],
    }));

    await indexChunks(searchClient, chunksWithEmbeddings, {
      userId: session.userId,
      profileId: profileId,
      fileId: crypto.randomUUID(),
      filename: file.name,
    });

    // Step 6: Save metadata to database
    const result = await db.query(
      `INSERT INTO knowledge_files 
       (user_id, profile_id, filename, blob_url, azure_search_indexed, chunk_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [session.userId, profileId, file.name, blobUrl, true, chunks.length]
    );

    return NextResponse.json({
      success: true,
      fileId: result.rows[0].id,
      chunkCount: chunks.length,
    });

  } catch (error) {
    console.error('[Knowledge Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload and index file' },
      { status: 500 }
    );
  }
}
```

### 7.2 Background Processing (Optional)
**For large files**: Process asynchronously to avoid timeout.

```typescript
// Use Azure Functions or background job queue
// For now, can use Next.js API route with streaming response
```

---

## 8. Agent Integration

### 8.1 Updated Agent Builder
**Critical**: Pass user and profile context to knowledge tool.

```typescript
// agent/graph.ts
export function buildAgent(config: {
  userId: string;
  profileId: string;
  systemPrompt?: string;
  openAIConfig: AzureOpenAIConfig;
  azureSearchConfig: AzureSearchConfig;
}): AgentInterface {
  const llm = azureModelFromEnv(config.openAIConfig);
  
  // Create profile-specific knowledge tool
  const knowledgeTool = createKnowledgeBaseTool(
    config.userId,
    config.profileId,
    {
      azureSearch: config.azureSearchConfig,
      azureOpenAI: {
        endpoint: config.openAIConfig.endpoint,
        apiKey: config.openAIConfig.apiKey,
        deploymentName: 'text-embedding-ada-002',
      },
    }
  );

  const tools: StructuredToolInterface[] = [knowledgeTool];

  // Add other tools conditionally
  if (config.toolConfig?.enableEntityLookup) {
    tools.push(createEntityLookupTool(config.profileId));
  }

  if (config.toolConfig?.enableWebSearch) {
    tools.push(new TavilySearchResults({ ... }));
  }

  return createReactAgent({
    llm: llm as BaseChatModel,
    tools,
    messageModifier: new SystemMessage(config.systemPrompt || systemPrompt),
  }) as AgentInterface;
}
```

### 8.2 API Route Update
**Critical**: Pass user and profile context from authenticated session.

```typescript
// app/api/agent/route.ts
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const profileId = body.profileId; // Must be provided by client

  // Verify ownership
  const profile = await db.query(
    'SELECT * FROM profiles WHERE id = $1 AND user_id = $2',
    [profileId, session.userId]
  );

  if (profile.rows.length === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Build agent with proper context
  const agent = buildAgent({
    userId: session.userId,
    profileId: profileId,
    systemPrompt: profile.rows[0].openai_config.systemPrompt,
    openAIConfig: profile.rows[0].openai_config,
    azureSearchConfig: {
      endpoint: process.env.AZURE_SEARCH_ENDPOINT!,
      apiKey: process.env.AZURE_SEARCH_API_KEY!,
      indexName: 'knowledge-base-index',
    },
  });

  // ... rest of agent invocation
}
```

---

## 9. Environment Variables

### 9.1 Required Variables
```bash
# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
AZURE_SEARCH_API_KEY=your-admin-key
AZURE_SEARCH_INDEX_NAME=knowledge-base-index

# Azure OpenAI (for embeddings)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-ada-002
```

### 9.2 Azure Resource Setup
1. **Create Azure AI Search service** (Basic tier minimum)
2. **Create Azure OpenAI resource** with embedding deployment
3. **Configure CORS** for Azure AI Search (if needed)
4. **Set up managed identity** (recommended for production)

---

## 10. Security Considerations

### 10.1 Partition Isolation
**CRITICAL**: All queries must filter by `user_id` and `profile_id`.

```typescript
// NEVER trust client-provided filters
// ALWAYS construct filter server-side
const filter = `user_id eq '${session.userId}' and profile_id eq '${profileId}'`;
```

### 10.2 API Key Management
- ✅ Store keys in Azure Key Vault (production)
- ✅ Use managed identity where possible
- ✅ Rotate keys regularly
- ✅ Never expose keys in client code

### 10.3 Rate Limiting
- ✅ Implement rate limits on search queries
- ✅ Monitor embedding API usage
- ✅ Set quotas per user/profile

---

## 11. Cost Estimation

### 11.1 Azure AI Search
- **Basic Tier**: ~$75/month (up to 50MB storage)
- **Standard Tier**: ~$250/month (up to 200GB storage)
- **Storage**: ~$0.10/GB/month

### 11.2 Azure OpenAI Embeddings
- **text-embedding-ada-002**: ~$0.0001 per 1K tokens
- **Example**: 1000 documents × 10 chunks × 1000 tokens = ~$1.00

### 11.3 Blob Storage
- **Hot Tier**: ~$0.0184/GB/month
- **Example**: 10GB knowledge files = ~$0.18/month

**Total Estimated Cost**: ~$100-300/month for small-medium deployment

---

## 12. Migration Plan

### Phase 1: Infrastructure Setup (Week 1)
1. ✅ Create Azure AI Search service
2. ✅ Create Azure OpenAI embedding deployment
3. ✅ Set up index schema
4. ✅ Configure environment variables

### Phase 2: Core Implementation (Week 2)
1. ✅ Implement document chunking
2. ✅ Implement embedding generation
3. ✅ Implement indexing pipeline
4. ✅ Implement vector search

### Phase 3: Integration (Week 3)
1. ✅ Update knowledge base tool
2. ✅ Update upload API
3. ✅ Update agent builder
4. ✅ Test end-to-end flow

### Phase 4: Migration (Week 4)
1. ✅ Migrate existing knowledge files
2. ✅ Re-index all documents
3. ✅ Verify search quality
4. ✅ Performance testing

---

## 13. Performance Optimization

### 13.1 Caching
```typescript
// Cache frequently accessed embeddings
const embeddingCache = new Map<string, number[]>();

export async function getCachedEmbedding(
  text: string,
  config: AzureOpenAIConfig
): Promise<number[]> {
  const cacheKey = `${text}_${config.deploymentName}`;
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }
  
  const embedding = await generateEmbeddings([text], config);
  embeddingCache.set(cacheKey, embedding[0]);
  return embedding[0];
}
```

### 13.2 Batch Processing
- Process multiple files in parallel
- Batch embedding generation (up to 2048 texts per request)
- Batch indexing (up to 1000 documents per request)

### 13.3 Query Optimization
- Use `select` to limit returned fields
- Set appropriate `topK` values
- Implement result caching for common queries

---

## Summary

This architecture provides:
- ✅ **Per-user and per-preset partitioning** via index filters
- ✅ **Semantic search** using vector embeddings
- ✅ **Scalable architecture** compatible with Azure Web Apps
- ✅ **Security** through server-side filtering
- ✅ **Cost-effective** using Azure managed services

**Next Steps**: Review and approve architecture, then begin Phase 1 implementation.

