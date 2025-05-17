import * as functions from '@google-cloud/functions-framework';
import * as GCloudFirestore from '@google-cloud/firestore';
import { Client as NotionClient } from '@notionhq/client';
import JSZip from 'jszip';
import { gzip } from 'zlib';
import { promisify } from 'util';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import { createHash } from 'crypto';
import PQueue from 'p-queue';

// Localized shared code
import { decryptString } from './kms'; // Assuming kms.ts is in ./lib/
import { StorageAdapter } from '../storage/StorageAdapter';
import { GCSStorageAdapter } from '../storage/GCSStorageAdapter';
import { S3StorageAdapter } from '../storage/S3StorageAdapter';
import { R2StorageAdapter } from '../storage/R2StorageAdapter';
import { RedundantStorageAdapter } from '../storage/RedundantStorageAdapter';
import type { UserStorageProvider } from './types/storageProvider'; // Assuming storageProvider.ts is in ./types/

const gzipAsync = promisify(gzip);
const db = new GCloudFirestore.Firestore();
const kmsClient = new KeyManagementServiceClient(); // kmsClient is used by decryptString

// Environment Variables
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT; // Used by decryptString
const KMS_LOCATION_ID = process.env.KMS_LOCATION_ID; // Used by decryptString
const KMS_KEY_RING_ID = process.env.KMS_KEY_RING_ID; // Used by decryptString
const KMS_KEY_ID = process.env.KMS_KEY_ID;       // Used by decryptString

let notionQueue: PQueue; // Typed PQueue

interface SnapshotJob {
  userId: string;
  requestedAt: number;
  snapshotIdActual?: string;
}
interface PubSubMessage { data: string; }
interface PubSubCloudEventData { message: PubSubMessage; }

// UserNotionAccessToken, fetchAllBlocks, fetchAllDatabaseRows should be here (assuming they are correct and use GCloudFirestore.FieldValue if needed)
// For brevity, I will omit them here but assume they are present and correct from previous state.
async function getUserNotionAccessToken(userId: string): Promise<string | null> {
  const integrationRef = db.collection('users').doc(userId).collection('integrations').doc('notion');
  const doc = await integrationRef.get();
  if (!doc.exists) { console.warn(`[${userId}] Notion integration document not found.`); return null; }
  const accessToken = doc.data()?.accessToken;
  if (!accessToken) { console.warn(`[${userId}] Notion access token not found in integration document.`); return null; }
  return accessToken;
}
async function fetchAllBlocks(notionClient: NotionClient, queue: PQueue, blockId: string): Promise<any[]> { /* ... full implementation ... */ return []; }
async function fetchAllDatabaseRows(notionClient: NotionClient, queue: PQueue, databaseId: string): Promise<any[]> { /* ... full implementation ... */ return []; }


functions.cloudEvent('snapshotWorker', async (cloudEvent: functions.CloudEvent<PubSubCloudEventData>) => {
  if (!BUCKET_NAME) { 
    console.error("FATAL: GCS_BUCKET_NAME (Primary Bucket) env var not set."); 
    throw new Error("GCS_BUCKET_NAME env var not set."); 
  }
  // GCP_PROJECT_ID is used by KMS and Firestore client implicitly or via env var

  let job: SnapshotJob;
  try {
    const messageData = Buffer.from(cloudEvent.data.message.data, 'base64').toString();
    job = JSON.parse(messageData) as SnapshotJob;
  } catch (err) { console.error('Failed to parse Pub/Sub message data:', err); return; }

  const { userId } = job;
  const userDocRef = db.collection('users').doc(userId);
  const auditLogCol = userDocRef.collection('audit');
  const requestedAtOriginal = new Date(job.requestedAt);

  console.log(`[${userId}] Snapshot job started. Requested at: ${requestedAtOriginal.toISOString()}`);

  try {
    if (!notionQueue) {
        notionQueue = new PQueue({ intervalCap: 3, interval: 1000 });
        console.log('P-Queue initialized for Notion API rate limiting.');
    }
    
    const notionToken = await getUserNotionAccessToken(userId);
    if (!notionToken) { throw new Error(`Could not retrieve Notion token for user ${userId}.`); }
    const notion = new NotionClient({ auth: notionToken });

    console.log(`[${userId}] Configuring storage adapters...`);
    const gcsAdapter = new GCSStorageAdapter({ bucket: BUCKET_NAME });
    const mirrorAdapters: StorageAdapter[] = [];
    const providersSnap = await db.collection('userStorageConfigs').doc(userId).collection('providers').where('isEnabled', '==', true).get();
    
    if (!providersSnap.empty) {
      for (const providerDoc of providersSnap.docs) {
        const config = providerDoc.data() as UserStorageProvider;
        try {
            if (!config.encryptedAccessKeyId || !config.encryptedSecretAccessKey) throw new Error('Missing encrypted credentials for mirror');
            const accessKeyId = await decryptString(config.encryptedAccessKeyId);
            const secretAccessKey = await decryptString(config.encryptedSecretAccessKey);
            if (!accessKeyId || !secretAccessKey) throw new Error('Decrypted keys are empty for mirror');

            if (config.type === 's3' && config.bucket && config.region) {
                mirrorAdapters.push(new S3StorageAdapter({ bucket: config.bucket, region: config.region, accessKeyId, secretAccessKey, forcePathStyle: config.forcePathStyle }));
            } else if (config.type === 'r2' && config.bucket && config.endpoint) {
                mirrorAdapters.push(new R2StorageAdapter({ bucket: config.bucket, endpoint: config.endpoint, accessKeyId, secretAccessKey, forcePathStyle: config.forcePathStyle, region: config.region || 'auto' }));
            }
        } catch (e: any) {
            console.error(`[${userId}] Failed to init mirror adapter for ${config.type} ${config.bucket}: ${e.message}`);
            await auditLogCol.add({ type: 'snapshot_mirror_config_error', message: `Failed to use mirror ${config.type} ${config.bucket|| 'unknown'}: ${e.message}`, providerId: providerDoc.id, timestamp: GCloudFirestore.FieldValue.serverTimestamp()});
        }
      }
    }
    const redundantAdapter = new RedundantStorageAdapter(gcsAdapter, mirrorAdapters);
    console.log(`[${userId}] Storage configured. Primary: GCS. Mirrors active: ${mirrorAdapters.length}`);
    
    console.log(`[${userId}] Starting Notion data fetch...`);
    let allFetchedItems: any[] = [];
    const searchResponse = await notionQueue.add(() => notion.search({ page_size: 100 }));
    allFetchedItems.push(...searchResponse.results);
    let nextCursor = searchResponse.next_cursor;
    while (nextCursor) {
        const nextPageResponse = await notionQueue.add(() => notion.search({ start_cursor: nextCursor, page_size: 100 }));
        allFetchedItems.push(...nextPageResponse.results);
        nextCursor = nextPageResponse.next_cursor;
    }
    const detailedItems: any[] = [];
    for (const item of allFetchedItems) {
        if (item.object === 'page') {
            const blocks = await fetchAllBlocks(notion, notionQueue, item.id);
            detailedItems.push({ ...item, blocks: blocks });
        } else if (item.object === 'database') {
            const rows = await fetchAllDatabaseRows(notion, notionQueue, item.id);
            detailedItems.push({ ...item, rows: rows }); 
        } else { detailedItems.push(item); }
    }

    const snapshotTimestampISO = new Date().toISOString();
    const finalSnapshotData = { metadata: { userId, snapshotTimestamp: snapshotTimestampISO, source: "snapshotWorker", itemCount: detailedItems.length }, items: detailedItems };
    const jsonData = JSON.stringify(finalSnapshotData, null, 2); 
    const compressedData = await gzipAsync(Buffer.from(jsonData, 'utf-8'));
    const sha256Hash = createHash('sha256').update(compressedData).digest('hex');
    const actualSnapshotId = job.snapshotIdActual || `snap_${snapshotTimestampISO.replace(/[:.]/g, '-')}`;
    const fileName = `${userId}/${actualSnapshotId}.json.gz`;
    
    const objectMetadata = {
        contentType: 'application/gzip',
        userId: userId,
        snapshotTimestamp: snapshotTimestampISO,
        requestedAt: requestedAtOriginal.toISOString(), 
        snapshotId: actualSnapshotId,
        contentSha256: sha256Hash 
    };

    console.log(`[${userId}] Writing snapshot file: ${fileName}`);
    await redundantAdapter.write(fileName, compressedData, objectMetadata);
    console.log(`[${userId}] Snapshot file written via RedundantStorageAdapter.`);

    // Write manifest file (GCS only for now, or use redundantAdapter if it should also be mirrored)
    const hashManifest = {}; // Placeholder: In a real scenario, fetchAllBlocks/Rows would populate this.
    const manifestJsonData = JSON.stringify(hashManifest, null, 2);
    const compressedManifestData = await gzipAsync(Buffer.from(manifestJsonData, 'utf-8'));
    const manifestFileName = `${userId}/${actualSnapshotId}.manifest.json.gz`;
    console.log(`[${userId}] Writing manifest file: ${manifestFileName} to GCS.`);
    await gcsAdapter.write(manifestFileName, compressedManifestData, { contentType: 'application/gzip', userId });
    console.log(`[${userId}] Manifest file written to GCS.`);

    await auditLogCol.add({
        type: 'snapshot_created',
        message: `Snapshot ${actualSnapshotId} created. Hash: ${sha256Hash}. Mirrors: ${mirrorAdapters.length}`,
        snapshotId: actualSnapshotId, gcsPath: fileName, contentSha256: sha256Hash,
        sizeBytes: compressedData.length, itemCount: detailedItems.length,
        primaryStorage: `GCS (${BUCKET_NAME})`,
        mirrorTargets: mirrorAdapters.map(m => `${(m as any).constructor.name.replace('StorageAdapter','')}-${(m as any).bucketName || 'unknown'}`),
        timestamp: GCloudFirestore.FieldValue.serverTimestamp()
    });
    
    const userSnapshotDocRef = userDocRef.collection('snapshots').doc(actualSnapshotId);
    await userSnapshotDocRef.set({
        id: fileName, snapshotIdActual: actualSnapshotId, userId: userId,
        timestamp: snapshotTimestampISO, status: 'Completed',
        sizeKB: Math.round(compressedData.length / 1024),
        contentSha256: sha256Hash, itemCount: detailedItems.length,
        manifestPath: manifestFileName, // Store path to manifest
        storageProviders: {
            primary: { type: 'gcs', bucket: BUCKET_NAME!, path: fileName, status: 'success' },
            mirrors: mirrorAdapters.map(m => ({ 
                type: (m as any).constructor.name === 'S3StorageAdapter' ? 's3' : ((m as any).constructor.name === 'R2StorageAdapter' ? 'r2' : 'unknown'), 
                bucket: (m as any).bucketName || 'unknown', path: fileName, status: 'pending_verification' 
            })) 
        },
        createdAt: GCloudFirestore.FieldValue.serverTimestamp(),
        updatedAt: GCloudFirestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`[${userId}] Firestore snapshot doc created: users/${userId}/snapshots/${actualSnapshotId}`);

  } catch (error: any) {
    console.error(`[${userId}] Snapshot worker failed for job from ${requestedAtOriginal.toISOString()}:`, error);
    await auditLogCol.add({
        type: 'snapshot_failed', message: `Worker failed: ${error.message}`,
        errorName: error.name, errorStack: error.stack, jobDetails: job,
        timestamp: GCloudFirestore.FieldValue.serverTimestamp()
    });
    throw error; 
  }
}); 