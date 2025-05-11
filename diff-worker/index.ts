import * as functions from '@google-cloud/functions-framework';
import type { CloudEvent } from '@google-cloud/functions-framework'; // Base CloudEvent type
import { Firestore, Timestamp } from '@google-cloud/firestore'; // Import Timestamp
import { Storage } from '@google-cloud/storage';
import { Pinecone, type PineconeRecord, type RecordMetadata } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { gunzipSync } from 'zlib';
import { get_encoding, Tiktoken } from 'tiktoken';
import { v4 as uuidv4 } from 'uuid'; // Though diffJobId comes from payload
import { generateDiffSummary, initOpenAIUtils } from './src/openaiUtils'; // Import new util

console.log("[DiffWorker] Cold start.");

// --- CONFIGURATION & CLIENTS ---
const db = new Firestore(); // Initialize Firestore directly
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const storage = new Storage();

let openaiClient: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log("[DiffWorker] OpenAI client initialized.");
  initOpenAIUtils(openaiClient); // Initialize the util with the client
} else {
  console.warn("[DiffWorker] OPENAI_API_KEY not set. Embedding-related features may fail.");
}

let pineconeClient: Pinecone | null = null;
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME;
if (pineconeApiKey && pineconeIndexName) {
  pineconeClient = new Pinecone({ apiKey: pineconeApiKey });
  console.log("[DiffWorker] Pinecone client initialized for index:", pineconeIndexName);
} else {
  console.warn("[DiffWorker] Pinecone API Key or Index Name not set. Semantic features will be limited.");
}

let tokenizer: Tiktoken;
try {
  tokenizer = get_encoding("cl100k_base");
} catch (e) {
  console.error("[DiffWorker] Failed to load tiktoken tokenizer:", e);
  throw new Error("Tiktoken tokenizer failed to load. Cannot proceed.");
}

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_CHUNK_TOKENS = 500;
const SEMANTIC_SIMILARITY_THRESHOLD_HIGH = 0.95;
const SEMANTIC_SIMILARITY_THRESHOLD_LOW = 0.85;

// --- INTERFACES (should align with those in /api/diff/semantic/route.ts and snapshot-worker) ---
interface DiffJobPayload {
  userId: string;
  snapshotIdFrom: string;
  snapshotIdTo: string;
  diffJobId: string;
  requestedAt: string;
}

interface HashManifestEntry {
  hash: string;
  type: 'page' | 'database' | 'block';
  name?: string; 
  blockType?: string; 
  parentId?: string; 
  hasTitleEmbedding?: boolean;
  hasDescriptionEmbedding?: boolean;
  totalChunks?: number;
}

type ChangedItemDetail = {
  id: string;
  name?: string;
  itemType?: string;
  blockType?: string;
  changeType: 'hash_only_similar' | 'semantic_divergence' | 'pending_semantic_check' | 'no_embeddings_found' | 'structural_change';
  similarityScore?: number;
};

interface SemanticDiffResult {
  diffJobId: string;
  userId: string;
  snapshotIdFrom: string;
  snapshotIdTo: string;
  status: 'processing' | 'completed' | 'error';
  summary: any;
  details?: any;
  error?: string;
  message?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  llmSummary?: string;
  llmModel?: string;
  llmTokens?: number;
}

// --- HELPER FUNCTIONS (Copied from /api/diff/semantic/route.ts) ---
async function downloadAndParseManifest(gcsPath: string): Promise<Record<string, HashManifestEntry>> {
  if (!BUCKET_NAME) throw new Error("GCS_BUCKET_NAME missing");
  const filePath = gcsPath.startsWith(`gs://${BUCKET_NAME}/`) ? gcsPath.substring(`gs://${BUCKET_NAME}/`.length) : gcsPath;
  const file = storage.bucket(BUCKET_NAME).file(filePath);
  const [compressedBuffer] = await file.download();
  const decompressedBuffer = gunzipSync(compressedBuffer);
  return JSON.parse(decompressedBuffer.toString('utf-8'));
}
function dotProduct(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) throw new Error("Vectors must be same length");
  return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
}
function magnitude(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const product = dotProduct(vecA, vecB);
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);
  if (magA === 0 || magB === 0) return 0;
  return product / (magA * magB);
}
function averageEmbeddings(embeddings: number[][]): number[] | undefined {
  if (!embeddings || embeddings.length === 0) return undefined;
  const dimension = embeddings[0].length;
  if (dimension === 0) return undefined;
  const sum = new Array(dimension).fill(0);
  embeddings.forEach(vec => { vec.forEach((val, i) => sum[i] += val); });
  return sum.map(val => val / embeddings.length);
}

// --- MAIN FUNCTION ---
// The data for a Pub/Sub-triggered function is a MessagePublishedData object
// which has a `message` property containing the PubsubMessage
interface PubsubMessage {
    data?: string; // Base64-encoded string
    attributes?: { [key: string]: string };
    messageId?: string;
    publishTime?: string;
}
interface MessagePublishedData {
    message: PubsubMessage;
    subscription: string;
}

functions.cloudEvent('diffWorker', async (cloudEvent: CloudEvent<MessagePublishedData>) => {
  if (!cloudEvent.data?.message?.data) {
    console.error('[DiffWorker] Invalid Pub/Sub message: No message data found');
    return;
  }
  let jobPayload: DiffJobPayload;
  try {
    const messageData = Buffer.from(cloudEvent.data.message.data as string, 'base64').toString('utf8');
    jobPayload = JSON.parse(messageData) as DiffJobPayload;
  } catch (err) {
    console.error('[DiffWorker] Failed to parse Pub/Sub message data:', err);
    return;
  }

  const { userId, snapshotIdFrom, snapshotIdTo, diffJobId } = jobPayload;
  console.log(`[DiffWorker] Processing job: ${diffJobId} for user ${userId}. Diffing ${snapshotIdFrom} <> ${snapshotIdTo}`);
  const resultsRef = db.collection('users').doc(userId).collection('diffResults').doc(diffJobId);

  try {
    await resultsRef.set({ 
      ...jobPayload,
      status: 'processing', 
      createdAt: Timestamp.now(), 
      updatedAt: Timestamp.now() 
    }, { merge: true });

    // Step 1: Fetch snapshot metadata (manifestPaths) from Firestore
    const userSnapshotsRef = db.collection('users').doc(userId).collection('snapshots');
    const fromSnapshotDoc = await userSnapshotsRef.doc(snapshotIdFrom).get();
    const toSnapshotDoc = await userSnapshotsRef.doc(snapshotIdTo).get();

    if (!fromSnapshotDoc.exists || !toSnapshotDoc.exists) {
      throw new Error('One or both snapshots not found in Firestore for diff worker.');
    }
    const fromSnapshotData = fromSnapshotDoc.data();
    const toSnapshotData = toSnapshotDoc.data();
    if (!fromSnapshotData?.manifestPath || !toSnapshotData?.manifestPath) {
      throw new Error('Manifest path missing for one or both snapshots for diff worker.');
    }

    // Step 2: Download and parse manifests
    const manifestFrom = await downloadAndParseManifest(fromSnapshotData.manifestPath);
    const manifestTo = await downloadAndParseManifest(toSnapshotData.manifestPath);

    // Step 3: Compare manifests for added, deleted, potentially changed items (same as in /api/diff/semantic)
    const addedItems: {id: string; name?: string; type?: string; blockType?: string}[] = [];
    const deletedItems: {id: string; name?: string; type?: string; blockType?: string}[] = [];
    const potentiallyChangedItems: { id: string; fromEntry: HashManifestEntry; toEntry: HashManifestEntry }[] = [];
    const allItemIds = new Set([...Object.keys(manifestFrom), ...Object.keys(manifestTo)]);
    for (const itemId of allItemIds) {
      const entryFrom = manifestFrom[itemId];
      const entryTo = manifestTo[itemId];
      if (entryTo && !entryFrom) addedItems.push({ id: itemId, name: entryTo.name, type: entryTo.type, blockType: entryTo.blockType });
      else if (entryFrom && !entryTo) deletedItems.push({ id: itemId, name: entryFrom.name, type: entryFrom.type, blockType: entryFrom.blockType });
      else if (entryFrom && entryTo && entryFrom.hash !== entryTo.hash) potentiallyChangedItems.push({ id: itemId, fromEntry: entryFrom, toEntry: entryTo });
    }

    let semanticallySimilarCount = 0;
    let semanticallyChangedCount = 0;
    const changedItemDetailsOutput: ChangedItemDetail[] = [];

    // Step 4 & 5: Semantic Comparison (copied & adapted from /api/diff/semantic/route.ts)
    if (pineconeClient && pineconeIndexName && openaiClient && tokenizer) {
      const pineconeIdx = pineconeClient.index(pineconeIndexName);
      for (const changed of potentiallyChangedItems) {
        // ... (Full logic for fetching embeddings for changed.fromEntry & changed.toEntry based on type/totalChunks,
        //       calculating itemSimilarity, and setting itemChangeType as implemented in /api/diff/semantic)
        // This block is identical to the one in app/api/diff/semantic/route.ts
        // For brevity, assuming this logic is copied here.
        // BEGIN COPIED/ADAPTED BLOCK from /api/diff/semantic/route.ts for semantic comparison
        const { id: itemId, fromEntry, toEntry } = changed;
        let itemSimilarity = 0;
        let itemChangeType: ChangedItemDetail['changeType'] = 'pending_semantic_check';
        let comparedSomething = false;
        let debugComparisonType = 'none';

        try {
          let idsToFetchFromItem: string[] = [];
          let idsToFetchToItem: string[] = [];
          if (fromEntry.type === 'page' || fromEntry.type === 'database') {
            if (fromEntry.hasTitleEmbedding) idsToFetchFromItem.push(`${snapshotIdFrom}:${itemId}:title`);
            if (fromEntry.type === 'database' && fromEntry.hasDescriptionEmbedding) idsToFetchFromItem.push(`${snapshotIdFrom}:${itemId}:description`);
          }
          if (toEntry.type === 'page' || toEntry.type === 'database') {
            if (toEntry.hasTitleEmbedding) idsToFetchToItem.push(`${snapshotIdTo}:${itemId}:title`);
            if (toEntry.type === 'database' && toEntry.hasDescriptionEmbedding) idsToFetchToItem.push(`${snapshotIdTo}:${itemId}:description`);
          }
          if (fromEntry.type === 'block' && fromEntry.totalChunks && fromEntry.totalChunks > 0) {
            for (let i = 0; i < fromEntry.totalChunks; i++) idsToFetchFromItem.push(`${snapshotIdFrom}:${itemId}:chunk:${i}`);
          }
          if (toEntry.type === 'block' && toEntry.totalChunks && toEntry.totalChunks > 0) {
            for (let i = 0; i < toEntry.totalChunks; i++) idsToFetchToItem.push(`${snapshotIdTo}:${itemId}:chunk:${i}`);
          }
          const allIdsToFetch = [...new Set([...idsToFetchFromItem, ...idsToFetchToItem])];
          let fetchedVectorsMap: Record<string, PineconeRecord> = {};
          if (allIdsToFetch.length > 0) {
            const fetchResp = await pineconeIdx.fetch(allIdsToFetch);
            if (fetchResp.records) fetchedVectorsMap = fetchResp.records;
          }

          // --- Corrected block for populating vecsFrom and vecsTo ---
          let vecsFrom: number[][] = []; 
          let vecsTo: number[][] = [];
          
          if (fromEntry.type === 'page' || fromEntry.type === 'database') {
              const titleVec = fetchedVectorsMap[`${snapshotIdFrom}:${itemId}:title`]?.values;
              if (titleVec) vecsFrom.push(titleVec);
              if (fromEntry.type === 'database') {
                  const descVec = fetchedVectorsMap[`${snapshotIdFrom}:${itemId}:description`]?.values;
                  if (descVec) vecsFrom.push(descVec);
              }
          } else if (fromEntry.type === 'block' && fromEntry.totalChunks && fromEntry.totalChunks > 0) {
              for (let i = 0; i < fromEntry.totalChunks; i++) {
                  const chunkVec = fetchedVectorsMap[`${snapshotIdFrom}:${itemId}:chunk:${i}`]?.values;
                  if (chunkVec) vecsFrom.push(chunkVec);
              }
          }

          if (toEntry.type === 'page' || toEntry.type === 'database') {
              const titleVec = fetchedVectorsMap[`${snapshotIdTo}:${itemId}:title`]?.values;
              if (titleVec) vecsTo.push(titleVec);
              if (toEntry.type === 'database') {
                  const descVec = fetchedVectorsMap[`${snapshotIdTo}:${itemId}:description`]?.values;
                  if (descVec) vecsTo.push(descVec);
              }
          } else if (toEntry.type === 'block' && toEntry.totalChunks && toEntry.totalChunks > 0) {
              for (let i = 0; i < toEntry.totalChunks; i++) {
                  const chunkVec = fetchedVectorsMap[`${snapshotIdTo}:${itemId}:chunk:${i}`]?.values;
                  if (chunkVec) vecsTo.push(chunkVec);
              }
          }
          // --- End corrected block ---
          
          if (vecsFrom.length > 0 && vecsTo.length > 0) {
            const avgVecFrom = averageEmbeddings(vecsFrom);
            const avgVecTo = averageEmbeddings(vecsTo);
            if (avgVecFrom && avgVecTo) {
                itemSimilarity = cosineSimilarity(avgVecFrom, avgVecTo);
                comparedSomething = true; debugComparisonType = fromEntry.type;
                if (itemSimilarity >= SEMANTIC_SIMILARITY_THRESHOLD_HIGH) itemChangeType = 'hash_only_similar';
                else if (itemSimilarity < SEMANTIC_SIMILARITY_THRESHOLD_LOW) itemChangeType = 'semantic_divergence';
                else itemChangeType = 'semantic_divergence'; 
                if (itemChangeType === 'hash_only_similar') semanticallySimilarCount++; else semanticallyChangedCount++;
            } else { itemChangeType = 'no_embeddings_found'; }
          } else { itemChangeType = (vecsFrom.length > 0 || vecsTo.length > 0) ? 'structural_change' : 'no_embeddings_found'; }
        } catch (e) { 
          console.error(`[DW SemDiff] Item ${itemId} (${fromEntry.type}):`, e); 
          itemChangeType = 'pending_semantic_check'; 
        }
        changedItemDetailsOutput.push({
            id: itemId,
            name: fromEntry?.name,
            itemType: fromEntry.type,
            blockType: fromEntry?.blockType,
            changeType: itemChangeType,
            similarityScore: comparedSomething ? parseFloat(itemSimilarity.toFixed(4)) : undefined
        });
      }
    } else {
      // Pinecone not configured, populate changedItemDetailsOutput with hash_only_similar
      potentiallyChangedItems.forEach(changed => {
        changedItemDetailsOutput.push({
          id: changed.id,
          name: changed.fromEntry?.name,
          itemType: changed.fromEntry.type,
          blockType: changed.fromEntry?.blockType,
          changeType: 'hash_only_similar'
        });
      });
    }

    const finalResult: SemanticDiffResult = {
      diffJobId,
      userId,
      snapshotIdFrom,
      snapshotIdTo,
      status: 'completed',
      summary: { added: addedItems.length, deleted: deletedItems.length, contentHashChanged: potentiallyChangedItems.length, semanticallySimilar: semanticallySimilarCount, semanticallyChanged: semanticallyChangedCount },
      details: { addedItems, deletedItems, changedItems: changedItemDetailsOutput },
      message: "Diff calculation completed by worker.",
      createdAt: (await resultsRef.get()).data()?.createdAt || Timestamp.now(), // Preserve original createdAt
      updatedAt: Timestamp.now(),
    };

    // Initialize OpenAI Client (if not already initialized globally/lazily)
    if (!openaiClient && process.env.OPENAI_API_KEY) {
      openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      console.log("[DiffWorker] OpenAI client initialized.");
      initOpenAIUtils(openaiClient); // Initialize the util with the client
    } else if (!process.env.OPENAI_API_KEY) {
      console.warn("[DiffWorker] OPENAI_API_KEY not set. LLM summary will be skipped.");
    } else if (openaiClient) {
      initOpenAIUtils(openaiClient); // Ensure util is init'd if client already exists
    }

    // --- Add LLM Summary --- 
    if (openaiClient && finalResult) { // Ensure client and result exist
      console.log(`[DiffWorker] Job ${diffJobId}: Attempting to generate LLM summary.`);
      try {
        const { text, tokens, modelUsed } = await generateDiffSummary(finalResult);
        finalResult.llmSummary = text;
        finalResult.llmModel   = modelUsed;
        finalResult.llmTokens  = tokens;
        console.log(`[DiffWorker] Job ${diffJobId}: LLM summary generated. Model: ${modelUsed}, Tokens: ${tokens}`);
      } catch (err) {
        console.error(`[DiffWorker] Job ${diffJobId}: GPT summary generation failed`, err);
        // Keep diff result but without llmSummary - it will be saved without these fields
        finalResult.llmSummary = "Automated summary generation failed."; // Add a placeholder error
        finalResult.llmModel = "none";
        finalResult.llmTokens = 0;
      }
    } else if (!finalResult) {
      console.error(`[DiffWorker] Job ${diffJobId}: Result object was null, cannot generate LLM summary or save.`);
      // Handle this critical error appropriately, maybe update job status to error
      await resultsRef.set({ status: 'error', error: 'Internal error: Diff result was null before LLM summary.', updatedAt: Timestamp.now() }, { merge: true });
      return; // Exit early
    } else {
      console.warn(`[DiffWorker] Job ${diffJobId}: OpenAI client not available or API key not set – skipping LLM summary.`);
      finalResult.llmSummary = "Automated summary not available (OpenAI not configured).";
      finalResult.llmModel = "none";
      finalResult.llmTokens = 0;
    }
    // --- End Add LLM Summary ---

    await resultsRef.set(finalResult); // Overwrite with final result
    console.log(`[DiffWorker] Successfully processed and stored diff job ${diffJobId} with LLM summary status.`);

  } catch (error: any) {
    console.error(`[DiffWorker] Error processing job ${jobPayload.diffJobId}:`, error);
    await resultsRef.set({ status: 'error', error: error.message, updatedAt: Timestamp.now() }, { merge: true });
  }
});

// Define the Message interface if it's not globally available via @google-cloud/functions-framework types
// This is often part of the Pub/Sub message structure provided by GCP.
interface Message {
    data?: string | Buffer; // Base64 encoded string or Buffer
    attributes?: {[key: string]: string};
    messageId?: string;
    publishTime?: string;
    orderingKey?: string;
  } 