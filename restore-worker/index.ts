import { Storage } from '@google-cloud/storage';
import { Firestore, FieldValue } from '@google-cloud/firestore';
import * as functions from '@google-cloud/functions-framework';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as zlib from 'zlib'; // For gzip decompression
import { Client } from '@notionhq/client'; // Notion Client
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'; // Added

const storage = new Storage();
const db = new Firestore();
const secretManagerClient = new SecretManagerServiceClient(); // Added
const BUCKET = process.env.GCS_BUCKET_NAME;
const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const DEFAULT_RESTORE_PARENT_PAGE_ID = process.env.DEFAULT_RESTORE_PARENT_PAGE_ID; // Optional: Set a default parent in env vars

// New function to get user-specific Notion access token from Firestore
async function getUserNotionAccessToken(userId: string): Promise<string> {
  if (!userId) {
    console.error('[RestoreWorker] getUserNotionAccessToken called without userId.');
    throw new Error('User ID is required to fetch Notion token.');
  }
  console.log(`[RestoreWorker] Fetching Notion access token for user ${userId}...`);
  try {
    const integrationRef = db.collection('users').doc(userId).collection('integrations').doc('notion');
    const doc = await integrationRef.get();
    if (!doc.exists) {
      console.warn(`[RestoreWorker] Notion integration document not found for user ${userId}.`);
      throw new Error(`Notion integration not found for user ${userId}.`);
    }
    const accessToken = doc.data()?.accessToken;
    if (!accessToken || typeof accessToken !== 'string') {
        console.warn(`[RestoreWorker] Notion access token not found or invalid in integration document for user ${userId}.`);
        throw new Error(`Notion access token not found or invalid for user ${userId}.`);
    }
    console.log(`[RestoreWorker] Successfully fetched Notion access token for user ${userId}.`);
    return accessToken;
  } catch (error: any) {
    console.error(`[RestoreWorker] Error fetching Notion access token for user ${userId}:`, error);
    // Re-throw to ensure the main handler catches it and can mark the job as failed.
    throw new Error(`Failed to retrieve Notion access token for user ${userId}: ${error.message}`);
  }
}

if (!BUCKET) {
  throw new Error("GCS_BUCKET_NAME environment variable not set.");
}
// Removed initial NOTION_API_KEY check, will be checked on first use or pre-flight

// Notion Client and PQueue will be initialized inside the handler

// Define the structure of the job payload from Pub/Sub
interface RestoreJob {
  restoreId: string;
  userId: string;
  snapshotId: string; // This is expected to be the GCS file path (e.g., userId/timestamp.json.gz)
  targets: string[] | null; // Optional specific page/db IDs to restore
  targetParentPageId?: string | null; // Added target parent ID
  requestedAt: number;
}

// Define the structure for progress updates in Firestore
interface RestoreProgress {
  status: 'pending' | 'downloading' | 'decompressing' | 'parsing' | 'restoring' | 'error' | 'completed';
  message: string;
  percentage: number; // 0-100, -1 for error
  updatedAt: number;
}

// Define the structure for items within the snapshot
// Updated to reflect actual snapshot structure
interface SnapshotItem {
  object: 'page' | 'database' | string; // Type of Notion object ('page', 'database', etc.)
  id: string; // Original ID
  // Common properties
  created_time?: string;
  last_edited_time?: string;
  created_by?: any;
  last_edited_by?: any;
  parent?: any;
  archived?: boolean;
  in_trash?: boolean;
  icon?: any; // Added icon
  cover?: any; // Added cover
  // Page specific (examples)
  properties?: any; // Page properties object
  url?: string;
  blocks?: any[]; // Fetched blocks for pages (added by fetchAllBlocks)
  // Database specific (examples)
  title?: any[]; // Database title array
  description?: any[];
  is_inline?: boolean;
  rows?: any[]; // Fetched rows (pages) for databases (added by fetchAllDatabaseRows)
  // We might need more specific types for properties, blocks, rows later
  // payload?: any; // Removed this old field
}

// Define the expected structure for the Pub/Sub message data
interface PubSubMessage {
  data: string; // Base64 encoded string
  // attributes?: { [key: string]: string };
  // messageId?: string;
  // publishTime?: string;
}

interface PubSubCloudEventData {
  message: PubSubMessage;
  // subscription?: string;
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

/**
 * Google Cloud Function triggered by Pub/Sub topic `notion-lifeline-restore`.
 * Handles downloading a snapshot and restoring it to Notion.
 */
functions.cloudEvent('restoreWorker', async (cloudEvent: functions.CloudEvent<PubSubCloudEventData>) => {
  let notion: Client = null!; // Initialize with null assertion
  let notionQueue: any = null!; // Initialize with null assertion

  if (!cloudEvent.data || !cloudEvent.data.message || typeof cloudEvent.data.message.data !== 'string') {
    console.error('Invalid Pub/Sub message format: Missing or invalid data.message.data');
    return; // Acknowledge the message to prevent retries for fundamentally bad format
  }

  let job: RestoreJob;
  try {
    const messageData = Buffer.from(cloudEvent.data.message.data, 'base64').toString();
    job = JSON.parse(messageData) as RestoreJob;
    console.log(`Received restore job: ${job.restoreId} for user: ${job.userId}, snapshot: ${job.snapshotId}`);
  } catch (err) {
    console.error('Failed to parse Pub/Sub message data:', err);
    return; // Acknowledge - message is malformed
  }

  const { restoreId, userId, snapshotId, targets, targetParentPageId } = job;
  const progressRef = db.collection('restores').doc(userId).collection('items').doc(restoreId);

  // Helper to update progress in Firestore
  const updateProgress = async (status: RestoreProgress['status'], message: string, percentage: number) => {
    const progressData: RestoreProgress = {
      status,
      message,
      percentage,
      updatedAt: Date.now(),
    };
    try {
      await progressRef.set(progressData, { merge: true });
      console.log(`[${restoreId}] Progress updated: ${status} - ${percentage}% - ${message}`);
    } catch (dbError) {
      console.error(`[${restoreId}] Failed to update Firestore progress:`, dbError);
      // Continue processing, but log the failure
    }
  };

  let tempFilePath: string | null = null; // Define here for cleanup in finally block

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
    let snapshotJson: string;
    if (tempFilePath.endsWith('.gz')) {
        const fileContents = fs.readFileSync(tempFilePath);
        snapshotJson = zlib.gunzipSync(fileContents).toString('utf-8');
        console.log(`[${restoreId}] Decompressed gzipped file.`);
    } else {
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
        const itemsTyped = allSnapshotItems as SnapshotItem[]; // Assume items match updated SnapshotItem structure
        let itemsToProcess: SnapshotItem[];

        if (targets && targets.length > 0) {
            const targetSet = new Set(targets);
            itemsToProcess = itemsTyped.filter(item => item.id && targetSet.has(item.id));
            console.log(`[${restoreId}] Filtering by ${targets.length} target(s). Found ${itemsToProcess.length} item(s) to restore.`);
        } else {
            itemsToProcess = itemsTyped;
            console.log(`[${restoreId}] No targets specified. Attempting to restore all ${itemsToProcess.length} item(s) from snapshot.`);
        }
        
        totalItemsToRestore = itemsToProcess.length;

        if (totalItemsToRestore === 0) {
            console.log(`[${restoreId}] No items to restore after filtering (or snapshot items do not match targets).`);
            // Update progress to near completion as there's nothing to send to Notion.
            // Depending on desired behavior, this could also be 'completed'.
            await updateProgress('restoring', 'No matching items to restore.', 95);
        } else {
            // Determine the actual parent page ID to use
            const parentPageIdForRestore = targetParentPageId || DEFAULT_RESTORE_PARENT_PAGE_ID;
            if (!parentPageIdForRestore) {
                console.error(`[${restoreId}] No targetParentPageId provided in job and no DEFAULT_RESTORE_PARENT_PAGE_ID set. Cannot determine where to restore databases/top-level pages.`);
                // Update progress to reflect this configuration error
                await updateProgress('error', 'Configuration error: Cannot determine restore destination.', -1); 
                return; // Stop processing
            }
            console.log(`[${restoreId}] Determined target parent page ID for restore: ${parentPageIdForRestore}`);

            for (const item of itemsToProcess) {
                if (!item || typeof item.id !== 'string' || !item.object) {
                    console.warn(`[${restoreId}] Skipping invalid item structure (missing id or object type):`, item);
                    continue; 
                }

                notionQueue.add(async () => {
                    try {
                        console.log(`[${restoreId}] Attempting to restore item: ${item.id} (type: ${item.object})`);
                        
                        switch (item.object) {
                            case 'page':
                                // Check if this page was part of a database we are restoring
                                // If so, it should have been created by the database restore logic.
                                if (item.parent?.type === 'database_id') {
                                    console.log(`[${restoreId}] Skipping page ${item.id} as it belongs to a database (should be restored via DB).`);
                                    // To be more robust, we could track newly created DB IDs and map original parent DB ID.
                                    break; 
                                }

                                // --- Transform Page Properties (similar to database rows) ---
                                console.log(`[${restoreId}] Transforming properties for top-level page ${item.id}`);
                                const pageProperties = item.properties;
                                const transformedPageProperties: { [propertyName: string]: any } = {};
                                
                                if (pageProperties) { // Ensure properties exist
                                    for (const pagePropName in pageProperties) {
                                        const propData = pageProperties[pagePropName];
                                        const propType = propData.type;
                                        const skippableTypes = ['formula', 'rollup', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by', 'unique_id', 'relation', 'files', 'people', 'button'];
                                        if (skippableTypes.includes(propType)) {
                                            continue;
                                        }
                                        let createValue: any = null;
                                        switch (propType) {
                                            case 'title':
                                            case 'rich_text': createValue = propData[propType]; break;
                                            case 'number': createValue = propData.number; break;
                                            case 'select': createValue = propData.select ? { name: propData.select.name } : null; break;
                                            case 'multi_select': createValue = propData.multi_select?.map((opt: any) => ({ name: opt.name })) || []; break;
                                            case 'status': createValue = propData.status ? { name: propData.status.name } : null; break;
                                            case 'date': createValue = propData.date; break;
                                            case 'checkbox': createValue = propData.checkbox; break;
                                            case 'url': createValue = propData.url; break;
                                            case 'email': createValue = propData.email; break;
                                            case 'phone_number': createValue = propData.phone_number; break;
                                            default: console.warn(`[${restoreId}]   Unhandled property type for page creation: ${pagePropName} (type: ${propType})`); continue;
                                        }
                                        if (createValue !== null && createValue !== undefined) {
                                            if (propType === 'title') {
                                                transformedPageProperties[pagePropName] = { title: createValue };
                                            } else {
                                                transformedPageProperties[pagePropName] = { [propType]: createValue };
                                            }
                                        }
                                    }
                                }
                                console.log(`[${restoreId}] Property transformation complete for page ${item.id}`);
                                // --- End Transform Page Properties ---
                                
                                // --- Transform Block Children --- 
                                let transformedPageBlocks: any[] = [];
                                if (item.blocks && Array.isArray(item.blocks)) {
                                    try {
                                         console.log(`[${restoreId}] Transforming ${item.blocks.length} blocks for top-level page ${item.id}`);
                                         transformedPageBlocks = transformBlocksForCreate(item.blocks); 
                                    } catch (transformError) {
                                        console.error(`[${restoreId}] Failed to transform blocks for page ${item.id}:`, transformError);
                                    }
                                } else {
                                     console.log(`[${restoreId}] No blocks found in snapshot data for page ${item.id}.`);
                                }
                                // --- End Transform Block Children --- 

                                const pagePayload = {
                                    parent: { page_id: parentPageIdForRestore }, 
                                    properties: transformedPageProperties,
                                    children: transformedPageBlocks // Pass transformed blocks
                                };
                                if (item.icon) (pagePayload as any).icon = item.icon; 
                                if (item.cover) (pagePayload as any).cover = item.cover; 

                                // Queue the page creation
                                notionQueue.add(async () => {
                                    try {
                                        console.log(`[${restoreId}] Restoring top-level page ${item.id} under parent ${parentPageIdForRestore}`);
                                        await notion.pages.create(pagePayload as any);
                                        console.log(`[${restoreId}] Successfully restored top-level page ${item.id}`);
                                    } catch (pageCreateError: any) {
                                            console.error(`[${restoreId}] Failed to restore top-level page ${item.id}:`, pageCreateError.body || pageCreateError);
                                    }
                                });
                                break;
                            case 'database':
                                console.log(`[${restoreId}] Transforming database ${item.id}`);
                                // --- Transform Database Payload ---
                                const dbProperties = item.properties; // Raw properties from snapshot
                                
                                // Define type for the properties object in the create API call
                                type CreateDbProperties = { [propertyName: string]: any }; // Use 'any' for now, can be refined
                                const transformedDbProperties: CreateDbProperties = {}; 
                                
                                // --- Iterate and Transform Properties ---
                                console.log(`[${restoreId}] Transforming properties for database ${item.id}`);
                                for (const propName in dbProperties) {
                                    const propData = dbProperties[propName];
                                    // Skip read-only types and the main title property (handled separately)
                                    const readOnlyTypes = ['formula', 'rollup', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by'];
                                    if (propData.type === 'title' || readOnlyTypes.includes(propData.type)) {
                                        console.log(`[${restoreId}]   Skipping property: ${propName} (type: ${propData.type})`);
                                        continue;
                                    }

                                    // Construct the property definition for the create API
                                    const createPropData = {
                                        // type: propData.type, // Type is key, not value
                                        name: propData.name, // Name might be needed if differs from key, but usually key is fine
                                        [propData.type]: {} // Default empty config for most types
                                    };

                                    // Add specific configurations for types that require it (select, multi_select, status)
                                    if ((propData.type === 'select' || propData.type === 'multi_select' || propData.type === 'status') && propData[propData.type]?.options) {
                                         const propConfig = {
                                            options: propData[propData.type].options.map((opt: any) => ({ name: opt.name, color: opt.color }))
                                        };
                                        // Status also needs group information if present
                                        if (propData.type === 'status' && propData.status?.groups) {
                                             (propConfig as any).groups = propData.status.groups; // Add groups if they exist
                                        }
                                        createPropData[propData.type] = propConfig;
                                    } 
                                    
                                    // Assign the correctly typed property config
                                    transformedDbProperties[propName] = createPropData; 
                                    console.log(`[${restoreId}]   Transformed property: ${propName}`);
                                }
                                console.log(`[${restoreId}] Property transformation complete.`);
                                // --- End Property Transformation ---

                                const dbPayload: {
                                    parent: { type: "page_id"; page_id: string };
                                    title: any[]; 
                                    properties: Record<string, any>;
                                    is_inline: boolean;
                                    icon?: any; // Add optional icon
                                    cover?: any; // Add optional cover
                                } = {
                                    parent: { type: "page_id", page_id: parentPageIdForRestore! }, // Added non-null assertion for parentPageIdForRestore
                                    title: item.title as any[], 
                                    properties: transformedDbProperties,
                                    is_inline: item.is_inline ?? false,
                                };
                                
                                if (item.icon) {
                                    dbPayload.icon = item.icon;
                                }
                                if (item.cover) {
                                    dbPayload.cover = item.cover;
                                }
                                
                                console.log(`[${restoreId}] Creating database from snapshot ${item.id}`);
                                const newDb = await notion.databases.create(dbPayload as any); // Cast to any for create, Notion SDK types can be complex
                                console.log(`[${restoreId}] Successfully created database ${newDb.id} from original ${item.id} under parent ${parentPageIdForRestore}`);
                                
                                // --- Restore Rows (Pages) into the new Database ---
                                if (item.rows && Array.isArray(item.rows)) {
                                    console.log(`[${restoreId}] Attempting to restore ${item.rows.length} rows into new database ${newDb.id}`);
                                    for (const pageRow of item.rows) {
                                        // Ensure row is a page object with properties
                                        if (pageRow.object !== 'page' || !pageRow.properties) {
                                            console.warn(`[${restoreId}] Skipping invalid row object within database ${item.id}:`, pageRow);
                                            continue;
                                        }

                                        const pageProperties = pageRow.properties;
                                        // Use a specific type for create payload properties
                                        const transformedPageProperties: { [propertyName: string]: any } = {}; 
                                        
                                        console.log(`[${restoreId}] Transforming properties for page ${pageRow.id}`);
                                        for (const pagePropName in pageProperties) {
                                            const propData = pageProperties[pagePropName];
                                            const propType = propData.type;

                                            // Skip read-only types, buttons, relations for now
                                            const skippableTypes = [
                                                'formula', 'rollup', 'created_time', 'created_by', 
                                                'last_edited_time', 'last_edited_by', 'unique_id', 
                                                'relation', 'files', 'people', 'button' 
                                            ];

                                            if (skippableTypes.includes(propType)) {
                                                console.log(`[${restoreId}]   Skipping property: ${pagePropName} (type: ${propType})`);
                                                continue;
                                            }

                                            // --- Handle specific types for the create API ---
                                            let createValue: any = null; // Value to use for the API call

                                            switch (propType) {
                                                case 'title':
                                                case 'rich_text':
                                                    createValue = propData[propType]; 
                                                    break;
                                                case 'number':
                                                    createValue = propData.number;
                                                    break;
                                                case 'select':
                                                    createValue = propData.select ? { name: propData.select.name } : null;
                                                    break;
                                                case 'multi_select':
                                                    createValue = propData.multi_select?.map((opt: any) => ({ name: opt.name })) || [];
                                                    break;
                                                case 'status':
                                                    createValue = propData.status ? { name: propData.status.name } : null;
                                                    break;
                                                case 'date':
                                                    createValue = propData.date; 
                                                    break;
                                                case 'checkbox':
                                                    createValue = propData.checkbox;
                                                    break;
                                                case 'url':
                                                    createValue = propData.url;
                                                    break;
                                                case 'email':
                                                    createValue = propData.email;
                                                    break;
                                                case 'phone_number':
                                                    createValue = propData.phone_number;
                                                    break;
                                                default:
                                                    console.warn(`[${restoreId}]   Unhandled property type for creation: ${pagePropName} (type: ${propType})`);
                                                    continue; // Skip unhandled types
                                            }
                                            
                                            if (createValue !== null && createValue !== undefined) {
                                                 if (propType === 'title') {
                                                     transformedPageProperties[pagePropName] = { title: createValue };
                                                 } else {
                                                     transformedPageProperties[pagePropName] = { [propType]: createValue };
                                                 }
                                                 console.log(`[${restoreId}]   Transformed property: ${pagePropName}`);
                                            } else {
                                                 console.log(`[${restoreId}]   Skipping property with null/undefined value: ${pagePropName}`);
                                            }
                                        }
                                        
                                        // --- Fetch and transform block children for this page ---
                                        let transformedDbPageBlocks: any[] = [];
                                        if (pageRow.blocks && Array.isArray(pageRow.blocks)) { // Check if blocks exist on the pageRow
                                            try {
                                                console.log(`[${restoreId}] Transforming ${pageRow.blocks.length} blocks for database page ${pageRow.id}`);
                                                transformedDbPageBlocks = transformBlocksForCreate(pageRow.blocks); // Use pageRow.blocks
                                                console.log(`[${restoreId}] Transformed ${transformedDbPageBlocks.length} blocks for database page ${pageRow.id}`);
                                            } catch (blockError) {
                                                console.error(`[${restoreId}] Failed to transform blocks for database page ${pageRow.id}:`, blockError);
                                                // Continue trying to create the page, but without blocks
                                            }
                                        } else {
                                            console.log(`[${restoreId}] No blocks found in snapshot data for database page ${pageRow.id}.`);
                                        }
                                        // --- End block fetching/transformation ---

                                        const pagePayload: {
                                            parent: { database_id: string };
                                            properties: Record<string, any>;
                                            children: any[];
                                            icon?: any;
                                            cover?: any;
                                        } = {
                                            parent: { database_id: newDb.id },
                                            properties: transformedPageProperties,
                                            children: transformedDbPageBlocks
                                        };
                                        
                                        if ('icon' in pageRow && pageRow.icon) {
                                            pagePayload.icon = pageRow.icon;
                                        }
                                        if ('cover' in pageRow && pageRow.cover) {
                                            pagePayload.cover = pageRow.cover;
                                        }

                                        // Queue the page creation
                                        notionQueue.add(async () => {
                                            try {
                                                console.log(`[${restoreId}] Restoring page (row) ${pageRow.id} into database ${newDb.id}`);
                                                await notion.pages.create(pagePayload as any); // Cast to any for create
                                                console.log(`[${restoreId}] Successfully restored page ${pageRow.id}`);
                                            } catch (pageCreateError: any) {
                                                 console.error(`[${restoreId}] Failed to restore page ${pageRow.id} into database ${newDb.id}:`, pageCreateError.body || pageCreateError);
                                            }
                                        });
                                    }
                                } else {
                                     console.log(`[${restoreId}] No rows found or 'rows' field missing for database ${item.id}`);
                                }
                                // --- End Restore Rows ---
                                break;
                            default:
                                console.warn(`[${restoreId}] Unknown item type '${item.object}' for item ID ${item.id}. Skipping.`);
                                // This item will not be counted towards restoredItemCount or affect percentage completion directly.
                                return; // Exit this specific task, do not increment restoredItemCount
                        }
                        
                        restoredItemCount++;
                        // Ensure totalItemsToRestore is not zero to prevent NaN/Infinity
                        const percentageOfRestorePhase = totalItemsToRestore > 0 ? Math.round((restoredItemCount / totalItemsToRestore) * 65) : 65;
                        const currentPercentage = 30 + percentageOfRestorePhase; // 30% base + up to 65% for this phase
                        await updateProgress('restoring', `Restored item ${restoredItemCount}/${totalItemsToRestore}...`, Math.min(currentPercentage, 95));

                    } catch (notionError: any) {
                        console.error(`[${restoreId}] Failed to restore item (original ID ${item.id}, type ${item.object}):`, notionError.body || notionError.message || notionError);
                        // Optional: Decide if one item failure should stop the whole restore or just log/skip
                        // To mark the entire job as errored, you might throw here or manage a global error flag.
                        // For now, we log and the queue continues with other items.
                        // Consider updating progress with specific item error.
                        // await updateProgress('error', `Failed on item ${item.id}: ${notionError.message}`, -1); // This would mark the whole job.
                    }
                });
            }
        }
    } else {
        console.warn(`[${restoreId}] Snapshot data does not contain an array of items or is empty. Path 'snapshotData.items' was evaluated. Snapshot data:`, snapshotData);
        // Update progress accordingly if no items are found.
        await updateProgress('restoring', 'No items found in snapshot or snapshot format unexpected.', 30); // Or a different percentage/status
    }

    // Wait for all queued Notion API calls to complete
    await notionQueue.onIdle();
    console.log(`[${restoreId}] Notion API queue idle.`);

    // --- 4. Finalize --- 
    console.log(`[${restoreId}] Restore process completed successfully.`);
    await updateProgress('completed', 'Restore completed successfully!', 100);

    // A.2.2: Add audit log for restore_completed
    try {
      const auditLogCompleted = {
        timestamp: FieldValue.serverTimestamp(),
        type: 'restore_completed',
        details: {
          restoreId: restoreId,
          snapshotId: snapshotId,
          targetParentPageId: targetParentPageId || null,
          // TODO: Ideally, capture the actual new root page ID/URL created by the restore
          // This would require the restore logic to return/store this information.
          // For now, we just log that it completed.
          restoredItemCount: restoredItemCount, // Assuming restoredItemCount is in scope
          status: 'success'
        },
      };
      await db.collection('users').doc(userId).collection('audit').add(auditLogCompleted);
      console.log(`[${restoreId}] Audit log created for completed restore.`);
    } catch (auditError) {
      console.error(`[${restoreId}] Failed to write audit log for completed restore:`, auditError);
    }

  } catch (err: any) {
    console.error(`[${restoreId}] Restore failed:`, err);
    await updateProgress('error', `Restore failed: ${err.message || 'Unknown error'}`, -1);

    // A.2.2: Add audit log for restore_failed
    try {
      const auditLogFailed = {
        timestamp: FieldValue.serverTimestamp(),
        type: 'restore_failed',
        details: {
          restoreId: restoreId,
          snapshotId: snapshotId,
          targetParentPageId: targetParentPageId || null,
          error: err.message || 'Unknown error',
          status: 'failed'
        },
      };
      await db.collection('users').doc(userId).collection('audit').add(auditLogFailed);
      console.log(`[${restoreId}] Audit log created for failed restore.`);
    } catch (auditError) {
      console.error(`[${restoreId}] Failed to write audit log for failed restore:`, auditError);
    }
    // Optional: Re-throw the error if needed for function retry policies
    // throw err;
  } finally {
      // Ensure temp file is deleted even if errors occurred
      if (tempFilePath) {
        try {
            fs.unlinkSync(tempFilePath);
            console.log(`[${restoreId}] Cleaned up temp file: ${tempFilePath}`);
        } catch (cleanupError) {
             console.error(`[${restoreId}] Error cleaning up temp file ${tempFilePath}:`, cleanupError);
        }
      }
  }
}); 