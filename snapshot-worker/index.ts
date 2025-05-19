import * as functions from '@google-cloud/functions-framework';
import * as GCloudFirestore from '@google-cloud/firestore';
import { Client as NotionClient } from '@notionhq/client';
// SecretManagerServiceClient not directly used in this version of the logic
import { gzip } from 'zlib';
import { promisify } from 'util';
import { KeyManagementServiceClient } from '@google-cloud/kms'; // For decryptString
import { createHash } from 'crypto';
import PQueue from 'p-queue';

// Monorepo Package Imports
import type { UserStorageProvider } from '@notion-lifeline/common-types';
import { 
  StorageAdapter, 
  GCSStorageAdapter, 
  S3StorageAdapter, 
  R2StorageAdapter, 
  RedundantStorageAdapter 
} from '@notion-lifeline/storage-adapters';

const gzipAsync = promisify(gzip);
const db = new GCloudFirestore.Firestore();
const kmsClient = new KeyManagementServiceClient(); // For decryptString

// Environment Variables
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const KMS_LOCATION_ID = process.env.KMS_LOCATION_ID;
const KMS_KEY_RING_ID = process.env.KMS_KEY_RING_ID;
const KMS_KEY_ID = process.env.KMS_KEY_ID;

let notionQueue: PQueue;

// decryptString function (kept local to worker for now)
async function decryptString(ciphertextBase64: string): Promise<string> {
  if (!GCP_PROJECT_ID || !KMS_LOCATION_ID || !KMS_KEY_RING_ID || !KMS_KEY_ID) {
    console.error("KMS environment variables for decryption not fully set in worker.");
    throw new Error("KMS configuration incomplete.");
  }
  if (!ciphertextBase64) return '';
  const keyName = kmsClient.cryptoKeyPath(GCP_PROJECT_ID, KMS_LOCATION_ID, KMS_KEY_RING_ID, KMS_KEY_ID);
  try {
    const [result] = await kmsClient.decrypt({ name: keyName, ciphertext: Buffer.from(ciphertextBase64, 'base64') });
    if (!result.plaintext) throw new Error('KMS decryption result is null.');
    return result.plaintext.toString();
  } catch (error) {
    console.error(`KMS Decryption failed in worker for key ${keyName}:`, error);
    throw new Error(`Failed to decrypt string: ${(error as Error).message}`);
  }
}

interface SnapshotJob { userId: string; requestedAt: number; snapshotIdActual?: string; }
interface PubSubMessage { data: string; }
interface PubSubCloudEventData { message: PubSubMessage; }

async function getUserNotionAccessToken(userId: string): Promise<string | null> {
  const integrationRef = db.collection('users').doc(userId).collection('integrations').doc('notion');
  const doc = await integrationRef.get();
  if (!doc.exists) { console.warn(`[${userId}] Notion integration document not found.`); return null; }
  const accessToken = doc.data()?.accessToken;
  if (!accessToken) { console.warn(`[${userId}] Notion access token not found in integration document.`); return null; }
  return accessToken;
}

// Simplified stubs for brevity, assume full implementation exists
async function fetchAllBlocks(notionClient: NotionClient, queue: PQueue, blockId: string): Promise<any[]> { 
  console.log(`[${userIdForHelpers}] Stub: Would fetch blocks for ${blockId}`);
  return []; 
}
async function fetchAllDatabaseRows(notionClient: NotionClient, queue: PQueue, databaseId: string): Promise<any[]> { 
  console.log(`[${userIdForHelpers}] Stub: Would fetch rows for DB ${databaseId}`);
  return []; 
}
let userIdForHelpers = 'temp-worker-userid'; // Temporary placeholder for logging in helper stubs


functions.cloudEvent('snapshotWorker', async (cloudEvent: functions.CloudEvent<PubSubCloudEventData>) => {
  if (!BUCKET_NAME) { 
    console.error("FATAL: GCS_BUCKET_NAME (Primary Bucket) env var not set."); 
    throw new Error("GCS_BUCKET_NAME env var not set."); 
  }
  
  if (!cloudEvent.data?.message?.data) {
    console.error('Invalid Pub/Sub message format: Missing or invalid data structure.');
    return; 
  }

  let job: SnapshotJob;
  try {
    const messageData = Buffer.from(cloudEvent.data.message.data, 'base64').toString();
    job = JSON.parse(messageData) as SnapshotJob;
  } catch (err) { console.error('Failed to parse Pub/Sub message data:', err); return; }

  userIdForHelpers = job.userId; // Set actual userId for logging context
  const userDocRef = db.collection('users').doc(job.userId);
  const auditLogCol = userDocRef.collection('audit');
  const requestedAtOriginal = new Date(job.requestedAt);

  console.log(`[${job.userId}] Snapshot job started. Requested at: ${requestedAtOriginal.toISOString()}`);

  try {
    if (!notionQueue) {
        notionQueue = new PQueue({ intervalCap: 3, interval: 1000 });
        console.log('P-Queue initialized for Notion API rate limiting.');
    }
    
    const notionToken = await getUserNotionAccessToken(job.userId);
    if (!notionToken) { throw new Error(`Could not retrieve Notion token for user ${job.userId}.`); }
    const notion = new NotionClient({ auth: notionToken });

    console.log(`[${job.userId}] Configuring storage adapters...`);
    const gcsAdapter = new GCSStorageAdapter({ bucket: BUCKET_NAME });
    const mirrorAdapters: StorageAdapter[] = [];
    const providersSnap = await db.collection('userStorageConfigs').doc(job.userId).collection('providers').where('isEnabled', '==', true).get();
    
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
            console.error(`[${job.userId}] Failed to init mirror adapter for ${config.type} ${config.bucket}: ${e.message}`);
            await auditLogCol.add({ type: 'snapshot_mirror_config_error', message: `Failed to use mirror ${config.type} ${config.bucket|| 'unknown'}: ${e.message}`, providerId: providerDoc.id, timestamp: GCloudFirestore.FieldValue.serverTimestamp()});
        }
      }
    }
    const redundantAdapter = new RedundantStorageAdapter(gcsAdapter, mirrorAdapters); // Correct instantiation
    console.log(`[${job.userId}] Storage configured. Primary: GCS. Mirrors active: ${mirrorAdapters.length}`);
    
    console.log(`[${job.userId}] Starting Notion data fetch...`);
    let allFetchedItems: any[] = [];
    // Simplified Notion fetch for baseline - replace with your full recursive fetch logic
    const searchResponse = await notionQueue.add(() => notion.search({ page_size: 10 })); 
    allFetchedItems.push(...searchResponse.results);
    console.log(`[${job.userId}] Fetched ${allFetchedItems.length} top-level items (simplified fetch).`);
    const detailedItems = allFetchedItems; // Using top-level items directly for simplified baseline

    const snapshotTimestampISO = new Date().toISOString();
    const finalSnapshotData = { metadata: { userId: job.userId, snapshotTimestamp: snapshotTimestampISO, source: "snapshotWorker", itemCount: detailedItems.length }, items: detailedItems };
    const jsonData = JSON.stringify(finalSnapshotData, null, 2); 
    const compressedData = await gzipAsync(Buffer.from(jsonData, 'utf-8'));
    const sha256Hash = createHash('sha256').update(compressedData).digest('hex');
    const actualSnapshotId = job.snapshotIdActual || `snap_${snapshotTimestampISO.replace(/[:.]/g, '-')}`;
    const fileName = `${job.userId}/${actualSnapshotId}.json.gz`;
    
    const objectMetadata = {
        contentType: 'application/gzip',
        userId: job.userId,
        snapshotTimestamp: snapshotTimestampISO,
        requestedAt: requestedAtOriginal.toISOString(), 
        snapshotId: actualSnapshotId,
        contentSha256: sha256Hash 
    };

    console.log(`[${job.userId}] Writing snapshot file: ${fileName}`);
    await redundantAdapter.write(fileName, compressedData, objectMetadata);
    console.log(`[${job.userId}] Snapshot file written via RedundantStorageAdapter.`);

    // Write manifest file (GCS only for now)
    const hashManifest = {}; // Placeholder: Populate this if your full fetch logic creates it
    const manifestJsonData = JSON.stringify(hashManifest, null, 2);
    const compressedManifestData = await gzipAsync(Buffer.from(manifestJsonData, 'utf-8'));
    const manifestFileName = `${job.userId}/${actualSnapshotId}.manifest.json.gz`;
    console.log(`[${job.userId}] Writing manifest file: ${manifestFileName} to GCS (using gcsAdapter).`);
    await gcsAdapter.write(manifestFileName, compressedManifestData, { contentType: 'application/gzip', userId: job.userId });
    console.log(`[${job.userId}] Manifest file written to GCS.`);

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
        id: fileName, snapshotIdActual: actualSnapshotId, userId: job.userId,
        timestamp: snapshotTimestampISO, status: 'Completed',
        sizeKB: Math.round(compressedData.length / 1024),
        contentSha256: sha256Hash, itemCount: detailedItems.length,
        manifestPath: manifestFileName, 
        storageProviders: {
            primary: { type: 'gcs', bucket: BUCKET_NAME!, path: fileName, status: 'success' },
            mirrors: mirrorAdapters.map(m => ({ 
                type: (m as any).constructor.name === 'S3StorageAdapter' ? 's3' : ((m as any).constructor.name === 'R2StorageAdapter' ? 'r2' : 'unknown'), 
                bucket: (m as any).bucketName || 'unknown', // bucketName is specific to S3/R2 adapter implementations
                path: fileName, status: 'pending_verification' 
            })) 
        },
        createdAt: GCloudFirestore.FieldValue.serverTimestamp(),
        updatedAt: GCloudFirestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`[${job.userId}] Firestore snapshot doc created: users/${job.userId}/snapshots/${actualSnapshotId}`);

  } catch (error: any) {
    console.error(`[${job.userId}] Snapshot worker failed for job from ${requestedAtOriginal.toISOString()}:`, error);
    await auditLogCol.add({
        type: 'snapshot_failed', message: `Worker failed: ${error.message}`,
        errorName: error.name, errorStack: error.stack, jobDetails: job,
        timestamp: GCloudFirestore.FieldValue.serverTimestamp()
    });
    throw error; 
  }
}); 