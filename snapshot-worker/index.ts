import * as functions from '@google-cloud/functions-framework';
import { Storage } from '@google-cloud/storage';
import { Firestore, FieldValue } from '@google-cloud/firestore';
import { Client as NotionClient } from '@notionhq/client';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import JSZip from 'jszip';
import { gzip } from 'zlib';
import { promisify } from 'util';
import PQueue from 'p-queue';
import crypto from 'crypto';
import type { 
    ListBlockChildrenResponse, 
    QueryDatabaseResponse, 
    PageObjectResponse, 
    DatabaseObjectResponse,
    BlockObjectResponse,
    SearchResponse
} from '@notionhq/client/build/src/api-endpoints';
import { PubSub } from '@google-cloud/pubsub';
const PostHogNode = require('posthog-node'); // Use require for CJS compatibility
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import type { PineconeRecord } from '@pinecone-database/pinecone'; // For typing records
import { get_encoding, Tiktoken } from 'tiktoken'; // Import Tiktoken class for the instance type
import { decryptString } from '../src/lib/kms';

const gzipAsync = promisify(gzip);

// GCP Clients (initialized outside handler)
const storage = new Storage();
const db = new Firestore();
const secretManagerClient = new SecretManagerServiceClient();
let pubsubForEmail: PubSub | null = null; // For sending email trigger messages

// Initialize Rate Limiter queue
const notionQueue = new PQueue({ intervalCap: 3, interval: 1000 });

// Environment Variables
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;

const EMAIL_TRIGGER_TOPIC = process.env.PUBSUB_EMAIL_TRIGGER_TOPIC || 'send-transactional-email';

// --- Interfaces ---
interface SnapshotJob {
  userId: string;
  requestedAt: number;
}

interface PubSubMessage {
  data: string;
}
interface PubSubCloudEventData {
  message: PubSubMessage;
}

// Define the new structure for hashManifest entries
export interface HashManifestEntry {
  hash: string;
  type: 'page' | 'database' | 'block';
  name?: string; 
  blockType?: string; 
  parentId?: string; 
  hasTitleEmbedding?: boolean;
  hasDescriptionEmbedding?: boolean;
  totalChunks?: number;
}

// --- Helper Functions ---

// Helper to compute SHA-256 hash
function computeSha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function getUserNotionAccessToken(userId: string): Promise<string | null> {
  console.log(`[${userId}] Fetching Notion access token from Firestore...`);
  try {
    const integrationRef = db.collection('users').doc(userId).collection('integrations').doc('notion');
    const doc = await integrationRef.get();
    if (!doc.exists) {
      console.warn(`[${userId}] Notion integration document not found.`);
      return null;
    }
    const accessToken = doc.data()?.accessToken;
    if (!accessToken) {
        console.warn(`[${userId}] Notion access token not found in integration document.`);
        return null;
    }
    console.log(`[${userId}] Successfully fetched Notion access token.`);
    return accessToken;
  } catch (error) {
    console.error(`[${userId}] Error fetching Notion access token:`, error);
    return null;
  }
}

// Helper function to get plain text from Notion rich text arrays
function getPlainTextFromRichText(richTextArray: any[] | undefined | null): string {
  if (!richTextArray || !Array.isArray(richTextArray)) return '';
  return richTextArray.map(rt => rt.plain_text || '').join('\n');
}

// Array to collect records for Pinecone upsert
let recordsToUpsertToPinecone: PineconeRecord[] = [];
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_CHUNK_TOKENS = 500; // Max tokens per chunk for embedding
const CHUNK_OVERLAP_TOKENS = 50;  // Overlap tokens between chunks

let tokenizer: Tiktoken;
try {
  tokenizer = get_encoding("cl100k_base"); // Common tokenizer for ada-002 and newer models
} catch (e) {
  console.error("Failed to load tiktoken tokenizer:", e);
  // Fallback or error handling if tokenizer fails to load - critical for chunking
  // For now, we'll let it throw if it can't load, as embedding would be unreliable.
  throw new Error("Tiktoken tokenizer failed to load. Cannot proceed with embedding.");
}

// Retry helper function
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 1000, operationName = "API call"): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.warn(`[Retry] ${operationName} attempt ${i + 1}/${retries} failed: ${error.message}. Retrying in ${delayMs / 1000}s...`);
      if (i < retries - 1) { // Only delay if not the last attempt
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Exponential backoff
      }
    }
  }
  console.error(`[Retry] ${operationName} failed after ${retries} retries.`);
  throw lastError;
}

async function fetchAllBlocks(
  notionClient: NotionClient, 
  queue: PQueue, 
  parentId: string, // Renamed from blockId for clarity, this is the ID of the page/block these blocks belong to
  hashManifest: Record<string, HashManifestEntry>,
  currentSnapshotId: string
): Promise<BlockObjectResponse[]> {
    let allBlocks: BlockObjectResponse[] = [];
    let nextCursor: string | undefined | null = undefined;
    
    do {
        try {
            const response = await queue.add(async () => 
                notionClient.blocks.children.list({ 
                    block_id: parentId, // Use parentId to fetch children of this parent
                    start_cursor: nextCursor || undefined,
                    page_size: 100 
                })
            ) as ListBlockChildrenResponse;
            
            const processedBlocks: BlockObjectResponse[] = [];
            for (const block of response.results as BlockObjectResponse[]) { 
                const { last_edited_time, last_edited_by, created_time, created_by, ...hashableBlockContent } = block;
                const blockString = JSON.stringify(hashableBlockContent);
                const blockHash = computeSha256(blockString);
                
                const currentBlockType = (block as any).type;
                let blockTextSnippet = '';
                // Attempt to get text from common rich text property patterns
                const richTextProperty = (block as any)[currentBlockType]?.rich_text || (block as any)[currentBlockType]?.text;
                if (richTextProperty) {
                  blockTextSnippet = getPlainTextFromRichText(richTextProperty).substring(0, 100);
                }

                let totalChunksForThisBlock = 0; // Initialize

                let textToEmbed: string | null = null;
                const textBlockTypes = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'to_do', 'quote', 'callout'];
                if (textBlockTypes.includes(currentBlockType) && richTextProperty) {
                    textToEmbed = getPlainTextFromRichText(richTextProperty).trim();
                }

                if (textToEmbed && textToEmbed.length > 0 && openaiClient && pineconeClient && pineconeIndexName && tokenizer) {
                  const tokens = tokenizer.encode(textToEmbed);
                  const textChunks: string[] = [];

                  if (tokens.length > MAX_CHUNK_TOKENS) {
                    for (let i = 0; i < tokens.length; i += (MAX_CHUNK_TOKENS - CHUNK_OVERLAP_TOKENS)) {
                      const chunkTokens = tokens.slice(i, i + MAX_CHUNK_TOKENS);
                      if (chunkTokens.length > 0) {
                        const decodedUint8Array = tokenizer.decode(chunkTokens);
                        textChunks.push(new TextDecoder().decode(decodedUint8Array));
                      }
                    }
                  } else if (tokens.length > 0) { 
                    textChunks.push(textToEmbed);
                  }

                  totalChunksForThisBlock = textChunks.length; // Store the number of chunks created

                  for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex++) {
                    const chunk = textChunks[chunkIndex];
                    if (chunk.trim().length === 0) continue;
                    try {
                      const embeddingResponse = await withRetry(() => openaiClient!.embeddings.create({
                        model: OPENAI_EMBEDDING_MODEL,
                        input: chunk,
                      }), 3, 1000, `OpenAI embedding for block ${block.id} chunk ${chunkIndex}`);
                      
                      const embedding = embeddingResponse.data[0]?.embedding;
                      if (embedding) {
                        recordsToUpsertToPinecone.push({
                          id: `${currentSnapshotId}:${block.id}:chunk:${chunkIndex}`,
                          values: embedding,
                          metadata: {
                            snapshotId: currentSnapshotId,
                            itemId: block.id, 
                            itemType: 'block_chunk',
                            blockType: currentBlockType,
                            chunkSequence: chunkIndex,
                            totalChunks: totalChunksForThisBlock,
                            originalTextSnippet: chunk.substring(0, 200),
                            blockParentId: parentId 
                          }
                        });
                      }
                    } catch (embeddingError) {
                      console.error(`[Embeddings] Failed permanently for block ${block.id}, chunk ${chunkIndex}:`, embeddingError);
                    }
                  }
                }

                hashManifest[block.id] = {
                  hash: blockHash,
                  type: 'block',
                  name: blockTextSnippet || currentBlockType, 
                  blockType: currentBlockType,
                  parentId: parentId,
                  totalChunks: totalChunksForThisBlock > 0 ? totalChunksForThisBlock : undefined
                };
                (block as any).contentHash = blockHash; 

                if (block.has_children) { 
                    const childrenBlocks = await fetchAllBlocks(notionClient, queue, block.id, hashManifest, currentSnapshotId);
                    (block as any).children = childrenBlocks;
                }
                processedBlocks.push(block);
            }
            allBlocks = [...allBlocks, ...processedBlocks];
            nextCursor = response.next_cursor;
        } catch (error) {
            console.error(`[fetchAllBlocks] Error fetching blocks for parent ${parentId}, cursor: ${nextCursor}:`, error);
            nextCursor = null; 
        }
    } while (nextCursor);
    return allBlocks;
}

async function fetchAllDatabaseRows(
  notionClient: NotionClient, 
  queue: PQueue, 
  databaseId: string, 
  hashManifest: Record<string, HashManifestEntry>,
  currentSnapshotId: string
): Promise<(PageObjectResponse & { blocks?: BlockObjectResponse[], contentHash?: string })[]> {
    let allRows: PageObjectResponse[] = [];
    let nextCursor: string | undefined | null = undefined;
    console.log(`[fetchAllDatabaseRows] Fetching rows for database: ${databaseId}`);

    do {
        try {
            const response = await queue.add(async () => 
                notionClient.databases.query({ 
                    database_id: databaseId, 
                    start_cursor: nextCursor || undefined,
                    page_size: 100 
                })
            ) as QueryDatabaseResponse; // Assert type here
            
            // Filter out non-PageObjectResponses, though query should only return pages
            const pageResults = response.results.filter(item => item.object === 'page') as PageObjectResponse[];
            allRows = [...allRows, ...pageResults]; // Use spread syntax
            nextCursor = response.next_cursor;
            console.log(`[fetchAllDatabaseRows] Fetched ${response.results.length} rows for ${databaseId}, has_more: ${!!nextCursor}`);
        } catch (error) {
            console.error(`[fetchAllDatabaseRows] Error fetching rows for ${databaseId}, cursor: ${nextCursor}:`, error);
            nextCursor = null; // Stop fetching rows for this database on error
        }
    } while (nextCursor);

    console.log(`[fetchAllDatabaseRows] Finished fetching ${allRows.length} total rows for database: ${databaseId}`);
    
    const rowsWithBlocksAndHashes: (PageObjectResponse & { blocks?: BlockObjectResponse[], contentHash?: string })[] = [];
    for (const rowPage of allRows) {
        console.log(`[fetchAllDatabaseRows] Processing row (page): ${rowPage.id}`);
        try {
            const { last_edited_time, last_edited_by, created_time, created_by, ...pageRest } = rowPage;
            const hashablePageContent: any = { ...pageRest };
            if (hashablePageContent.parent?.type === 'database_id' && hashablePageContent.parent.database_id === databaseId) {
                delete hashablePageContent.parent; 
            }
            const pageString = JSON.stringify(hashablePageContent);
            const pageHashVal = computeSha256(pageString);

            let pageTitleText = 'Untitled Page in DB';
            const titleProperty = Object.values(rowPage.properties).find(prop => prop.type === 'title');
            if (titleProperty && 'title' in titleProperty && titleProperty.title) {
                pageTitleText = getPlainTextFromRichText(titleProperty.title).trim();
            }

            let hasTitleEmb = false;
            if (openaiClient && pageTitleText && pageTitleText.length > 0) {
                try {
                    const tokens = tokenizer.encode(pageTitleText);
                    const truncatedTokens = tokens.slice(0, MAX_CHUNK_TOKENS);
                    const textForEmbedding = new TextDecoder().decode(tokenizer.decode(truncatedTokens));
                    if (textForEmbedding.trim().length > 0) {
                        const embeddingResponse = await withRetry(() => openaiClient!.embeddings.create({
                            model: OPENAI_EMBEDDING_MODEL,
                            input: textForEmbedding,
                        }), 3, 1000, `OpenAI embedding for DB page title ${rowPage.id}`);
                        const embedding = embeddingResponse.data[0]?.embedding;
                        if (embedding) {
                            recordsToUpsertToPinecone.push({
                                id: `${currentSnapshotId}:${rowPage.id}:title`,
                                values: embedding,
                                metadata: {
                                    snapshotId: currentSnapshotId,
                                    itemId: rowPage.id,
                                    itemType: 'page_title',
                                    originalText: pageTitleText.substring(0, 200),
                                    parentId: databaseId // The DB this page belongs to
                                }
                            });
                            hasTitleEmb = true;
                        }
                    }
                } catch (embeddingError) {
                    console.error(`[Embeddings] Failed permanently for DB page title ${rowPage.id}:`, embeddingError);
                }
            }

            hashManifest[rowPage.id] = {
              hash: pageHashVal,
              type: 'page',
              name: pageTitleText || 'Untitled Page in DB',
              parentId: databaseId,
              hasTitleEmbedding: hasTitleEmb
            };
            (rowPage as any).contentHash = pageHashVal;

            // Pass currentSnapshotId to fetchAllBlocks for blocks within these pages
            const blocks = await fetchAllBlocks(notionClient, queue, rowPage.id, hashManifest, currentSnapshotId);
            rowsWithBlocksAndHashes.push({ ...rowPage, blocks: blocks });
            console.log(`[fetchAllDatabaseRows]   Fetched and hashed ${blocks.length} blocks for row ${rowPage.id}`);
        } catch (processError) {
            console.error(`[fetchAllDatabaseRows] Failed to process blocks/hash for row ${rowPage.id}:`, processError);
            rowsWithBlocksAndHashes.push(rowPage); // Keep the row page even if processing fails
        }
    }
    
    return rowsWithBlocksAndHashes;
}

// Helper function to transform block objects from the snapshot/fetch format 
// into the format required for the pages.create API's 'children' array.
function transformBlocksForCreate(blocks: any[]): any[] {
    if (!blocks || blocks.length === 0) {
        return [];
    }

    const transformedChildren: any[] = [];

    for (const block of blocks) {
        // Basic structure for the create API block object
        const createBlock: any = {
            object: 'block',
            type: block.type,
            [block.type]: block[block.type] // Copy the type-specific data directly
        };

        // If the block has children (fetched during fetchAllBlocks),
        // recursively transform them as well.
        if (block.children && Array.isArray(block.children) && block.children.length > 0) {
             console.log(`[transformBlocks] Block ${block.id} has ${block.children.length} children, transforming recursively...`);
             // The API expects children within the type-specific object for *some* block types,
             // but for the general `children` array in pages.create, they should be at the top level.
             // However, when *creating* nested blocks, they go INSIDE the parent block's type payload.
             // Let's assume for now we are creating a flat list first for the page's children.
             // The recursive call in fetchAllBlocks already placed children in `block.children`.
             // We need to transform *those* children for the `pages.create` payload format.
             // For the `pages.create` API, nested children are NOT directly added to the parent block object in the list.
             // Instead, the API creates the parent block, and then subsequent blocks in the children array
             // implicitly become children if their indentation/structure dictates. 
             // Exception: Synced Blocks, Column Lists require children nested within the type payload during creation.
             
             // TODO: Refine this logic based on block types that *require* nested children during creation (e.g., Synced Blocks)
             // For now, we'll just use the direct data, ignoring block.children during transformation,
             // as fetchAllBlocks already flattened the hierarchy suitable for page creation.
             // If nested structure IS needed for certain create types, add logic here.
             
             // Simple approach: Copy the block data, recursion handled by fetchAllBlocks structure.
        }

        // TODO: Add specific transformations if needed for certain block types (e.g., file URLs, select options)
        // For most basic block types (paragraph, heading, lists, code, quote, callout, divider, etc.), 
        // simply copying the type and its data payload like above is often sufficient.

        transformedChildren.push(createBlock);
    }

    return transformedChildren;
}

let posthogClient: InstanceType<typeof PostHogNode> | null = null;
let pineconeClient: Pinecone | null = null;
let openaiClient: OpenAI | null = null;
let pineconeIndexName: string | null = null;

// Updated initialization function
async function initializeAllClients(): Promise<void> {
    // Check if all essential clients are already initialized
    if (posthogClient && pineconeClient && openaiClient && pineconeIndexName /* && other essential clients like db, storage */) {
        console.log('[SnapshotWorker] All relevant clients already initialized.');
        return;
    }

    console.log('[SnapshotWorker] Initializing clients (PostHog, OpenAI, Pinecone)...');
    try {
        const [phApiKey, phHost, openAIApiKey, pcApiKey, pcIndex] = await Promise.all([
            getSecret('POSTHOG_API_KEY'),
            Promise.resolve(process.env.POSTHOG_HOST || 'https://app.posthog.com'),
            getSecret('OPENAI_API_KEY'),
            getSecret('PINECONE_API_KEY'),
            getSecret('PINECONE_INDEX_NAME')
        ]);
        
        // PostHog initialization (existing)
        if (phApiKey && PostHogNode) {
            if (!posthogClient) { // Initialize only if not already done
                posthogClient = new PostHogNode(phApiKey, { host: phHost });
                console.log('[SnapshotWorker] PostHog client initialized.');
            }
        } else {
            console.warn('[SnapshotWorker] POSTHOG_API_KEY not found or PostHogNode module issue. PostHog events disabled.');
        }

        // OpenAI initialization
        if (openAIApiKey) {
            if (!openaiClient) {
                openaiClient = new OpenAI({ apiKey: openAIApiKey });
                console.log('[SnapshotWorker] OpenAI client initialized.');
            }
        } else {
            console.warn('[SnapshotWorker] OPENAI_API_KEY not found. OpenAI features (embeddings) will be disabled.');
        }

        // Pinecone initialization
        if (pcApiKey && pcIndex) {
            if (!pineconeClient) {
                pineconeClient = new Pinecone({ apiKey: pcApiKey });
                pineconeIndexName = pcIndex;
                console.log(`[SnapshotWorker] Pinecone client initialized. Target index name: ${pineconeIndexName}.`);
            }
        } else {
            console.warn('[SnapshotWorker] Pinecone API key or index name not found. Pinecone features (vector storage) will be disabled.');
        }

        // Initialize PubSub client for email worker (existing)
        if (!pubsubForEmail && process.env.GOOGLE_CLOUD_PROJECT) {
            try {
                console.log('[SnapshotWorker] Initializing PubSub client for email triggers...');
                // Assuming same credentials can be used or it defaults correctly
                const pubSubClientConfig: any = { projectId: process.env.GOOGLE_CLOUD_PROJECT };
                const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
                if (keyJsonString) {
                    const credentials = JSON.parse(keyJsonString);
                    pubSubClientConfig.credentials = credentials;
                }
                pubsubForEmail = new PubSub(pubSubClientConfig);
                console.log('[SnapshotWorker] PubSub client for email triggers initialized.');
            } catch (e) {
                console.error('[SnapshotWorker] Failed to initialize PubSub client for email triggers:', e);
            }
        }

    } catch (error) {
        console.error('[SnapshotWorker] Client initialization failed:', error);
        // posthogClient = null; // Already handled in its own block potentially
        openaiClient = null;
        pineconeClient = null;
        pineconeIndexName = null;
    }
}

// Helper to get secrets (if not already globally available or different from stripeWebhook's)
// This is a simplified example. Ideally, use a shared lib or ensure getSecret is robust.
async function getSecret(secretName: string): Promise<string | null> {
    if (!GCP_PROJECT_ID) {
        console.error(`[SnapshotWorker] Cannot fetch secret ${secretName}: GCP_PROJECT_ID not set.`);
        return null;
    }
    try {
        const [version] = await secretManagerClient.accessSecretVersion({
            name: `projects/${GCP_PROJECT_ID}/secrets/${secretName}/versions/latest`,
        });
        const payload = version.payload?.data?.toString();
        if (!payload) {
            console.warn(`[SnapshotWorker] Secret ${secretName} payload is empty.`);
            return null;
        }
        return payload;
    } catch (err) {
        console.error(`[SnapshotWorker] Failed to access secret ${secretName}:`, err);
        return null;
    }
}

// --- Main Cloud Function Logic ---
functions.cloudEvent('snapshotWorker', async (cloudEvent: functions.CloudEvent<PubSubCloudEventData>) => {
  await initializeAllClients(); // Initialize PostHog (and other clients if needed here)

  if (!BUCKET_NAME) {
    throw new Error("GCS_BUCKET_NAME environment variable not set.");
  }
  if (!GCP_PROJECT_ID) {
      console.warn("GOOGLE_CLOUD_PROJECT environment variable not set.");
  }
  
  if (!cloudEvent.data?.message?.data) {
    console.error('Invalid Pub/Sub message format: Missing data.message.data');
    return; 
  }

  let job: SnapshotJob;
  try {
    const messageData = Buffer.from(cloudEvent.data.message.data, 'base64').toString();
    job = JSON.parse(messageData) as SnapshotJob;
    console.log(`Received snapshot job for user: ${job.userId}, requested at: ${new Date(job.requestedAt).toISOString()}`);
  } catch (err) {
    console.error('Failed to parse Pub/Sub message data:', err);
    return; 
  }

  const { userId } = job;
  const snapshotId = `snap_${userId}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const hashManifest: Record<string, HashManifestEntry> = {}; // Initialize hashManifest

  if (posthogClient) {
    posthogClient.capture({
        distinctId: userId,
        event: 'snapshot_job_started',
        properties: { snapshotId, requestedAt: job.requestedAt, worker: 'snapshotWorker' }
    });
  }

  // B.1: Trigger "Snapshot Started" email
  if (pubsubForEmail) {
    try {
      const emailPayload = {
        userId,
        emailType: 'snapshot_running', // Changed from snapshot_started to match plan
        data: { snapshotId, requestedAt: job.requestedAt, dashboardUrl: 'https://pagelifeline.app/dashboard' }
      };
      const dataBuffer = Buffer.from(JSON.stringify(emailPayload));
      await pubsubForEmail.topic(EMAIL_TRIGGER_TOPIC).publishMessage({ data: dataBuffer });
      console.log(`[${userId}] Published 'snapshot_running' email trigger for snapshot ${snapshotId}.`);
    } catch (emailError) {
      console.error(`[${userId}] Failed to publish email trigger for snapshot ${snapshotId}:`, emailError);
    }
  }

  try {
    const notionToken = await getUserNotionAccessToken(userId);
    if (!notionToken) {
      throw new Error(`Could not retrieve Notion token for user ${userId}. Cannot create snapshot.`);
    }
    const notion = new NotionClient({ auth: notionToken });
    const pQueue = new PQueue({ intervalCap: 3, interval: 1000 }); // Use the initialized queue
    
    console.log(`[${userId}] Starting Notion data fetch for snapshot ${snapshotId}...`);
    let allFetchedItems: (PageObjectResponse | DatabaseObjectResponse)[] = []; 
    const searchResponse = await pQueue.add(async () => notion.search({ page_size: 100 })) as SearchResponse;
    // Filter for page and database objects from search results
    const initialItems = searchResponse.results.filter(
        (item): item is PageObjectResponse | DatabaseObjectResponse => item.object === 'page' || item.object === 'database'
    );
    allFetchedItems.push(...initialItems);
    let nextCursorInSearch = searchResponse.next_cursor;
    while (nextCursorInSearch) {
        console.log(`[${userId}] Fetching next page of search results...`);
        const nextPageResponse = await pQueue.add(async () => notion.search({ start_cursor: nextCursorInSearch!, page_size: 100 })) as SearchResponse;
        const pageItems = nextPageResponse.results.filter(
            (item): item is PageObjectResponse | DatabaseObjectResponse => item.object === 'page' || item.object === 'database'
        );
        allFetchedItems.push(...pageItems);
        nextCursorInSearch = nextPageResponse.next_cursor;
    }
    console.log(`[${userId}] Found ${allFetchedItems.length} top-level accessible items for snapshot ${snapshotId}.`);

    const detailedItems: any[] = [];
    for (const item of allFetchedItems) {
        console.log(`[${userId}] Processing item: ${item.id} (${item.object}) for snapshot ${snapshotId}`);
        
        let itemName: string | undefined;
        let itemParentId: string | undefined;
        let itemHash: string;
        let itemTitleTextForEmbedding: string | null = null;
        let itemDescriptionTextForEmbedding: string | null = null;
        let itemTypeTextForEmbedding: 'page_title' | 'database_title' | 'database_description' | null = null;
        let itemHasTitleEmbedding = false;
        let itemHasDescriptionEmbedding = false;

        if (item.object === 'page') {
            const pageItem = item; // Already correctly typed as PageObjectResponse due to discriminated union
            const { last_edited_time, last_edited_by, created_time, created_by, ...hashablePageContent } = pageItem;
            const pageString = JSON.stringify(hashablePageContent);
            itemHash = computeSha256(pageString);
            
            const titleProperty = Object.values(pageItem.properties).find(prop => prop.type === 'title');
            if (titleProperty && 'title' in titleProperty && titleProperty.title) {
                itemName = getPlainTextFromRichText(titleProperty.title).trim();
            }
            itemTitleTextForEmbedding = itemName || null; // Assign for embedding
            if (itemTitleTextForEmbedding) itemTypeTextForEmbedding = 'page_title';

            if (pageItem.parent?.type === 'page_id') itemParentId = pageItem.parent.page_id;
            else if (pageItem.parent?.type === 'database_id') itemParentId = pageItem.parent.database_id;
            else if (pageItem.parent?.type === 'workspace') itemParentId = 'workspace';

            hashManifest[pageItem.id] = { hash: itemHash, type: 'page', name: itemName || 'Untitled Page', parentId: itemParentId, hasTitleEmbedding: itemHasTitleEmbedding };
            (pageItem as any).contentHash = itemHash;
            
            const blocks = await fetchAllBlocks(notion, pQueue, pageItem.id, hashManifest, snapshotId); 
            detailedItems.push({ ...pageItem, blocks: blocks });

        } else if (item.object === 'database') {
            const dbItem = item; // Correctly typed as DatabaseObjectResponse
            const { last_edited_time, last_edited_by, created_time, created_by, ...hashableDbContent } = dbItem;
            const dbString = JSON.stringify(hashableDbContent);
            itemHash = computeSha256(dbString);

            if (dbItem.title) itemName = getPlainTextFromRichText(dbItem.title).trim();
            itemTitleTextForEmbedding = itemName || null;
            if (itemTitleTextForEmbedding) itemTypeTextForEmbedding = 'database_title';

            if (dbItem.description) itemDescriptionTextForEmbedding = getPlainTextFromRichText(dbItem.description).trim() || null;
            
            if (dbItem.parent?.type === 'page_id') itemParentId = dbItem.parent.page_id;
            else if (dbItem.parent?.type === 'workspace') itemParentId = 'workspace';

            hashManifest[dbItem.id] = { 
                hash: itemHash, 
                type: 'database', 
                name: itemName || 'Untitled Database', 
                parentId: itemParentId, 
                hasTitleEmbedding: itemHasTitleEmbedding, 
                hasDescriptionEmbedding: itemHasDescriptionEmbedding 
            };
            (dbItem as any).contentHash = itemHash;
            
            const rows = await fetchAllDatabaseRows(notion, pQueue, dbItem.id, hashManifest, snapshotId);
            detailedItems.push({ ...dbItem, rows: rows });
        } else {
            // Should not happen due to prior filtering of allFetchedItems
            console.warn(`[SnapshotWorker] Unexpected item type in allFetchedItems:`, (item as any)?.object);
            detailedItems.push(item); // Add raw item if type is unknown
            continue; // Skip embedding for unknown items
        }

        // --- Embedding Logic (now uses itemTitleTextForEmbedding, itemDescriptionTextForEmbedding) ---
        if (openaiClient && pineconeClient && pineconeIndexName && tokenizer) {
            if (itemTitleTextForEmbedding && itemTitleTextForEmbedding.trim().length > 0 && itemTypeTextForEmbedding) {
                try {
                    const tokens = tokenizer.encode(itemTitleTextForEmbedding);
                    const truncatedTokens = tokens.slice(0, MAX_CHUNK_TOKENS);
                    const textForEmbedding = new TextDecoder().decode(tokenizer.decode(truncatedTokens));
                    if (textForEmbedding.trim().length > 0) {
                        const embeddingResponse = await withRetry(() => openaiClient!.embeddings.create({
                            model: OPENAI_EMBEDDING_MODEL,
                            input: textForEmbedding,
                        }), 3, 1000, `OpenAI embedding for ${itemTypeTextForEmbedding} ${item.id}`);
                        const embedding = embeddingResponse.data[0]?.embedding;
                        if (embedding) {
                            recordsToUpsertToPinecone.push({
                                id: `${snapshotId}:${item.id}:title`,
                                values: embedding,
                                metadata: { snapshotId, itemId: item.id, itemType: itemTypeTextForEmbedding, originalText: textForEmbedding.substring(0, 200) }
                            });
                            itemHasTitleEmbedding = true;
                        }
                    }
                } catch (embeddingError) { console.error(`[Embeddings] Failed for ${itemTypeTextForEmbedding} ${item.id}:`, embeddingError); }
            }
            if (itemDescriptionTextForEmbedding && itemDescriptionTextForEmbedding.trim().length > 0 && item.object === 'database') {
                 try {
                    const tokens = tokenizer.encode(itemDescriptionTextForEmbedding);
                    const truncatedTokens = tokens.slice(0, MAX_CHUNK_TOKENS);
                    const textForEmbedding = new TextDecoder().decode(tokenizer.decode(truncatedTokens));
                    if (textForEmbedding.trim().length > 0) {
                        const embeddingResponse = await withRetry(() => openaiClient!.embeddings.create({
                            model: OPENAI_EMBEDDING_MODEL,
                            input: textForEmbedding,
                        }), 3, 1000, `OpenAI embedding for DB description ${item.id}`);
                        const embedding = embeddingResponse.data[0]?.embedding;
                        if (embedding) {
                            recordsToUpsertToPinecone.push({
                                id: `${snapshotId}:${item.id}:description`,
                                values: embedding,
                                metadata: { snapshotId, itemId: item.id, itemType: 'database_description', originalText: textForEmbedding.substring(0, 200) }
                            });
                            itemHasDescriptionEmbedding = true;
                        }
                    }
                } catch (embeddingError) { console.error(`[Embeddings] Failed for database_description ${item.id}:`, embeddingError); }
            }
        }
    }

    const finalSnapshotData = {
        metadata: {
            userId: userId,
            snapshotId: snapshotId,
            snapshotTimestamp: new Date().toISOString(),
            source: "snapshotWorker",
            itemCount: detailedItems.length, 
        },
        items: detailedItems 
    };
    console.log(`[${userId}] Notion data fetch processing complete.`);

    // --- Upsert embeddings to Pinecone --- (Updated with retry and batching)
    if (openaiClient && pineconeClient && pineconeIndexName && recordsToUpsertToPinecone.length > 0) {
      console.log(`[${userId}] Preparing to upsert ${recordsToUpsertToPinecone.length} embeddings to Pinecone for snapshot ${snapshotId} into namespace '${userId}'...`);
      try {
        const index = pineconeClient.index(pineconeIndexName);
        const namespacedIndex = index.namespace(userId); // Get namespaced index object

        const batchSize = 50;
        for (let i = 0; i < recordsToUpsertToPinecone.length; i += batchSize) {
          const batch = recordsToUpsertToPinecone.slice(i, i + batchSize);
          // Call upsert on the namespacedIndex object
          await withRetry(() => namespacedIndex.upsert(batch), 3, 1000, `Pinecone upsert batch ${Math.floor(i/batchSize) + 1} for user ${userId} in namespace ${userId}`);
          console.log(`[${userId}] Upserted batch ${Math.floor(i/batchSize) + 1} to Pinecone namespace '${userId}'.`);
        }
        console.log(`[${userId}] Pinecone upsert completed for snapshot ${snapshotId} into namespace '${userId}'.`);
      } catch (pineconeError) {
        console.error(`[${userId}] Failed to upsert embeddings to Pinecone for snapshot ${snapshotId} into namespace '${userId}':`, pineconeError);
      }
    }
    recordsToUpsertToPinecone = [];
    // --- End Pinecone Upsert ---

    const jsonData = JSON.stringify(finalSnapshotData, null, 2);
    const compressedData = await gzipAsync(Buffer.from(jsonData, 'utf-8'));
    console.log(`[${userId}] Snapshot data compressed for snapshot ${snapshotId}.`);

    // Store hashManifest.json.gz (GCS only for now)
    const manifestJsonData = JSON.stringify(hashManifest, null, 2);
    const compressedManifestData = await gzipAsync(Buffer.from(manifestJsonData, 'utf-8'));
    const manifestFileName = `${userId}/${snapshotId}.manifest.json.gz`;
    const manifestFile = storage.bucket(BUCKET_NAME!).file(manifestFileName);
    await manifestFile.save(compressedManifestData, {
        metadata: { contentType: 'application/gzip', metadata: { userId: userId } }
    });
    console.log(`[${userId}] Hash manifest uploaded to gs://${BUCKET_NAME}/${manifestFileName}`);

    // === Parallel Writes to All Storage Providers ===
    // 1. Fetch user storage configs
    const providerConfigsSnap = await db
      .collection('userStorageConfigs')
      .doc(userId)
      .collection('providers')
      .where('isEnabled', '==', true)
      .get();
    const adapters: { name: string; adapter: any; path: string; meta: any }[] = [];
    // Always include GCS as primary
    adapters.push({
      name: 'gcs',
      adapter: {
        write: async (path: string, data: Buffer, metadata: any) => {
          const file = storage.bucket(BUCKET_NAME!).file(path);
          await file.save(data, { metadata });
        }
      },
      path: `${userId}/${snapshotId}.json.gz`,
      meta: {
        contentType: 'application/gzip',
        metadata: {
          userId: userId,
          snapshotId: snapshotId,
          requestedAt: job.requestedAt.toString(),
          hasManifest: 'true'
        }
      }
    });
    for (const doc of providerConfigsSnap.docs) {
      const cfg = doc.data();
      try {
        if (cfg.type === 's3') {
          const { S3StorageAdapter } = await import('../src/storage/S3StorageAdapter');
          adapters.push({
            name: 's3',
            adapter: new S3StorageAdapter({
              bucket: cfg.bucket,
              region: cfg.region,
              accessKeyId: await decryptString(cfg.encryptedAccessKeyId),
              secretAccessKey: await decryptString(cfg.encryptedSecretAccessKey),
              endpoint: cfg.endpoint,
              forcePathStyle: cfg.forcePathStyle,
            }),
            path: `${userId}/${snapshotId}.json.gz`,
            meta: {
              contentType: 'application/gzip',
              metadata: {
                userId: userId,
                snapshotId: snapshotId,
                requestedAt: job.requestedAt.toString(),
                hasManifest: 'true'
              }
            }
          });
        } else if (cfg.type === 'r2') {
          const { R2StorageAdapter } = await import('../src/storage/R2StorageAdapter');
          adapters.push({
            name: 'r2',
            adapter: new R2StorageAdapter({
              bucket: cfg.bucket,
              endpoint: cfg.endpoint,
              accessKeyId: await decryptString(cfg.encryptedAccessKeyId),
              secretAccessKey: await decryptString(cfg.encryptedSecretAccessKey),
              region: cfg.region || 'auto',
              forcePathStyle: cfg.forcePathStyle === undefined ? true : cfg.forcePathStyle,
            }),
            path: `${userId}/${snapshotId}.json.gz`,
            meta: {
              contentType: 'application/gzip',
              metadata: {
                userId: userId,
                snapshotId: snapshotId,
                requestedAt: job.requestedAt.toString(),
                hasManifest: 'true'
              }
            }
          });
        }
        // Add more adapters here if needed (e.g., GCS, Azure, etc.)
      } catch (err) {
        console.error(`[${userId}] Failed to instantiate adapter for provider ${cfg.type}:`, err);
      }
    }
    // 2. Write to all adapters in parallel
    const writeResults = await Promise.allSettled(
      adapters.map(({ adapter, path, meta, name }) =>
        adapter.write(path, compressedData, meta).then(() => name)
      )
    );
    writeResults.forEach((result, idx) => {
      const name = adapters[idx].name;
      if (result.status === 'fulfilled') {
        console.log(`[${userId}] Snapshot write succeeded for adapter: ${name}`);
      } else {
        console.error(`[${userId}] Snapshot write failed for adapter: ${name}:`, result.reason);
      }
    });

    if (posthogClient) {
        posthogClient.capture({
            distinctId: userId,
            event: 'snapshot_job_success',
            properties: {
                snapshotId,
                gcsPath: `gs://${BUCKET_NAME}/${userId}/${snapshotId}.json.gz`,
                itemCount: finalSnapshotData.metadata.itemCount,
                manifestGenerated: true,
            }
        });
    }

    // M6.1: Add audit log for snapshot creation
    try {
      const auditLogEntry = {
        timestamp: FieldValue.serverTimestamp(),
        type: 'snapshot_created',
        details: {
          snapshotId: snapshotId,
          gcsPath: `gs://${BUCKET_NAME}/${userId}/${snapshotId}.json.gz`,
          itemCount: finalSnapshotData.metadata.itemCount,
          status: 'success'
        },
      };
      await db.collection('users').doc(userId).collection('audit').add(auditLogEntry);
      console.log(`[${userId}] Audit log created for successful snapshot ${snapshotId}.`);

      // A.1 / A.4 Prerequisite: Save snapshot record to Firestore for querying/diffing
      const snapshotRecord = {
        snapshotId: snapshotId,
        userId: userId,
        timestamp: finalSnapshotData.metadata.snapshotTimestamp, // ISOString from metadata
        gcsPath: `gs://${BUCKET_NAME}/${userId}/${snapshotId}.json.gz`,
        manifestPath: `gs://${BUCKET_NAME}/${manifestFileName}`,
        itemCount: finalSnapshotData.metadata.itemCount,
        sizeKB: Math.round(compressedData.byteLength / 1024), // Approximate size of compressed data
        status: 'success',
        hasManifest: true,
        // diffSummary will be added by the diff logic later if applicable
      };
      await db.collection('users').doc(userId).collection('snapshots').doc(snapshotId).set(snapshotRecord);
      console.log(`[${userId}] Snapshot record saved to Firestore for ${snapshotId}.`);

    } catch (auditOrRecordError) {
      console.error(`[${userId}] Failed to write audit log or snapshot record for ${snapshotId}:`, auditOrRecordError);
    }

    // A.1 Diff engine comparison step
    try {
        console.log(`[${userId}] Starting diff comparison for snapshot ${snapshotId}...`);
        // 1. Find the previous successful snapshot with a manifest for this user
        // This query assumes snapshots are recorded in a user-specific collection, e.g., 'userSnapshots' or on the user doc.
        // For this example, let's assume a subcollection `snapshots` under the user doc, 
        // where each doc is a snapshot record containing `gcsPath`, `manifestPath`, `timestamp`, `status: 'success'`.
        // This part of data model is an assumption.
        const previousSnapshotsQuery = db.collection('users').doc(userId).collection('snapshots')
            .where('status', '==', 'success')
            .where('hasManifest', '==', true)
            .where('snapshotId', '!=', snapshotId) // Exclude current snapshot
            .orderBy('snapshotId', 'desc') // Order by snapshotId (assuming it includes timestamp)
            .limit(1);
        
        const previousSnapshotDocs = await previousSnapshotsQuery.get();
        
        if (!previousSnapshotDocs.empty) {
            const previousSnapshotData = previousSnapshotDocs.docs[0].data();
            const previousSnapshotId = previousSnapshotDocs.docs[0].id; // or previousSnapshotData.snapshotId
            const previousManifestFileName = `${userId}/${previousSnapshotId}.manifest.json.gz`; // Construct based on previous snapshot ID
            
            console.log(`[${userId}] Previous snapshot for diff: ${previousSnapshotId}, manifest: ${previousManifestFileName}`);

            const previousManifestFile = storage.bucket(BUCKET_NAME!).file(previousManifestFileName);
            const [previousManifestExists] = await previousManifestFile.exists();

            if (previousManifestExists) {
                const [compressedOldManifestData] = await previousManifestFile.download();
                const oldManifestJsonData = (await promisify(require('zlib').gunzip)(compressedOldManifestData)).toString();
                const oldManifest: Record<string, HashManifestEntry> = JSON.parse(oldManifestJsonData);

                let addedCount = 0;
                let removedCount = 0;
                let changedCount = 0;

                const allKeys = new Set([...Object.keys(hashManifest), ...Object.keys(oldManifest)]);

                allKeys.forEach(key => {
                    const newHash = hashManifest[key].hash;
                    const oldHash = oldManifest[key].hash;
                    if (newHash && !oldHash) {
                        addedCount++;
                    } else if (!newHash && oldHash) {
                        removedCount++;
                    } else if (newHash && oldHash && newHash !== oldHash) {
                        changedCount++;
                    }
                });

                const diffSummary = {
                    snapshotId: snapshotId,
                    previousSnapshotId: previousSnapshotId,
                    added: addedCount,
                    removed: removedCount,
                    changed: changedCount,
                    comparedAt: FieldValue.serverTimestamp(),
                };
                await db.collection('users').doc(userId).collection('snapshotDiffs').doc(snapshotId).set(diffSummary);
                console.log(`[${userId}] Diff summary for ${snapshotId} (vs ${previousSnapshotId}) stored: +${addedCount} ~${changedCount} -${removedCount}`);
            } else {
                console.log(`[${userId}] Previous manifest gs://${BUCKET_NAME}/${previousManifestFileName} not found. Skipping diff.`);
            }
        } else {
            console.log(`[${userId}] No previous successful snapshot with manifest found for user. Skipping diff.`);
        }
    } catch (diffError) {
        console.error(`[${userId}] Error during diff computation for snapshot ${snapshotId}:`, diffError);
        // Non-fatal for the snapshot itself
    }

  } catch (error: any) {
    console.error(`[${userId}] Snapshot ${snapshotId} failed:`, error);
    if (posthogClient) {
        posthogClient.capture({
            distinctId: userId,
            event: 'snapshot_job_failed',
            properties: { 
                snapshotId, 
                error: error.message || 'Unknown error', 
                stack: error.stack 
            }
        });
    }
    // TODO: Update snapshot record in Firestore to status 'failed' if one is created at the start
    throw error; 
  } finally {
    if (posthogClient) {
        await posthogClient.shutdownAsync(); // Ensure events are flushed
    }
  }
}); 