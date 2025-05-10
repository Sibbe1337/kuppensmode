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
const functions = __importStar(require("@google-cloud/functions-framework"));
const storage_1 = require("@google-cloud/storage");
const firestore_1 = require("@google-cloud/firestore");
const client_1 = require("@notionhq/client");
const secret_manager_1 = require("@google-cloud/secret-manager");
const zlib_1 = require("zlib");
const util_1 = require("util");
// import PQueue from 'p-queue'; // Will be dynamically imported
const gzipAsync = (0, util_1.promisify)(zlib_1.gzip);
// GCP Clients (initialized outside handler)
const storage = new storage_1.Storage();
const db = new firestore_1.Firestore();
const secretManagerClient = new secret_manager_1.SecretManagerServiceClient();
// Environment Variables
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
// Initialize Rate Limiter queue (will be initialized dynamically)
let notionQueue;
// --- Helper Functions (TODO: Refactor/share with restore-worker if possible) ---
// Example: Function to get Notion access token for a user from Firestore
async function getUserNotionAccessToken(userId) {
    console.log(`[${userId}] Fetching Notion access token from Firestore...`);
    try {
        // TODO: Adjust path based on where you store Notion credentials after OAuth
        const integrationRef = db.collection('users').doc(userId).collection('integrations').doc('notion');
        const doc = await integrationRef.get();
        if (!doc.exists) {
            console.warn(`[${userId}] Notion integration document not found.`);
            return null;
        }
        const accessToken = doc.data()?.accessToken; // Assuming the field is named accessToken
        if (!accessToken) {
            console.warn(`[${userId}] Notion access token not found in integration document.`);
            return null;
        }
        console.log(`[${userId}] Successfully fetched Notion access token.`);
        return accessToken;
    }
    catch (error) {
        console.error(`[${userId}] Error fetching Notion access token:`, error);
        return null;
    }
}
// Helper function to fetch all blocks for a given block ID (recursively handles pagination AND children)
async function fetchAllBlocks(notionClient, queue, blockId) {
    let allBlocks = [];
    let nextCursor = undefined;
    console.log(`[fetchAllBlocks] Fetching blocks for parent: ${blockId}`);
    do {
        try {
            const response = await queue.add(() => notionClient.blocks.children.list({
                block_id: blockId,
                start_cursor: nextCursor || undefined,
                page_size: 100 // Max page size
            }));
            // Process results before adding to ensure children are fetched
            const processedBlocks = [];
            for (const block of response.results) {
                // Check if the block has children that need fetching
                if (block.has_children) { // Use type assertion as type might not include has_children
                    console.log(`[fetchAllBlocks] Block ${block.id} has children, fetching recursively...`);
                    const childrenBlocks = await fetchAllBlocks(notionClient, queue, block.id);
                    processedBlocks.push({ ...block, children: childrenBlocks });
                }
                else {
                    processedBlocks.push(block); // Block has no children or type doesn't support them
                }
            }
            allBlocks = allBlocks.concat(processedBlocks);
            nextCursor = response.next_cursor;
            console.log(`[fetchAllBlocks] Fetched and processed ${processedBlocks.length} blocks for ${blockId}, has_more: ${!!nextCursor}`);
        }
        catch (error) {
            console.error(`[fetchAllBlocks] Error fetching blocks for ${blockId}, cursor: ${nextCursor}:`, error);
            nextCursor = null;
        }
    } while (nextCursor);
    console.log(`[fetchAllBlocks] Finished fetching ${allBlocks.length} total blocks (including nested) for parent: ${blockId}`);
    return allBlocks;
}
// Helper function to fetch all pages (rows) within a database (recursively handles pagination)
async function fetchAllDatabaseRows(notionClient, queue, databaseId) {
    let allRows = [];
    let nextCursor = undefined;
    console.log(`[fetchAllDatabaseRows] Fetching rows for database: ${databaseId}`);
    do {
        try {
            const response = await queue.add(() => notionClient.databases.query({
                database_id: databaseId,
                start_cursor: nextCursor || undefined,
                page_size: 100 // Max page size
            }));
            allRows = allRows.concat(response.results);
            nextCursor = response.next_cursor;
            console.log(`[fetchAllDatabaseRows] Fetched ${response.results.length} rows for ${databaseId}, has_more: ${!!nextCursor}`);
        }
        catch (error) {
            console.error(`[fetchAllDatabaseRows] Error fetching rows for ${databaseId}, cursor: ${nextCursor}:`, error);
            nextCursor = null; // Stop fetching rows for this database on error
        }
    } while (nextCursor);
    console.log(`[fetchAllDatabaseRows] Finished fetching ${allRows.length} total rows for database: ${databaseId}`);
    // TODO: Optionally fetch blocks for each row (page) here if full content is needed
    return allRows;
}
// --- Main Cloud Function Logic ---
functions.cloudEvent('snapshotWorker', async (cloudEvent) => {
    if (!BUCKET_NAME) {
        throw new Error("GCS_BUCKET_NAME environment variable not set.");
    }
    if (!GCP_PROJECT_ID) {
        // Might not be strictly required if clients initialize via ADC/JSON key correctly,
        // but useful for logging/context.
        console.warn("GOOGLE_CLOUD_PROJECT environment variable not set.");
    }
    // 1. Parse Job Data
    if (!cloudEvent.data?.message?.data) {
        console.error('Invalid Pub/Sub message format: Missing data.message.data');
        return; // Acknowledge invalid format
    }
    let job;
    try {
        const messageData = Buffer.from(cloudEvent.data.message.data, 'base64').toString();
        job = JSON.parse(messageData);
        console.log(`Received snapshot job for user: ${job.userId}, requested at: ${new Date(job.requestedAt).toISOString()}`);
    }
    catch (err) {
        console.error('Failed to parse Pub/Sub message data:', err);
        return; // Acknowledge malformed message
    }
    const { userId } = job;
    try {
        // 2. Get User's Notion Credentials & Initialize Clients
        if (!notionQueue) { // Initialize PQueue on first invocation/cold start
            const { default: PQueueConstructor } = await Promise.resolve().then(() => __importStar(require('p-queue')));
            notionQueue = new PQueueConstructor({ intervalCap: 3, interval: 1000 }); // Notion API limit ~3 req/sec
            console.log('P-Queue initialized for Notion API rate limiting.');
        }
        const notionToken = await getUserNotionAccessToken(userId);
        if (!notionToken) {
            throw new Error(`Could not retrieve Notion token for user ${userId}. Cannot create snapshot.`);
        }
        const notion = new client_1.Client({ auth: notionToken });
        // 3. Implement Notion Data Fetching Logic
        console.log(`[${userId}] Starting Notion data fetch...`);
        let allFetchedItems = []; // Store all fetched pages/databases/blocks here
        // Search for top-level pages/databases accessible to the integration
        // Use notionQueue.add() to rate limit API calls
        const searchResponse = await notionQueue.add(() => notion.search({
            // No query = search everything accessible
            // Add filters if needed (e.g., filter: { property: "object", value: "page" })
            page_size: 100 // Fetch pages in batches
        }));
        allFetchedItems.push(...searchResponse.results);
        let nextCursor = searchResponse.next_cursor;
        // Handle pagination for search results
        while (nextCursor) {
            console.log(`[${userId}] Fetching next page of search results...`);
            const nextPageResponse = await notionQueue.add(() => notion.search({ start_cursor: nextCursor, page_size: 100 }));
            allFetchedItems.push(...nextPageResponse.results);
            nextCursor = nextPageResponse.next_cursor;
        }
        console.log(`[${userId}] Found ${allFetchedItems.length} top-level accessible items.`);
        // TODO: Recursively fetch block children for pages
        // TODO: Query database content for databases
        // This requires more complex logic: looping through items, checking type,
        // making further API calls (blocks.children.list, databases.query) using notionQueue,
        // handling pagination for those calls, and adding results to a final structure.
        // --- Start Recursive Fetching Logic ---
        const detailedItems = []; // Array to hold items with their content
        for (const item of allFetchedItems) {
            console.log(`[${userId}] Processing item: ${item.id} (${item.object})`);
            if (item.object === 'page') {
                console.log(`[${userId}]   Item is a page. Fetching blocks...`);
                const blocks = await fetchAllBlocks(notion, notionQueue, item.id);
                detailedItems.push({ ...item, blocks: blocks });
            }
            else if (item.object === 'database') {
                console.log(`[${userId}]   Item is a database. Fetching rows...`);
                const rows = await fetchAllDatabaseRows(notion, notionQueue, item.id);
                // NOTE: rows are page objects. You might want to fetch blocks for these pages too.
                detailedItems.push({ ...item, rows: rows });
            }
            else {
                console.log(`[${userId}]   Skipping item of type ${item.object}`);
                detailedItems.push(item); // Keep other types as is
            }
        }
        // --- End Recursive Fetching Logic ---
        const finalSnapshotData = {
            metadata: {
                userId: userId,
                snapshotTimestamp: new Date().toISOString(),
                source: "snapshotWorker",
                itemCount: detailedItems.length, // Count includes pages/dbs potentially with content
            },
            items: detailedItems // Use the array with placeholders for content
        };
        console.log(`[${userId}] Notion data fetch processing complete (content fetching placeholders).`);
        // 4. Package Data
        const jsonData = JSON.stringify(finalSnapshotData, null, 2);
        // 5. Compress Data (e.g., gzip)
        const compressedData = await gzipAsync(Buffer.from(jsonData, 'utf-8'));
        console.log(`[${userId}] Snapshot data compressed.`);
        // 6. Upload to GCS
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Filesystem-friendly timestamp
        const fileName = `${userId}/snap_${timestamp}.json.gz`;
        const file = storage.bucket(BUCKET_NAME).file(fileName);
        console.log(`[${userId}] Uploading snapshot to gs://${BUCKET_NAME}/${fileName}`);
        await file.save(compressedData, {
            metadata: {
                contentType: 'application/gzip',
                // Add custom metadata if needed (e.g., source user, trigger type)
                metadata: {
                    userId: userId,
                    requestedAt: job.requestedAt.toString(),
                }
            }
        });
        console.log(`[${userId}] Snapshot uploaded successfully.`);
        // 7. TODO: (Optional) Update Firestore/Notify User
        // - Record snapshot success in Firestore?
        // - Send notification?
    }
    catch (error) {
        console.error(`[${userId}] Snapshot failed:`, error);
        // TODO: Add more robust error handling/notification
        // Rethrow error to make the function execution fail for potential retries/alerting
        throw error;
    }
});
//# sourceMappingURL=index.js.map