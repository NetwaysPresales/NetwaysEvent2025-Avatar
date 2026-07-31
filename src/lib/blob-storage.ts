/**
 * Azure Blob Storage Module
 * 
 * Centralized Blob Storage operations for the avatar application.
 * Handles upload, download, deletion, and SAS token generation.
 * 
 * Containers:
 * - avatar-assets: Profile logos and backgrounds
 * - entity-media: Entity images and videos
 * - knowledge-files: Raw knowledge base files
 * - profile-backups: Profile backup JSON files
 */

import { BlobServiceClient, ContainerClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import { getSecret } from './secrets';
import { db } from './db';

// Container names
export const CONTAINERS = {
  AVATAR_ASSETS: 'avatar-assets',
  ENTITY_MEDIA: 'entity-media',
  KNOWLEDGE_FILES: 'knowledge-files',
  PROFILE_BACKUPS: 'profile-backups',
} as const;

type ContainerName = typeof CONTAINERS[keyof typeof CONTAINERS];

// Lazy initialization of BlobServiceClient
let blobServiceClient: BlobServiceClient | null = null;
const containerClients: Map<string, ContainerClient> = new Map();

/**
 * Get or create BlobServiceClient
 */
async function getBlobServiceClient(): Promise<BlobServiceClient> {
  if (blobServiceClient) {
    return blobServiceClient;
  }

  // Try connection string first (most common)
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connectionString) {
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    return blobServiceClient;
  }

  // Fallback to account name + key
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  if (accountName) {
    const accountKey = await getSecret('AZURE_STORAGE_ACCOUNT_KEY');
    if (!accountKey) {
      throw new Error('AZURE_STORAGE_ACCOUNT_KEY not found in secrets or environment variables');
    }

    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential
    );
    return blobServiceClient;
  }

  throw new Error(
    'Azure Storage not configured. Set AZURE_STORAGE_CONNECTION_STRING or ' +
    'AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY in environment variables.'
  );
}

/**
 * Get or create ContainerClient for a container
 */
async function getContainerClient(containerName: ContainerName): Promise<ContainerClient> {
  if (containerClients.has(containerName)) {
    return containerClients.get(containerName)!;
  }

  const serviceClient = await getBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(containerName);

  // Ensure container exists
  // Don't set access level - account-level "Allow Blob public access" setting controls this
  // Since public access is disabled at account level, containers will be private
  // All access is controlled via SAS tokens
  await containerClient.createIfNotExists();

  containerClients.set(containerName, containerClient);
  return containerClient;
}

/**
 * Upload a file to Blob Storage
 * 
 * @param file - File buffer or Buffer
 * @param options - Upload options
 * @returns Blob URL (without SAS token - use getAssetUrl() for SAS URLs)
 */
export async function uploadAsset(
  file: Buffer | Uint8Array,
  options: {
    userId: string;
    profileId: string;
    filename: string;
    contentType: string;
    container: ContainerName;
    instanceId?: string; // For entity-media
    fieldId?: string; // For entity-media
  }
): Promise<string> {
  const containerClient = await getContainerClient(options.container);

  // Build blob path based on container type
  let blobName: string;
  if (options.container === CONTAINERS.ENTITY_MEDIA && options.instanceId && options.fieldId) {
    blobName = `${options.userId}/${options.profileId}/${options.instanceId}/${options.fieldId}/${Date.now()}-${options.filename}`;
  } else {
    blobName = `${options.userId}/${options.profileId}/${Date.now()}-${options.filename}`;
  }

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.upload(file, file.length, {
    blobHTTPHeaders: {
      blobContentType: options.contentType,
    },
  });

  // Return the blob URL (without SAS token)
  return blockBlobClient.url;
}

/**
 * Delete a file from Blob Storage
 * 
 * @param blobUrl - Full blob URL
 */
export async function deleteAsset(blobUrl: string): Promise<void> {
  try {
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Extract container name (first part after account name)
    const containerName = pathParts[0] as ContainerName;
    const blobName = decodeURIComponent(pathParts.slice(1).join('/'));

    const containerClient = await getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.delete();
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
      // Already deleted, ignore
      return;
    }
    throw error;
  }
}

/**
 * Generate a SAS URL for secure, time-limited access to a blob
 * Verifies ownership before generating the SAS token.
 * 
 * @param userId - User ID
 * @param profileId - Profile ID
 * @param assetType - Asset type ('logo' | 'background')
 * @param expiresInMinutes - Expiration time in minutes (default: 60)
 * @returns SAS URL with expiration
 */
export async function getAssetUrl(
  userId: string,
  profileId: string,
  assetType: 'logo' | 'background',
  expiresInMinutes: number = 60
): Promise<string> {
  // Verify ownership
  const profile = await db.profile.findFirst({
    where: {
      id: profileId,
      userId: userId,
    },
  });

  if (!profile) {
    throw new Error('Unauthorized');
  }

  const blobUrlField = assetType === 'logo' ? 'logoBlobUrl' : 'backgroundBlobUrl';
  const blobUrl = profile[blobUrlField] as string | null;

  if (!blobUrl) {
    throw new Error('Asset not found');
  }

  // Extract blob name from URL
  const blobName = extractBlobName(blobUrl);
  const containerName = CONTAINERS.AVATAR_ASSETS;

  // Get account name from URL
  const url = new URL(blobUrl);
  const accountName = url.hostname.split('.')[0];

  // Get account key for SAS token generation
  // Connection string already contains the key, so we extract it
  let accountKey: string | undefined;

  // Method 1: Extract from connection string (most common - connection string has everything)
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (connectionString) {
    const keyMatch = connectionString.match(/AccountKey=([^;]+)/);
    if (keyMatch) {
      accountKey = keyMatch[1];
    }
  }

  // Method 2: Use separate account key (alternative, only needed if NOT using connection string)
  if (!accountKey) {
    accountKey = await getSecret('AZURE_STORAGE_ACCOUNT_KEY');
  }

  if (!accountKey) {
    throw new Error(
      'Account key not found for SAS token generation. ' +
      'Set AZURE_STORAGE_CONNECTION_STRING (contains the key) or ' +
      'set AZURE_STORAGE_ACCOUNT_KEY in environment variables/Key Vault.'
    );
  }

  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  const sasToken = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'), // Read only
      startsOn: new Date(),
      expiresOn: new Date(Date.now() + expiresInMinutes * 60 * 1000),
    },
    sharedKeyCredential
  ).toString();

  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    sharedKeyCredential
  );
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  return `${blockBlobClient.url}?${sasToken}`;
}

/**
 * List all blobs in a container for a specific user/profile
 * 
 * @param container - Container name
 * @param userId - User ID
 * @param profileId - Profile ID
 * @returns Array of blob names
 */
export async function listAssets(
  container: ContainerName,
  userId: string,
  profileId: string
): Promise<string[]> {
  const containerClient = await getContainerClient(container);
  const prefix = `${userId}/${profileId}/`;

  const blobs: string[] = [];
  for await (const blob of containerClient.listBlobsFlat({ prefix })) {
    blobs.push(blob.name);
  }

  return blobs;
}

/**
 * Extract blob name from a blob URL
 */
export function extractBlobName(blobUrl: string): string {
  const url = new URL(blobUrl);
  const pathParts = url.pathname.split('/').filter(Boolean);
  return decodeURIComponent(pathParts.slice(1).join('/')); // Remove container name
}

/**
 * Extract container name from a blob URL
 */
export function extractContainerName(blobUrl: string): ContainerName {
  const url = new URL(blobUrl);
  const pathParts = url.pathname.split('/').filter(Boolean);
  return pathParts[0] as ContainerName;
}

/**
 * Download blob content as text
 * 
 * @param blobUrl - Full blob URL
 * @returns Blob content as string
 */
export async function extractKnowledgeText(buffer: Buffer, filename: string): Promise<string> {
  if (filename.toLowerCase().endsWith('.docx')) {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value.trim()) {
        throw new Error('The document contains no extractable text');
      }
      return result.value;
    } catch (error) {
      console.error(`[Blob Storage] Failed to parse DOCX ${filename}:`, error);
      throw new Error(`Text could not be extracted from DOCX ${filename}`);
    }
  }

  if (filename.toLowerCase().endsWith('.pdf')) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PDFParser = require('pdf2json');

      const text = await new Promise<string>((resolve, reject) => {
        const pdfParser = new PDFParser(null, true);
        pdfParser.on("pdfParser_dataError", (errData: { parserError: unknown }) => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", () => resolve(pdfParser.getRawTextContent()));
        pdfParser.parseBuffer(buffer);
      });

      return text;
    } catch (error) {
      console.error(`[Blob Storage] Failed to parse PDF ${filename}:`, error);
      throw new Error(`Text could not be extracted from PDF ${filename}`);
    }
  }

  const content = buffer.toString('utf-8');
  if (filename.toLowerCase().endsWith('.json')) {
    return JSON.stringify(JSON.parse(content), null, 2);
  }
  return content;
}

export async function convertKnowledgeDocumentToPdf(buffer: Buffer, filename: string): Promise<Buffer | null> {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return buffer;
  if (extension !== 'docx') return null;

  const endpoint = process.env.GOTENBERG_URL?.trim().replace(/\/$/, '');
  if (!endpoint) {
    throw new Error('DOCX page rendering is unavailable because GOTENBERG_URL is not configured');
  }

  const form = new FormData();
  form.append('files', new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }), filename);
  const response = await fetch(`${endpoint}/forms/libreoffice/convert`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(120_000),
    cache: 'no-store',
  });
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Document rendering failed (${response.status})${details ? `: ${details}` : ''}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export interface KnowledgePdfPage {
  pageNumber: number;
  content: string;
}

export async function extractPdfPages(buffer: Buffer): Promise<KnowledgePdfPage[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const pages: KnowledgePdfPage[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const content = textContent.items
        .map((item) => 'str' in item ? item.str : '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (content) pages.push({ pageNumber, content });
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
  if (!pages.length) throw new Error('The rendered PDF contains no extractable text');
  return pages;
}

export async function downloadBlobBuffer(blobUrl: string): Promise<Buffer> {
  const url = new URL(blobUrl);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const containerName = pathParts[0] as ContainerName;
  const blobName = decodeURIComponent(pathParts.slice(1).join('/'));
  const containerClient = await getContainerClient(containerName);
  return containerClient.getBlockBlobClient(blobName).downloadToBuffer();
}

export async function downloadBlobAsText(blobUrl: string): Promise<string> {
  const buffer = await downloadBlobBuffer(blobUrl);
  return extractKnowledgeText(buffer, extractBlobName(blobUrl));
}

