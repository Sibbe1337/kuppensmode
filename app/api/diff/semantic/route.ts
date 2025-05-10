import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/firestore'; // Firestore admin instance
import { Storage } from '@google-cloud/storage'; // GCS client
import { gunzipSync } from 'zlib'; // Node.js built-in zlib for decompression
import { Pinecone } from '@pinecone-database/pinecone';

export const runtime = 'nodejs';

interface SemanticDiffRequest {
  userId: string; // Should be derived from auth, not passed by client ideally
  snapshotIdFrom: string;
  snapshotIdTo: string;
  // Optional: threshold for similarity, specific item IDs to focus on, etc.
}

// Define the type for a single changed item detail
type ChangedItemDetail = {
  id: string;
  name?: string;
  type?: string;
  changeType: 'hash_only_similar' | 'semantic_divergence' | 'hash_match_content_semantically_different_ERROR' | 'pending_semantic_check';
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
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME;

if (pineconeApiKey && pineconeIndexName) {
  pinecone = new Pinecone({ apiKey: pineconeApiKey });
  console.log("[API Semantic Diff] Pinecone client initialized.");
} else {
  console.warn("[API Semantic Diff] Pinecone API Key or Index Name not set. Semantic diff will be limited.");
}

async function downloadAndParseManifest(gcsPath: string): Promise<Record<string, string>> {
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
  return JSON.parse(decompressedBuffer.toString('utf-8'));
}

// Helper to get all possible vector IDs for an item from a snapshot
// This is a simplified assumption. Real logic might need to query metadata or know chunk counts.
async function getItemVectorIdsForSnapshot(itemId: string, snapshotId: string): Promise<string[]> {
  // This is highly dependent on how IDs were constructed and if we know the number of chunks.
  // For now, let's assume a title and potentially up to N chunks (e.g., 10 for an example).
  // A more robust way would be to query Pinecone metadata for vectors matching itemId and snapshotId.
  const ids: string[] = [];
  ids.push(`${snapshotId}:${itemId}:title`); // For page/db titles
  ids.push(`${snapshotId}:${itemId}:description`); // For db descriptions
  for (let i = 0; i < 10; i++) { // Assuming max 10 chunks for simplicity here
    ids.push(`${snapshotId}:${itemId}:chunk:${i}`);
  }
  return ids;
}

export async function POST(request: Request) {
  const { userId: authenticatedUserId } = await auth();
  if (!authenticatedUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: SemanticDiffRequest = await request.json();
    const { snapshotIdFrom, snapshotIdTo } = body;

    if (!snapshotIdFrom || !snapshotIdTo || !BUCKET_NAME) {
      return NextResponse.json({ error: 'Missing snapshot IDs or GCS bucket configuration' }, { status: 400 });
    }

    console.log(`[API Semantic Diff] User: ${authenticatedUserId}, From: ${snapshotIdFrom}, To: ${snapshotIdTo}`);

    // Step 1: Fetch snapshot metadata (manifest paths) from Firestore
    const userSnapshotsRef = db.collection('users').doc(authenticatedUserId).collection('snapshots');
    const fromSnapshotDoc = await userSnapshotsRef.doc(snapshotIdFrom).get();
    const toSnapshotDoc = await userSnapshotsRef.doc(snapshotIdTo).get();

    if (!fromSnapshotDoc.exists || !toSnapshotDoc.exists) {
      return NextResponse.json({ error: 'One or both snapshots not found' }, { status: 404 });
    }
    const fromSnapshotData = fromSnapshotDoc.data();
    const toSnapshotData = toSnapshotDoc.data();

    if (!fromSnapshotData?.manifestPath || !toSnapshotData?.manifestPath) {
      return NextResponse.json({ error: 'Manifest path missing for one or both snapshots' }, { status: 500 });
    }

    // Step 2: Download and parse manifests
    const manifestFrom = await downloadAndParseManifest(fromSnapshotData.manifestPath);
    const manifestTo = await downloadAndParseManifest(toSnapshotData.manifestPath);

    // Step 3: Compare manifests
    const addedItems: {id: string}[] = [];
    const deletedItems: {id: string}[] = [];
    const potentiallyChangedItems: { id: string; hashFrom: string; hashTo: string }[] = [];

    const allItemIds = new Set([...Object.keys(manifestFrom), ...Object.keys(manifestTo)]);

    for (const itemId of allItemIds) {
      const hashFrom = manifestFrom[itemId];
      const hashTo = manifestTo[itemId];

      if (hashTo && !hashFrom) {
        addedItems.push({ id: itemId });
      } else if (hashFrom && !hashTo) {
        deletedItems.push({ id: itemId });
      } else if (hashFrom && hashTo && hashFrom !== hashTo) {
        potentiallyChangedItems.push({ id: itemId, hashFrom, hashTo });
      }
    }

    let semanticallySimilarCount = 0;
    let semanticallyChangedCount = 0;
    const changedItemDetailsOutput: ChangedItemDetail[] = [];

    if (pinecone && pineconeIndexName) {
      const pineconeIdx = pinecone.index(pineconeIndexName);
      for (const item of potentiallyChangedItems) {
        console.log(`[Semantic Diff] Checking item ${item.id} for semantic changes.`);
        const vectorIdsFrom = await getItemVectorIdsForSnapshot(item.id, snapshotIdFrom);
        const vectorIdsTo = await getItemVectorIdsForSnapshot(item.id, snapshotIdTo);

        // Fetch vectors - this can be batched for multiple items for efficiency
        let vectorsFromResponse, vectorsToResponse;
        if (vectorIdsFrom.length > 0) {
          vectorsFromResponse = await pineconeIdx.fetch(vectorIdsFrom);
        }
        if (vectorIdsTo.length > 0) {
          vectorsToResponse = await pineconeIdx.fetch(vectorIdsTo);
        }
        
        // TODO: Process fetched vectors (vectorsFromResponse.records, vectorsToResponse.records)
        // This would involve: 
        // 1. Aligning corresponding chunks/parts of an item if it was chunked.
        // 2. Calculating cosine similarity between corresponding vector pairs.
        // 3. Aggregating similarity scores if multiple chunks per item.
        // 4. Deciding if overall item is semantically similar or changed based on a threshold.

        // Placeholder logic for now:
        console.log(`[Semantic Diff] Placeholder: Item ${item.id} has hash change. Semantic check pending.`);
        changedItemDetailsOutput.push({
          id: item.id,
          changeType: 'pending_semantic_check', // Mark as pending real check
        });
      }
    } else {
      // Pinecone not configured, mark all hash changes as just contentHashChanged without semantic info
      potentiallyChangedItems.forEach(item => {
        changedItemDetailsOutput.push({
          id: item.id,
          changeType: 'hash_only_similar', // Or a specific 'semantic_check_unavailable'
        });
      });
    }
    
    const result: SemanticDiffResult = {
      summary: {
        added: addedItems.length,
        deleted: deletedItems.length,
        contentHashChanged: potentiallyChangedItems.length, // Total items with hash diff
        semanticallySimilar: semanticallySimilarCount, // Will be updated by TODO logic
        semanticallyChanged: semanticallyChangedCount, // Will be updated by TODO logic
      },
      details: {
        addedItems: addedItems.map(i => ({id: i.id, name: `Item ${i.id}`})), // Add placeholder names
        deletedItems: deletedItems.map(i => ({id: i.id, name: `Item ${i.id}`})),
        changedItems: changedItemDetailsOutput,
      },
      message: pinecone && pineconeIndexName 
        ? "Hash comparison complete. Semantic analysis placeholders in effect."
        : "Hash comparison complete. Pinecone not configured; semantic analysis skipped."
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("[API Semantic Diff] Error:", error);
    return NextResponse.json({ error: "Failed to process semantic diff.", details: error.message }, { status: 500 });
  }
} 