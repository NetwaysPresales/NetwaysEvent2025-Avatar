import {
  AzureKeyCredential,
  SearchClient,
  SearchIndexClient,
  type SearchIndex,
} from '@azure/search-documents';
import { getSecret } from './secrets';

const EMBEDDING_DIMENSIONS = 1536;
const MAX_CHUNK_CHARACTERS = 3200;
const CHUNK_OVERLAP_CHARACTERS = 400;
const MAX_DOCUMENT_CHARACTERS = 400_000;
const EMBEDDING_BATCH_SIZE = 16;
const INDEX_BATCH_SIZE = 500;

interface KnowledgeChunkDocument {
  id: string;
  knowledgeFileId: string;
  userId: string;
  profileId: string;
  filename: string;
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  uploadedAt: Date;
  contentVector: number[];
}

export interface KnowledgeSearchResult {
  filename: string;
  knowledgeFileId: string;
  chunkIndex: number;
  pageNumber?: number;
  content: string;
  score: number;
}

interface SearchClients {
  searchClient: SearchClient<KnowledgeChunkDocument>;
  indexClient: SearchIndexClient;
  indexName: string;
}

let clientsPromise: Promise<SearchClients> | null = null;
let indexReadyPromise: Promise<void> | null = null;

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for knowledge search`);
  }
  return value;
}

function isStatusCode(error: unknown, statusCode: number): boolean {
  return typeof error === 'object'
    && error !== null
    && 'statusCode' in error
    && error.statusCode === statusCode;
}

function escapeFilterValue(value: string): string {
  return value.replace(/'/g, "''");
}

async function getSearchClients(): Promise<SearchClients> {
  if (!clientsPromise) {
    clientsPromise = (async () => {
      const endpoint = requireEnvironmentVariable('AZURE_SEARCH_ENDPOINT');
      const indexName = process.env.AZURE_SEARCH_INDEX_NAME?.trim() || 'knowledge-chunks';
      const apiKey = await getSecret('AZURE_SEARCH_API_KEY');
      const credential = new AzureKeyCredential(apiKey);

      return {
        searchClient: new SearchClient<KnowledgeChunkDocument>(endpoint, indexName, credential),
        indexClient: new SearchIndexClient(endpoint, credential),
        indexName,
      };
    })();
  }

  return clientsPromise;
}

export async function ensureKnowledgeSearchIndex(): Promise<void> {
  if (!indexReadyPromise) {
    indexReadyPromise = (async () => {
      const { indexClient, indexName } = await getSearchClients();
      try {
        const existing = await indexClient.getIndex(indexName);
        if (!existing.fields.some((field) => field.name === 'pageNumber')) {
          existing.fields.push({ name: 'pageNumber', type: 'Edm.Int32', filterable: true, sortable: true });
          await indexClient.createOrUpdateIndex(existing);
        }
        return;
      } catch (error) {
        if (!isStatusCode(error, 404)) {
          throw error;
        }
      }

      const index: SearchIndex = {
        name: indexName,
        description: 'Profile-scoped document chunks for the Netways AI Avatar knowledge tool.',
        fields: [
          { name: 'id', type: 'Edm.String', key: true, filterable: true },
          { name: 'knowledgeFileId', type: 'Edm.String', filterable: true },
          { name: 'userId', type: 'Edm.String', filterable: true },
          { name: 'profileId', type: 'Edm.String', filterable: true },
          { name: 'filename', type: 'Edm.String', searchable: true, filterable: true },
          { name: 'content', type: 'Edm.String', searchable: true },
          { name: 'chunkIndex', type: 'Edm.Int32', filterable: true, sortable: true },
          { name: 'pageNumber', type: 'Edm.Int32', filterable: true, sortable: true },
          { name: 'uploadedAt', type: 'Edm.DateTimeOffset', filterable: true, sortable: true },
          {
            name: 'contentVector',
            type: 'Collection(Edm.Single)',
            searchable: true,
            hidden: true,
            stored: false,
            vectorSearchDimensions: EMBEDDING_DIMENSIONS,
            vectorSearchProfileName: 'knowledge-vector-profile',
          },
        ],
        vectorSearch: {
          algorithms: [
            {
              name: 'knowledge-hnsw',
              kind: 'hnsw',
              parameters: {
                metric: 'cosine',
                m: 4,
                efConstruction: 400,
                efSearch: 500,
              },
            },
          ],
          profiles: [
            {
              name: 'knowledge-vector-profile',
              algorithmConfigurationName: 'knowledge-hnsw',
            },
          ],
        },
      };

      try {
        await indexClient.createIndex(index);
      } catch (error) {
        // Multiple instances can race during the first request.
        if (!isStatusCode(error, 409)) {
          throw error;
        }
      }
    })().catch((error) => {
      indexReadyPromise = null;
      throw error;
    });
  }

  await indexReadyPromise;
}

export function chunkKnowledgeText(text: string): string[] {
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  if (!normalized) {
    throw new Error('The document contains no extractable text');
  }
  if (normalized.length > MAX_DOCUMENT_CHARACTERS) {
    throw new Error(
      `Extracted document text exceeds ${MAX_DOCUMENT_CHARACTERS.toLocaleString()} characters`
    );
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + MAX_CHUNK_CHARACTERS, normalized.length);
    if (end < normalized.length) {
      const minimumBoundary = start + Math.floor(MAX_CHUNK_CHARACTERS * 0.6);
      const paragraphBoundary = normalized.lastIndexOf('\n\n', end);
      const sentenceBoundary = normalized.lastIndexOf('. ', end);
      const boundary = Math.max(paragraphBoundary, sentenceBoundary);
      if (boundary >= minimumBoundary) {
        end = boundary + (boundary === sentenceBoundary ? 1 : 0);
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= normalized.length) {
      break;
    }
    start = Math.max(end - CHUNK_OVERLAP_CHARACTERS, start + 1);
  }

  return chunks;
}

async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  const endpoint = requireEnvironmentVariable('AZURE_OPENAI_ENDPOINT').replace(/\/$/, '');
  const deployment = requireEnvironmentVariable('AZURE_OPENAI_EMBEDDING_DEPLOYMENT');
  const apiVersion = process.env.AZURE_OPENAI_EMBEDDING_API_VERSION || '2024-10-21';
  const apiKey = await getSecret('AZURE_OPENAI_API_KEY');
  const vectors: number[][] = [];

  for (let index = 0; index < inputs.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = inputs.slice(index, index + EMBEDDING_BATCH_SIZE);
    const response = await fetch(
      `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/embeddings?api-version=${encodeURIComponent(apiVersion)}`,
      {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: batch, dimensions: EMBEDDING_DIMENSIONS }),
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      throw new Error(`Azure OpenAI embedding request failed with status ${response.status}`);
    }

    const payload = await response.json() as {
      data: Array<{ index: number; embedding: number[] }>;
    };
    const ordered = payload.data.sort((left, right) => left.index - right.index);
    if (ordered.length !== batch.length) {
      throw new Error('Azure OpenAI returned an unexpected number of embeddings');
    }
    for (const item of ordered) {
      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error('Azure OpenAI returned an embedding with unexpected dimensions');
      }
      vectors.push(item.embedding);
    }
  }

  return vectors;
}

async function collectDocumentIds(filter: string): Promise<string[]> {
  await ensureKnowledgeSearchIndex();
  const { searchClient } = await getSearchClients();
  const response = await searchClient.search('*', {
    filter,
    select: ['id'],
  });
  const ids: string[] = [];
  for await (const result of response.results) {
    ids.push(result.document.id);
  }
  return ids;
}

async function deleteIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { searchClient } = await getSearchClients();
  for (let index = 0; index < ids.length; index += INDEX_BATCH_SIZE) {
    const result = await searchClient.deleteDocuments('id', ids.slice(index, index + INDEX_BATCH_SIZE));
    const failure = result.results.find((item) => !item.succeeded);
    if (failure) {
      throw new Error(`Azure AI Search failed to delete chunk ${failure.key}: ${failure.errorMessage}`);
    }
  }
}

export async function deleteKnowledgeFileChunks(knowledgeFileId: string): Promise<void> {
  const id = escapeFilterValue(knowledgeFileId);
  await deleteIds(await collectDocumentIds(`knowledgeFileId eq '${id}'`));
}

export async function deleteProfileKnowledgeChunks(
  userId: string,
  profileId: string
): Promise<void> {
  const user = escapeFilterValue(userId);
  const profile = escapeFilterValue(profileId);
  await deleteIds(await collectDocumentIds(`userId eq '${user}' and profileId eq '${profile}'`));
}

export async function indexKnowledgeFile(input: {
  knowledgeFileId: string;
  userId: string;
  profileId: string;
  filename: string;
  content: string;
  pages?: Array<{ pageNumber: number; content: string }>;
  uploadedAt: Date;
}): Promise<number> {
  await ensureKnowledgeSearchIndex();
  const pageChunks = input.pages?.length
    ? input.pages.flatMap((page) => chunkKnowledgeText(page.content).map((content) => ({ content, pageNumber: page.pageNumber })))
    : chunkKnowledgeText(input.content).map((content) => ({ content, pageNumber: undefined }));
  const vectors = await createEmbeddings(pageChunks.map((chunk) => chunk.content));
  const { searchClient } = await getSearchClients();

  // Deterministic IDs make retries idempotent; remove stale chunks if a file gets smaller.
  await deleteKnowledgeFileChunks(input.knowledgeFileId);

  const documents: KnowledgeChunkDocument[] = pageChunks.map(({ content, pageNumber }, chunkIndex) => ({
    id: `${input.knowledgeFileId}-${chunkIndex}`,
    knowledgeFileId: input.knowledgeFileId,
    userId: input.userId,
    profileId: input.profileId,
    filename: input.filename,
    content,
    chunkIndex,
    ...(pageNumber ? { pageNumber } : {}),
    uploadedAt: input.uploadedAt,
    contentVector: vectors[chunkIndex],
  }));

  for (let index = 0; index < documents.length; index += INDEX_BATCH_SIZE) {
    const result = await searchClient.uploadDocuments(
      documents.slice(index, index + INDEX_BATCH_SIZE)
    );
    const failure = result.results.find((item) => !item.succeeded);
    if (failure) {
      throw new Error(`Azure AI Search failed to index chunk ${failure.key}: ${failure.errorMessage}`);
    }
  }

  return pageChunks.length;
}

export async function searchKnowledge(input: {
  userId: string;
  profileId: string;
  query: string;
  top?: number;
}): Promise<KnowledgeSearchResult[]> {
  const query = input.query.trim().slice(0, 1_000);
  if (!query) return [];

  await ensureKnowledgeSearchIndex();
  const [queryVector] = await createEmbeddings([query]);
  const { searchClient } = await getSearchClients();
  const user = escapeFilterValue(input.userId);
  const profile = escapeFilterValue(input.profileId);
  const response = await searchClient.search(query, {
    filter: `userId eq '${user}' and profileId eq '${profile}'`,
    searchFields: ['content', 'filename'],
    select: ['knowledgeFileId', 'filename', 'content', 'chunkIndex', 'pageNumber'],
    top: Math.min(Math.max(input.top || 6, 1), 10),
    vectorSearchOptions: {
      filterMode: 'preFilter',
      queries: [
        {
          kind: 'vector',
          vector: queryVector,
          fields: ['contentVector'],
          kNearestNeighborsCount: Math.min(Math.max(input.top || 6, 1), 10),
        },
      ],
    },
  });

  const results: KnowledgeSearchResult[] = [];
  for await (const result of response.results) {
    results.push({
      filename: result.document.filename,
      knowledgeFileId: result.document.knowledgeFileId,
      chunkIndex: result.document.chunkIndex,
      pageNumber: result.document.pageNumber,
      content: result.document.content,
      score: result.score,
    });
  }
  return results;
}
