"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const storage_1 = require("@google-cloud/storage");
const firestore_1 = require("@google-cloud/firestore");
const functions = __importStar(require("@google-cloud/functions-framework"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const zlib = __importStar(require("zlib")); // For gzip decompression
const client_1 = require("@notionhq/client"); // Notion Client
const secret_manager_1 = require("@google-cloud/secret-manager"); // Added
const storage = new storage_1.Storage();
const db = new firestore_1.Firestore();
const secretManagerClient = new secret_manager_1.SecretManagerServiceClient(); // Added
const BUCKET = process.env.GCS_BUCKET_NAME;
// const NOTION_API_KEY = process.env.NOTION_API_KEY; // Removed direct env var usage
// Cached Notion API Key
let notionApiKey = null;
async function getNotionApiKey() {
    if (notionApiKey) {
        return notionApiKey;
    }
    // Replace with your actual secret resource ID:
    const name = 'projects/notion-lifeline/secrets/NOTION_WORKER_TOKEN/versions/latest';
    try {
        const [version] = await secretManagerClient.accessSecretVersion({ name });
        const payload = version.payload?.data?.toString();
        if (!payload) {
            throw new Error('Secret payload for Notion API key is empty.');
        }
        notionApiKey = payload;
        return notionApiKey;
    }
    catch (error) {
        console.error('Failed to access Notion API key from Secret Manager:', error);
        throw new Error('Could not retrieve Notion API key. Ensure the secret exists and the function has permissions.');
    }
}
if (!BUCKET) {
    throw new Error("GCS_BUCKET_NAME environment variable not set.");
}
// Removed initial NOTION_API_KEY check, will be checked on first use or pre-flight
// Initialize Notion Client - This will be initialized dynamically after fetching the key
let notion;
let notionQueue; // To be initialized with PQueue instance
/**
 * Google Cloud Function triggered by Pub/Sub topic `notion-lifeline-restore`.
 * Handles downloading a snapshot and restoring it to Notion.
 */
functions.cloudEvent('restoreWorker', async (cloudEvent) => {
    // Ensure Notion client and PQueue are initialized
    if (!notion || !notionQueue) {
        try {
            const apiKey = await getNotionApiKey();
            notion = new client_1.Client({ auth: apiKey });
            // Dynamically import PQueue and initialize
            const { default: PQueueConstructor } = await Promise.resolve().then(() => __importStar(require('p-queue')));
            notionQueue = new PQueueConstructor({ intervalCap: 3, interval: 1000 });
            console.log("Notion client and PQueue initialized successfully.");
        }
        catch (error) {
            console.error("Fatal: Could not initialize Notion client or PQueue:", error);
            // Depending on retry strategy, you might throw or return to acknowledge the Pub/Sub message
            // to prevent infinite retries if the key is permanently unavailable.
            // For now, throw to make the function execution fail clearly.
            throw error;
        }
    }
    if (!cloudEvent.data || !cloudEvent.data.message || typeof cloudEvent.data.message.data !== 'string') {
        console.error('Invalid Pub/Sub message format: Missing or invalid data.message.data');
        return; // Acknowledge the message to prevent retries for fundamentally bad format
    }
    let job;
    try {
        const messageData = Buffer.from(cloudEvent.data.message.data, 'base64').toString();
        job = JSON.parse(messageData);
        console.log(`Received restore job: ${job.restoreId} for user: ${job.userId}, snapshot: ${job.snapshotId}`);
    }
    catch (err) {
        console.error('Failed to parse Pub/Sub message data:', err);
        return; // Acknowledge - message is malformed
    }
    const { restoreId, userId, snapshotId, targets } = job;
    const progressRef = db.collection('restores').doc(userId).collection('items').doc(restoreId);
    // Helper to update progress in Firestore
    const updateProgress = async (status, message, percentage) => {
        const progressData = {
            status,
            message,
            percentage,
            updatedAt: Date.now(),
        };
        try {
            await progressRef.set(progressData, { merge: true });
            console.log(`[${restoreId}] Progress updated: ${status} - ${percentage}% - ${message}`);
        }
        catch (dbError) {
            console.error(`[${restoreId}] Failed to update Firestore progress:`, dbError);
            // Continue processing, but log the failure
        }
    };
    let tempFilePath = null; // Define here for cleanup in finally block
    try {
        await updateProgress('downloading', 'Starting snapshot download...', 5);
        // --- 1. Download snapshot from GCS --- 
        // snapshotId should be the full path in GCS, e.g., "user_123/snap_abc.json.gz"
        const file = storage.bucket(BUCKET).file(snapshotId);
        const baseFilename = path.basename(snapshotId);
        tempFilePath = path.join(os.tmpdir(), `restore_${restoreId}_${baseFilename}`);
        console.log(`[${restoreId}] Downloading ${snapshotId} to ${tempFilePath}`);
        await file.download({ destination: tempFilePath });
        console.log(`[${restoreId}] Download complete.`);
        await updateProgress('decompressing', 'Snapshot downloaded, decompressing...', 15);
        // --- 2. Decompress (if needed) and Parse Snapshot --- 
        let snapshotJson;
        if (tempFilePath.endsWith('.gz')) {
            const fileContents = fs.readFileSync(tempFilePath);
            snapshotJson = zlib.gunzipSync(fileContents).toString('utf-8');
            console.log(`[${restoreId}] Decompressed gzipped file.`);
        }
        else {
            snapshotJson = fs.readFileSync(tempFilePath, 'utf-8');
        }
        // fs.unlinkSync(tempFilePath); // Clean up temp file immediately after reading
        // tempFilePath = null; // Clear path after deletion
        await updateProgress('parsing', 'Decompressed, parsing JSON data...', 25);
        const snapshotData = JSON.parse(snapshotJson);
        console.log(`[${restoreId}] Snapshot data parsed.`);
        await updateProgress('restoring', 'Data parsed, queueing Notion API calls...', 30);
        // --- 3. Restore Logic --- 
        let restoredItemCount = 0;
        let totalItemsToRestore = 0;
        // Assuming snapshotData is an object like { items: [SnapshotItem, ...] }
        // If your snapshot structure is different (e.g., snapshotData is directly an array), adjust accordingly.
        const allSnapshotItems = snapshotData?.items;
        if (Array.isArray(allSnapshotItems) && allSnapshotItems.length > 0) {
            const itemsTyped = allSnapshotItems; // Assume items match SnapshotItem structure
            let itemsToProcess;
            if (targets && targets.length > 0) {
                const targetSet = new Set(targets);
                itemsToProcess = itemsTyped.filter(item => item.id && targetSet.has(item.id));
                console.log(`[${restoreId}] Filtering by ${targets.length} target(s). Found ${itemsToProcess.length} item(s) to restore.`);
            }
            else {
                itemsToProcess = itemsTyped;
                console.log(`[${restoreId}] No targets specified. Attempting to restore all ${itemsToProcess.length} item(s) from snapshot.`);
            }
            totalItemsToRestore = itemsToProcess.length;
            if (totalItemsToRestore === 0) {
                console.log(`[${restoreId}] No items to restore after filtering (or snapshot items do not match targets).`);
                // Update progress to near completion as there's nothing to send to Notion.
                // Depending on desired behavior, this could also be 'completed'.
                await updateProgress('restoring', 'No matching items to restore.', 95);
            }
            else {
                for (const item of itemsToProcess) {
                    if (!item || typeof item.id !== 'string' || !item.type || !item.payload) {
                        console.warn(`[${restoreId}] Skipping invalid item structure:`, item);
                        // If we skip, we should consider if totalItemsToRestore needs adjustment
                        // or if this is an error state. For now, we just log and skip.
                        // To avoid issues with percentage calculation, ensure this doesn't count towards restoredItemCount.
                        continue;
                    }
                    notionQueue.add(async () => {
                        try {
                            console.log(`[${restoreId}] Attempting to restore item: ${item.id} (type: ${item.type})`);
                            switch (item.type) {
                                case 'page':
                                    // IMPORTANT: item.payload MUST be structured as per notion.pages.create arguments
                                    // e.g., { parent: { page_id: '...' }, properties: { ... }, children: [ ... ] }
                                    // The snapshot creation process is responsible for formatting this payload.
                                    await notion.pages.create(item.payload);
                                    console.log(`[${restoreId}] Successfully restored page from original ID: ${item.id}`);
                                    break;
                                case 'database':
                                    // IMPORTANT: item.payload MUST be structured as per notion.databases.create arguments
                                    // e.g., { parent: { page_id: '...' }, title: [ ... ], properties: { ... } }
                                    // The snapshot creation process is responsible for formatting this payload.
                                    await notion.databases.create(item.payload);
                                    console.log(`[${restoreId}] Successfully restored database from original ID: ${item.id}`);
                                    break;
                                default:
                                    console.warn(`[${restoreId}] Unknown item type '${item.type}' for item ID ${item.id}. Skipping.`);
                                    // This item will not be counted towards restoredItemCount or affect percentage completion directly.
                                    return; // Exit this specific task, do not increment restoredItemCount
                            }
                            restoredItemCount++;
                            // Ensure totalItemsToRestore is not zero to prevent NaN/Infinity
                            const percentageOfRestorePhase = totalItemsToRestore > 0 ? Math.round((restoredItemCount / totalItemsToRestore) * 65) : 65;
                            const currentPercentage = 30 + percentageOfRestorePhase; // 30% base + up to 65% for this phase
                            await updateProgress('restoring', `Restored item ${restoredItemCount}/${totalItemsToRestore}...`, Math.min(currentPercentage, 95));
                        }
                        catch (notionError) {
                            console.error(`[${restoreId}] Failed to restore item (original ID ${item.id}, type ${item.type}):`, notionError.body || notionError.message || notionError);
                            // Optional: Decide if one item failure should stop the whole restore or just log/skip
                            // To mark the entire job as errored, you might throw here or manage a global error flag.
                            // For now, we log and the queue continues with other items.
                            // Consider updating progress with specific item error.
                            // await updateProgress('error', `Failed on item ${item.id}: ${notionError.message}`, -1); // This would mark the whole job.
                        }
                    });
                }
            }
        }
        else {
            console.warn(`[${restoreId}] Snapshot data does not contain an array of items or is empty. Path 'snapshotData.items' was evaluated. Snapshot data:`, snapshotData);
            // Update progress accordingly if no items are found.
            await updateProgress('restoring', 'No items found in snapshot or snapshot format unexpected.', 30); // Or a different percentage/status
        }
        // Wait for all queued Notion API calls to complete
        await notionQueue.onIdle();
        console.log(`[${restoreId}] Notion API queue idle.`);
        // --- 4. Finalize --- 
        // Check if any errors occurred within the queue (requires more complex error tracking if not re-throwing)
        console.log(`[${restoreId}] Restore process completed successfully.`);
        await updateProgress('completed', 'Restore completed successfully!', 100);
    }
    catch (err) {
        console.error(`[${restoreId}] Restore failed:`, err);
        await updateProgress('error', `Restore failed: ${err.message || 'Unknown error'}`, -1);
        // Optional: Re-throw the error to make the Cloud Function execution fail explicitly,
        // which can trigger alerts or retries based on your function configuration.
        // throw err;
    }
    finally {
        // Ensure temp file is deleted even if errors occurred
        if (tempFilePath) {
            try {
                fs.unlinkSync(tempFilePath);
                console.log(`[${restoreId}] Cleaned up temp file: ${tempFilePath}`);
            }
            catch (cleanupError) {
                console.error(`[${restoreId}] Error cleaning up temp file ${tempFilePath}:`, cleanupError);
            }
        }
    }
});
//# sourceMappingURL=index.js.map