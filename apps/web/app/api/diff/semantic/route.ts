import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server'; // Or your preferred auth method
import { getDb } from '@/lib/firestore'; // Changed to getDb
import { Storage } from '@google-cloud/storage'; // GCS client
import { gunzipSync } from 'zlib'; // Node.js built-in zlib for decompression
import { Pinecone, type RecordMetadata, type PineconeRecord } from '@pinecone-database/pinecone';
import { env } from '@notion-lifeline/config';

export const runtime = 'nodejs';

// Define HashManifestEntry structure (should match snapshot-worker)
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

interface SemanticDiffRequest {
  userId: string; // Should be derived from auth, not passed by client ideally
  snapshotIdFrom: string;
  snapshotIdTo: string;
  // Optional: threshold for similarity, specific item IDs to focus on, etc.
}

// Define the type for a single changed item detail
type ChangedItemDetail = {
  id: string;
  name?: string;         // Add name from manifest
  itemType?: string;       // Add type from manifest (page, database, block)
  blockType?: string;    // Add blockType if applicable
  changeType: 'hash_only_similar' | 'semantic_divergence' | 'pending_semantic_check' | 'no_embeddings_found' | 'structural_change';
  similarityScore?: number;
};

interface SemanticDiffResult {
  summary: {
    added: number;
    deleted: number;
    contentHashChanged: number;
    semanticallySimilar: number; // Hash changed, but content is semantically similar
    semanticallyChanged: number; // Hash changed, and content is semantically different
  };
  details?: {
    addedItems: { id: string; name?: string; type?: string }[];
    deletedItems: { id: string; name?: string; type?: string }[];
    changedItems: ChangedItemDetail[]; // Use the defined type
  };
  error?: string;
  message?: string;
}

// Initialize GCS Storage client
const storage = new Storage(); // Assumes GOOGLE_APPLICATION_CREDENTIALS are set in the environment
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

// Pinecone Client Initialization
let pinecone: Pinecone | null = null;
const pineconeApiKey = env.PINECONE_API_KEY;
const pineconeIndexName = env.PINECONE_INDEX_NAME;

if (pineconeApiKey && pineconeIndexName) {
  pinecone = new Pinecone({ apiKey: pineconeApiKey });
  console.log("[API Semantic Diff] Pinecone client initialized.");
} else {
  console.warn("[API Semantic Diff] Pinecone API Key or Index Name not set. Semantic diff will be limited.");
}

async function downloadAndParseManifest(gcsPath: string): Promise<Record<string, HashManifestEntry>> {
  if (!BUCKET_NAME) {
    throw new Error("GCS_BUCKET_NAME environment variable not set.");
  }
  // gcsPath is expected to be like "userId/snap_id.manifest.json.gz"
  // Extract the actual file path for the bucket object
  const filePath = gcsPath.startsWith(`gs://${BUCKET_NAME}/`) 
    ? gcsPath.substring(`gs://${BUCKET_NAME}/`.length)
    : gcsPath;

  console.log(`[Semantic Diff] Downloading manifest from: gs://${BUCKET_NAME}/${filePath}`);
  const file = storage.bucket(BUCKET_NAME).file(filePath);
  const [compressedBuffer] = await file.download();
  const decompressedBuffer = gunzipSync(compressedBuffer);
  return JSON.parse(decompressedBuffer.toString('utf-8')) as Record<string, HashManifestEntry>;
}

// Helper to average an array of embeddings
function averageEmbeddings(embeddings: number[][]): number[] | undefined {
  if (!embeddings || embeddings.length === 0) return undefined;
  const dimension = embeddings[0].length;
  if (dimension === 0) return undefined;

  const sum = new Array(dimension).fill(0);
  embeddings.forEach(vec => {
    vec.forEach((val, i) => sum[i] += val);
  });
  return sum.map(val => val / embeddings.length);
}

// Helper function for dot product
function dotProduct(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must be of the same length for dot product.");
  }
  return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
}

// Helper function for vector magnitude
function magnitude(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

// Helper function for cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0; // Or handle error
  const product = dotProduct(vecA, vecB);
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);
  if (magA === 0 || magB === 0) return 0; // Avoid division by zero
  return product / (magA * magB);
}

// Define similarity thresholds
const SEMANTIC_SIMILARITY_THRESHOLD_HIGH = 0.95; // If > this, consider very similar despite hash change
const SEMANTIC_SIMILARITY_THRESHOLD_LOW = 0.85;  // If < this, consider significantly different
                                             // Between LOW and HIGH could be 'moderately similar' or just 'changed'

export async function POST(request: Request) {
  const db = getDb(); // Get instance here
  const { userId } = getAuth(request as any); // Or your preferred auth method
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body: SemanticDiffRequest = await request.json();
    const { snapshotIdFrom, snapshotIdTo } = body;
    if (!snapshotIdFrom || !snapshotIdTo || !BUCKET_NAME) return NextResponse.json({ error: 'Config error' }, { status: 400 });

    // Fetch manifests
    const userSnapshotsRef = db.collection('users').doc(userId).collection('snapshots');
    const fromSnapshotDoc = await userSnapshotsRef.doc(snapshotIdFrom).get();
    const toSnapshotDoc = await userSnapshotsRef.doc(snapshotIdTo).get();
    if (!fromSnapshotDoc.exists || !toSnapshotDoc.exists) return NextResponse.json({ error: 'Snapshots not found' }, { status: 404 });
    const fromSnapshotData = fromSnapshotDoc.data();
    const toSnapshotData = toSnapshotDoc.data();
    if (!fromSnapshotData?.manifestPath || !toSnapshotData?.manifestPath) return NextResponse.json({ error: 'Manifests missing' }, { status: 500 });
    const manifestFrom = await downloadAndParseManifest(fromSnapshotData.manifestPath);
    const manifestTo = await downloadAndParseManifest(toSnapshotData.manifestPath);

    // Basic diff from manifests
    const addedItems: any[] = [];
    const deletedItems: any[] = [];
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

    if (pinecone && pineconeIndexName) {
      const pineconeIdx = pinecone.index(pineconeIndexName);
      for (const changed of potentiallyChangedItems) {
        const { id: itemId, fromEntry, toEntry } = changed;
        let itemSimilarity = 0;
        let itemChangeType: ChangedItemDetail['changeType'] = 'pending_semantic_check';
        let comparedSomething = false;
        let debugComparisonType = 'none';

        try {
          let idsToFetchFromItem: string[] = [];
          let idsToFetchToItem: string[] = [];

          // Construct IDs based on item type from manifest
          if (fromEntry.type === 'page' || fromEntry.type === 'database') {
            if (fromEntry.hasTitleEmbedding) idsToFetchFromItem.push(`${snapshotIdFrom}:${itemId}:title`);
            if (fromEntry.type === 'database' && fromEntry.hasDescriptionEmbedding) idsToFetchFromItem.push(`${snapshotIdFrom}:${itemId}:description`);
          }
          if (toEntry.type === 'page' || toEntry.type === 'database') {
            if (toEntry.hasTitleEmbedding) idsToFetchToItem.push(`${snapshotIdTo}:${itemId}:title`);
            if (toEntry.type === 'database' && toEntry.hasDescriptionEmbedding) idsToFetchToItem.push(`${snapshotIdTo}:${itemId}:description`);
          }
          
          // If the item itself is a block, fetch all its chunks based on totalChunks from manifest
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

          // Extract and prepare vectors for comparison
          let vecsFrom: number[][] = [];
          let vecsTo: number[][] = [];
          
          if (fromEntry.type === 'page' || fromEntry.type === 'database') {
            const titleVec = fetchedVectorsMap[`${snapshotIdFrom}:${itemId}:title`]?.values;
            if (titleVec) vecsFrom.push(titleVec);
            if (fromEntry.type === 'database') {
              const descVec = fetchedVectorsMap[`${snapshotIdFrom}:${itemId}:description`]?.values;
              if (descVec) vecsFrom.push(descVec); // If both title and desc exist, they'll be averaged
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
          } else if (toEntry.type === 'block' && toEntry.type === 'block' && toEntry.totalChunks && toEntry.totalChunks > 0) {
            for (let i = 0; i < toEntry.totalChunks; i++) {
              const chunkVec = fetchedVectorsMap[`${snapshotIdTo}:${itemId}:chunk:${i}`]?.values;
              if (chunkVec) vecsTo.push(chunkVec);
            }
          }
          
          // Perform Comparison (using averaged embeddings if multiple were collected for an item type)
          if (vecsFrom.length > 0 && vecsTo.length > 0) {
            const avgVecFrom = averageEmbeddings(vecsFrom);
            const avgVecTo = averageEmbeddings(vecsTo);
            if (avgVecFrom && avgVecTo) {
              itemSimilarity = cosineSimilarity(avgVecFrom, avgVecTo);
              comparedSomething = true;
              debugComparisonType = fromEntry.type; 
            }
          }

          if (comparedSomething) {
            if (itemSimilarity >= SEMANTIC_SIMILARITY_THRESHOLD_HIGH) itemChangeType = 'hash_only_similar';
            else if (itemSimilarity < SEMANTIC_SIMILARITY_THRESHOLD_LOW) itemChangeType = 'semantic_divergence';
            else itemChangeType = 'semantic_divergence'; 

            if (itemChangeType === 'hash_only_similar') semanticallySimilarCount++;
            else semanticallyChangedCount++;
          } else {
            itemChangeType = 'no_embeddings_found';
          }
        } catch (e) {
          console.error(`[Semantic Diff] Error processing item ${itemId} (${fromEntry.type}):`, e);
          itemChangeType = 'pending_semantic_check';
        }
        changedItemDetailsOutput.push({ id: itemId, name: fromEntry.name, itemType: fromEntry.type, blockType: fromEntry.blockType, changeType: itemChangeType, similarityScore: comparedSomething ? parseFloat(itemSimilarity.toFixed(4)) : undefined });
      }
    } else {
      potentiallyChangedItems.forEach(changed => {
        changedItemDetailsOutput.push({ id: changed.id, name: changed.fromEntry.name, itemType: changed.fromEntry.type, blockType: changed.fromEntry.blockType, changeType: 'hash_only_similar' });
      });
    }
    
    const result: SemanticDiffResult = {
      summary: {
        added: addedItems.length,
        deleted: deletedItems.length,
        contentHashChanged: potentiallyChangedItems.length,
        semanticallySimilar: semanticallySimilarCount,
        semanticallyChanged: semanticallyChangedCount,
      },
      details: {
        addedItems: addedItems.map(i => ({id: i.id, name: i.name, type: i.type, blockType: i.blockType})),
        deletedItems: deletedItems.map(i => ({id: i.id, name: i.name, type: i.type, blockType: i.blockType})),
        changedItems: changedItemDetailsOutput,
      },
      message: pinecone && pineconeIndexName 
        ? "Semantic diff analysis performed."
        : "Hash comparison complete. Pinecone not configured; semantic analysis skipped."
    };
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API Semantic Diff] Error:", error);
    return NextResponse.json({ error: "Failed to process semantic diff.", details: error.message }, { status: 500 });
  }
} 