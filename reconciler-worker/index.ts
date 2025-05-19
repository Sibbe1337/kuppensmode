import * as functions from '@google-cloud/functions-framework';
import * as GCloudFirestore from '@google-cloud/firestore';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import type { UserStorageProvider } from './types/storageProvider';

// Adapters are in the same directory as index.ts
import { StorageAdapter } from './StorageAdapter.js';
import { GCSStorageAdapter } from './GCSStorageAdapter.js';
import { S3StorageAdapter } from './S3StorageAdapter.js';
import { R2StorageAdapter } from './R2StorageAdapter.js';
// RedundantStorageAdapter might not be directly used here, but individual adapters will be.

const db = new GCloudFirestore.Firestore();
const kmsClient = new KeyManagementServiceClient();

const PRIMARY_GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME; // Primary GCS bucket from env
const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const KMS_LOCATION_ID = process.env.KMS_LOCATION_ID;
const KMS_KEY_RING_ID = process.env.KMS_KEY_RING_ID;
const KMS_KEY_ID = process.env.KMS_KEY_ID;

async function decryptString(ciphertextBase64: string): Promise<string> {
  if (!GCP_PROJECT_ID || !KMS_LOCATION_ID || !KMS_KEY_RING_ID || !KMS_KEY_ID) {
    console.error("KMS environment variables for decryption are not fully set.");
    throw new Error("KMS configuration incomplete for decryption.");
  }
  if (!ciphertextBase64) return '';
  const keyName = kmsClient.cryptoKeyPath(GCP_PROJECT_ID, KMS_LOCATION_ID, KMS_KEY_RING_ID, KMS_KEY_ID);
  try {
    const [result] = await kmsClient.decrypt({ name: keyName, ciphertext: Buffer.from(ciphertextBase64, 'base64') });
    if (!result.plaintext) throw new Error('KMS decryption result is null.');
    return result.plaintext.toString();
  } catch (error) {
    console.error(`KMS Decryption failed for key ${keyName}:`, error);
    throw new Error(`Failed to decrypt string: ${(error as Error).message}`);
  }
}

interface UserStorageConfig {
    id: string;
    type: 's3' | 'r2';
    bucket: string;
    region?: string;
    endpoint?: string;
    encryptedAccessKeyId: string;
    encryptedSecretAccessKey: string;
    forcePathStyle?: boolean;
    // ... other fields from UserStorageProvider type
}

interface ReconciliationEventData { 
    // Could be triggered with specific userId or run for all
    userId?: string; 
}

functions.cloudEvent('reconcilerWorker', async (cloudEvent: functions.CloudEvent<any>) => {
    console.log('Reconciler worker triggered.', cloudEvent.data);
    if (!PRIMARY_GCS_BUCKET_NAME) {
        console.error("FATAL: GCS_BUCKET_NAME (Primary GCS Bucket) for reconciler not set.");
        return;
    }

    const data = cloudEvent.data?.message?.data ? 
                 JSON.parse(Buffer.from(cloudEvent.data.message.data, 'base64').toString()) as ReconciliationEventData :
                 {};

    const usersToProcessQuery = data.userId ?
        db.collection('users').where((GCloudFirestore.FieldValue as any).documentId(), '==', data.userId) :
        db.collection('users'); // Consider adding a flag like `hasActiveReplication: true` to query only relevant users

    try {
        const usersSnapshot = await usersToProcessQuery.get();
        if (usersSnapshot.empty) {
            console.log('No users found for reconciliation.');
            return;
        }

        console.log(`Starting reconciliation for ${usersSnapshot.size} user(s).`);

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            console.log(`Reconciling for user: ${userId}`);
            const auditLogCol = db.collection('users').doc(userId).collection('audit');

            const primaryAdapter = new GCSStorageAdapter({ bucket: PRIMARY_GCS_BUCKET_NAME });
            const mirrorProviderConfigsSnap = await db.collection('userStorageConfigs').doc(userId).collection('providers').where('isEnabled', '==', true).get();
            
            const activeMirrors: { name: string, adapter: StorageAdapter, config: UserStorageConfig }[] = [];

            if (!mirrorProviderConfigsSnap.empty) {
                for (const providerDoc of mirrorProviderConfigsSnap.docs) {
                    const config = providerDoc.data() as UserStorageProvider; // Assuming UserStorageProvider type from main app
                    try {
                        if (!config.encryptedAccessKeyId || !config.encryptedSecretAccessKey) throw new Error('Missing encrypted credentials in config');
                        const accessKeyId = await decryptString(config.encryptedAccessKeyId);
                        const secretAccessKey = await decryptString(config.encryptedSecretAccessKey);
                        if (!accessKeyId || !secretAccessKey) throw new Error('Decrypted keys are empty for mirror config.');

                        if (config.type === 's3' && config.bucket && config.region) {
                            activeMirrors.push({
                                name: `S3-${config.bucket}`,
                                adapter: new S3StorageAdapter({ bucket: config.bucket, region: config.region, accessKeyId, secretAccessKey, forcePathStyle: config.forcePathStyle }),
                                config: config as UserStorageConfig
                            });
                        } else if (config.type === 'r2' && config.bucket && config.endpoint) {
                             activeMirrors.push({
                                name: `R2-${config.bucket}`,
                                adapter: new R2StorageAdapter({ bucket: config.bucket, endpoint: config.endpoint, accessKeyId, secretAccessKey, forcePathStyle: config.forcePathStyle, region: config.region || 'auto' }),
                                config: config as UserStorageConfig
                            });
                        } else {
                            console.warn(`[${userId}] Skipping mirror config ${providerDoc.id} due to incomplete S3/R2 fields.`);
                        }
                    } catch (e: any) {
                        console.error(`[${userId}] Failed to init mirror adapter for ${config.type} ${config.bucket}: ${e.message}`);
                        await auditLogCol.add({ type: 'reconcile_mirror_config_error', message: `Failed to init mirror ${config.type} ${config.bucket}: ${e.message}`, providerId: providerDoc.id, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                    }
                }
            }
            console.log(`[${userId}] Primary GCS adapter configured. Found ${activeMirrors.length} active mirror configurations.`);

            // 1. List all snapshots from primary GCS for the user
            const userSnapshotPrefix = `${userId}/`;
            const primarySnapshots = await primaryAdapter.list(userSnapshotPrefix);
            console.log(`[${userId}] Found ${primarySnapshots.length} snapshots in primary GCS.`);

            if (primarySnapshots.length === 0) {
                console.log(`[${userId}] No snapshots in primary storage to reconcile.`);
                continue; // Next user
            }

            for (const snapshotPath of primarySnapshots) {
                if (!snapshotPath.endsWith('.json.gz') || snapshotPath.endsWith('.manifest.json.gz')) continue; // Process only main snapshot files

                console.log(`[${userId}] Reconciling: ${snapshotPath}`);
                let primaryContentSha256: string | null = null;
                let primarySize: number | undefined;
                let primaryMetaStatusOK = false;

                try {
                    const primaryMeta = await primaryAdapter.getMetadata!(snapshotPath);
                    if (primaryMeta) {
                        primarySize = primaryMeta.size ? Number(primaryMeta.size) : undefined;
                        // GCS stores custom metadata keys as-is.
                        primaryContentSha256 = primaryMeta['content-sha256'] || primaryMeta['contentSha256'] || null;
                        
                        if (primaryContentSha256) {
                            primaryMetaStatusOK = true;
                            console.log(`[${userId}] Primary GCS: ${snapshotPath} (Size: ${primarySize}, SHA256: ${primaryContentSha256})`);
                        } else {
                            console.warn(`[${userId}] Primary GCS ${snapshotPath}: 'content-sha256' metadata MISSING. (Size: ${primarySize || 'N/A'})`);
                            await auditLogCol.add({ type: 'reconcile_hash_missing_primary', snapshotPath, message: `'content-sha256' metadata missing on primary.`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                        }
                    } else {
                         console.warn(`[${userId}] Primary GCS ${snapshotPath}: getMetadata returned null.`);
                         await auditLogCol.add({ type: 'reconcile_primary_metadata_null', snapshotPath, message: `getMetadata returned null for primary.`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                    }
                } catch (e: any) {
                    console.error(`[${userId}] Error getting metadata from primary for ${snapshotPath}: ${e.message}`);
                    await auditLogCol.add({ type: 'reconcile_primary_error', snapshotPath, message: `Error fetching primary metadata: ${e.message}`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                    continue; // Skip to next snapshot
                }

                for (const mirror of activeMirrors) {
                    let mirrorContentSha256: string | null = null;
                    let mirrorSize: number | undefined;
                    let mirrorFileExists = false;

                    try {
                        mirrorFileExists = await mirror.adapter.exists(snapshotPath);
                        if (!mirrorFileExists) {
                            console.warn(`[${userId}]   MISSING on ${mirror.name}: ${snapshotPath}`);
                            await auditLogCol.add({ type: 'reconcile_mirror_missing', snapshotPath, mirrorName: mirror.name, mirrorBucket: mirror.config.bucket, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                            continue; 
                        }

                        const mirrorMeta = await mirror.adapter.getMetadata!(snapshotPath);
                        if (mirrorMeta) {
                            mirrorSize = mirrorMeta.size ? Number(mirrorMeta.size) : undefined;
                            // Check for content-sha256, direct contentSha256, or x-amz-meta-content-sha256 (S3/R2)
                            mirrorContentSha256 = mirrorMeta['content-sha256'] || mirrorMeta['contentSha256'] || mirrorMeta['x-amz-meta-content-sha256'] || null;
                            console.log(`[${userId}]   Mirror ${mirror.name}: ${snapshotPath} (Exists: true, Size: ${mirrorSize}, SHA256: ${mirrorContentSha256 || 'N/A'})`);
                        } else {
                             console.warn(`[${userId}]   Mirror ${mirror.name} ${snapshotPath}: getMetadata returned null despite file existing.`);
                             await auditLogCol.add({ type: 'reconcile_mirror_metadata_null', snapshotPath, mirrorName: mirror.name, mirrorBucket: mirror.config.bucket, message: `getMetadata returned null for existing mirror file.`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                        }
                        
                        // Integrity Checks
                        if (primaryMetaStatusOK && primaryContentSha256) { 
                            if (!mirrorContentSha256 && mirrorFileExists) {
                                console.warn(`[${userId}]   HASH UNKNOWN on ${mirror.name} for ${snapshotPath} ('content-sha256' missing).`);
                                await auditLogCol.add({ type: 'reconcile_hash_missing_mirror', snapshotPath, mirrorName: mirror.name, mirrorBucket: mirror.config.bucket, message: `'content-sha256' metadata missing on mirror.`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                            } else if (mirrorContentSha256 && primaryContentSha256 !== mirrorContentSha256) {
                                console.warn(`[${userId}]   HASH MISMATCH on ${mirror.name} for ${snapshotPath}: Primary=${primaryContentSha256}, Mirror=${mirrorContentSha256}`);
                                await auditLogCol.add({ type: 'reconcile_hash_mismatch', snapshotPath, mirrorName: mirror.name, primaryHash: primaryContentSha256, mirrorHash: mirrorContentSha256, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                            } else if (mirrorContentSha256 && primaryContentSha256 === mirrorContentSha256) {
                                 console.log(`[${userId}]   HASH MATCH on ${mirror.name} for ${snapshotPath}`);
                                 // Optionally add audit log for FILE_OK_VERIFIED if needed
                                 // await auditLogCol.add({ type: 'reconcile_hash_match', snapshotPath, mirrorName: mirror.name, mirrorBucket: mirror.config.bucket, hash: primaryContentSha256, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                            }
                        } else if (mirrorFileExists) { 
                             console.log(`[${userId}]   Integrity UNKNOWN for mirror ${mirror.name} on ${snapshotPath} (primary hash unavailable/invalid).`);
                             await auditLogCol.add({ type: 'reconcile_integrity_unknown', snapshotPath, mirrorName: mirror.name, mirrorBucket: mirror.config.bucket, reason: 'Primary hash unavailable or invalid', timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                        }

                        // Size comparison (can be done regardless of hash status if both sizes available)
                        if (primarySize !== undefined && mirrorSize !== undefined && primarySize !== mirrorSize) {
                            console.warn(`[${userId}]   SIZE MISMATCH on ${mirror.name} for ${snapshotPath}: Primary=${primarySize}, Mirror=${mirrorSize}`);
                            await auditLogCol.add({ type: 'reconcile_size_mismatch', snapshotPath, mirrorName: mirror.name, primarySize, mirrorSize, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                        }

                    } catch (e:any) {
                        console.error(`[${userId}]   Error checking mirror ${mirror.name} for ${snapshotPath}: ${e.message}`);
                        await auditLogCol.add({ type: 'reconcile_mirror_error', snapshotPath, mirrorName: mirror.name, message: `Error checking mirror: ${e.message}`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                    }
                }
            }
            console.log(`[${userId}] Reconciliation finished.`);
            await auditLogCol.add({ type: 'reconciliation_completed', message: `Reconciliation finished for ${primarySnapshots.length} primary snapshots.`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
        }
    } catch (error: any) {
        console.error('Reconciler worker failed globally:', error);
        // Consider a global audit log or alert for such failures
    }
}); 

// ... (imports, decryptString, interfaces, etc. are assumed to be correct from previous state) ...

functions.cloudEvent('reconcilerWorker', async (cloudEvent: functions.CloudEvent<any>) => {
    // ... (initial setup: env checks, data parsing, usersToProcessQuery) ...
    console.log('Reconciler worker triggered.', cloudEvent.data);
    if (!PRIMARY_GCS_BUCKET_NAME) {
        console.error("FATAL: GCS_BUCKET_NAME (Primary GCS Bucket) for reconciler not set.");
        return;
    }
    const data = cloudEvent.data?.message?.data ? 
                 JSON.parse(Buffer.from(cloudEvent.data.message.data, 'base64').toString()) as ReconciliationEventData :
                 {};
    const usersToProcessQuery = data.userId ? 
        db.collection('users').where((GCloudFirestore.FieldValue as any).documentId(), '==', data.userId) :
        db.collection('users');

    try {
        const usersSnapshot = await usersToProcessQuery.get();
        if (usersSnapshot.empty) { console.log('No users found for reconciliation.'); return; }
        console.log(`Starting reconciliation for ${usersSnapshot.size} user(s).`);

        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id;
            console.log(`Reconciling for user: ${userId}`);
            const auditLogCol = db.collection('users').doc(userId).collection('audit');
            const primaryAdapter = new GCSStorageAdapter({ bucket: PRIMARY_GCS_BUCKET_NAME });
            const mirrorProviderConfigsSnap = await db.collection('userStorageConfigs').doc(userId).collection('providers').where('isEnabled', '==', true).get();
            const activeMirrors: { name: string, adapter: StorageAdapter, config: UserStorageConfig }[] = [];
            // ... (mirror adapter instantiation logic - assumed correct and populates activeMirrors) ...
            if (!mirrorProviderConfigsSnap.empty) {
                for (const providerDoc of mirrorProviderConfigsSnap.docs) {
                    const config = providerDoc.data() as UserStorageProvider;
                    try {
                        if (!config.encryptedAccessKeyId || !config.encryptedSecretAccessKey) throw new Error('Missing encrypted credentials in config');
                        const accessKeyId = await decryptString(config.encryptedAccessKeyId);
                        const secretAccessKey = await decryptString(config.encryptedSecretAccessKey);
                        if (!accessKeyId || !secretAccessKey) throw new Error('Decrypted keys are empty for mirror config.');
                        if (config.type === 's3' && config.bucket && config.region) {
                            activeMirrors.push({ name: `S3-${config.bucket}`, adapter: new S3StorageAdapter({ bucket: config.bucket, region: config.region, accessKeyId, secretAccessKey, forcePathStyle: config.forcePathStyle }), config: config as UserStorageConfig });
                        } else if (config.type === 'r2' && config.bucket && config.endpoint) {
                             activeMirrors.push({ name: `R2-${config.bucket}`, adapter: new R2StorageAdapter({ bucket: config.bucket, endpoint: config.endpoint, accessKeyId, secretAccessKey, forcePathStyle: config.forcePathStyle, region: config.region || 'auto' }), config: config as UserStorageConfig });
                        }
                    } catch (e: any) {
                        console.error(`[${userId}] Failed to init mirror adapter for ${config.type} ${config.bucket}: ${e.message}`);
                        await auditLogCol.add({ type: 'reconcile_mirror_config_error', message: `Failed to init mirror ${config.type} ${config.bucket}: ${e.message}`, providerId: providerDoc.id, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                    }
                }
            }

            const userSnapshotPrefix = `${userId}/`;
            const primarySnapshots = await primaryAdapter.list(userSnapshotPrefix);
            if (primarySnapshots.length === 0) { console.log(`[${userId}] No snapshots in primary to reconcile.`); continue; }

            for (const snapshotPath of primarySnapshots) {
                if (!snapshotPath.endsWith('.json.gz') || snapshotPath.endsWith('.manifest.json.gz')) continue;
                console.log(`[${userId}] Reconciling: ${snapshotPath}`);
                let primaryContentSha256: string | null = null;
                let primarySize: number | undefined;
                let primaryMetaStatusOK = false;

                try {
                    const primaryMeta = await primaryAdapter.getMetadata!(snapshotPath);
                    if (primaryMeta) {
                        primarySize = primaryMeta.size ? Number(primaryMeta.size) : undefined;
                        // GCS stores custom metadata keys as-is.
                        primaryContentSha256 = primaryMeta['content-sha256'] || primaryMeta['contentSha256'] || null;
                        
                        if (primaryContentSha256) {
                            primaryMetaStatusOK = true;
                            console.log(`[${userId}]   Primary GCS: ${snapshotPath} (Size: ${primarySize}, SHA256: ${primaryContentSha256})`);
                        } else {
                            // Still log size if available, but mark hash as missing
                            console.warn(`[${userId}]   Primary GCS ${snapshotPath}: 'content-sha256' metadata MISSING. (Size: ${primarySize || 'N/A'})`);
                            await auditLogCol.add({ type: 'reconcile_hash_missing_primary', snapshotPath, message: `'content-sha256' metadata missing on primary.`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                            // primaryMetaStatusOK remains false if hash is missing
                        }
                    } else {
                         console.warn(`[${userId}]   Primary GCS ${snapshotPath}: getMetadata returned null.`);
                         await auditLogCol.add({ type: 'reconcile_primary_metadata_null', snapshotPath, message: `getMetadata returned null for primary.`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                         // primaryMetaStatusOK remains false
                    }
                } catch (e: any) {
                    console.error(`[${userId}]   Error getting metadata from primary for ${snapshotPath}: ${e.message}`);
                    await auditLogCol.add({ type: 'reconcile_primary_error', snapshotPath, message: `Error fetching primary metadata: ${e.message}`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                    // primaryMetaStatusOK remains false, effectively skipping hash comparison for this file with mirrors
                    // but we might still want to check mirror existence. For now, let's continue to mirror loop.
                }

                for (const mirror of activeMirrors) {
                    let mirrorContentSha256: string | null = null;
                    let mirrorSize: number | undefined;
                    let mirrorFileExists = false;

                    try {
                        mirrorFileExists = await mirror.adapter.exists(snapshotPath);
                        if (!mirrorFileExists) {
                            console.warn(`[${userId}]   MISSING on ${mirror.name}: ${snapshotPath}`);
                            await auditLogCol.add({ type: 'reconcile_mirror_missing', snapshotPath, mirrorName: mirror.name, mirrorBucket: mirror.config.bucket, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                            continue; 
                        }

                        const mirrorMeta = await mirror.adapter.getMetadata!(snapshotPath);
                        if (mirrorMeta) {
                            mirrorSize = mirrorMeta.size ? Number(mirrorMeta.size) : undefined;
                            // Check for content-sha256, direct contentSha256, or x-amz-meta-content-sha256 (S3/R2)
                            mirrorContentSha256 = mirrorMeta['content-sha256'] || mirrorMeta['contentSha256'] || mirrorMeta['x-amz-meta-content-sha256'] || null;
                            console.log(`[${userId}]   Mirror ${mirror.name}: ${snapshotPath} (Exists: true, Size: ${mirrorSize}, SHA256: ${mirrorContentSha256 || 'N/A'})`);
                        } else {
                             console.warn(`[${userId}]   Mirror ${mirror.name} ${snapshotPath}: getMetadata returned null despite file existing.`);
                             await auditLogCol.add({ type: 'reconcile_mirror_metadata_null', snapshotPath, mirrorName: mirror.name, mirrorBucket: mirror.config.bucket, message: `getMetadata returned null for existing mirror file.`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                        }
                        
                        // Integrity Checks
                        if (primaryMetaStatusOK && primaryContentSha256) { 
                            if (!mirrorContentSha256 && mirrorFileExists) {
                                console.warn(`[${userId}]   HASH UNKNOWN on ${mirror.name} for ${snapshotPath} ('content-sha256' missing).`);
                                await auditLogCol.add({ type: 'reconcile_hash_missing_mirror', snapshotPath, mirrorName: mirror.name, mirrorBucket: mirror.config.bucket, message: `'content-sha256' metadata missing on mirror.`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                            } else if (mirrorContentSha256 && primaryContentSha256 !== mirrorContentSha256) {
                                console.warn(`[${userId}]   HASH MISMATCH on ${mirror.name} for ${snapshotPath}: Primary=${primaryContentSha256}, Mirror=${mirrorContentSha256}`);
                                await auditLogCol.add({ type: 'reconcile_hash_mismatch', snapshotPath, mirrorName: mirror.name, primaryHash: primaryContentSha256, mirrorHash: mirrorContentSha256, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                            } else if (mirrorContentSha256 && primaryContentSha256 === mirrorContentSha256) {
                                 console.log(`[${userId}]   HASH MATCH on ${mirror.name} for ${snapshotPath}`);
                                 // Optionally add audit log for FILE_OK_VERIFIED if needed
                                 // await auditLogCol.add({ type: 'reconcile_hash_match', snapshotPath, mirrorName: mirror.name, mirrorBucket: mirror.config.bucket, hash: primaryContentSha256, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                            }
                        } else if (mirrorFileExists) { 
                             console.log(`[${userId}]   Integrity UNKNOWN for mirror ${mirror.name} on ${snapshotPath} (primary hash unavailable/invalid).`);
                             await auditLogCol.add({ type: 'reconcile_integrity_unknown', snapshotPath, mirrorName: mirror.name, mirrorBucket: mirror.config.bucket, reason: 'Primary hash unavailable or invalid', timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                        }

                        // Size comparison (can be done regardless of hash status if both sizes available)
                        if (primarySize !== undefined && mirrorSize !== undefined && primarySize !== mirrorSize) {
                            console.warn(`[${userId}]   SIZE MISMATCH on ${mirror.name} for ${snapshotPath}: Primary=${primarySize}, Mirror=${mirrorSize}`);
                            await auditLogCol.add({ type: 'reconcile_size_mismatch', snapshotPath, mirrorName: mirror.name, primarySize, mirrorSize, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                        }

                    } catch (e:any) {
                        console.error(`[${userId}]   Error checking mirror ${mirror.name} for ${snapshotPath}: ${e.message}`);
                        await auditLogCol.add({ type: 'reconcile_mirror_error', snapshotPath, mirrorName: mirror.name, message: `Error checking mirror: ${e.message}`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
                    }
                }
            }
            console.log(`[${userId}] Reconciliation scan finished for user.`);
            await auditLogCol.add({ type: 'reconciliation_user_scan_completed', message: `Reconciliation scan finished for ${primarySnapshots.length} primary snapshots.`, timestamp: GCloudFirestore.FieldValue.serverTimestamp() });
        }
        console.log('All user reconciliations finished.');
    } catch (error: any) {
        console.error('Reconciler worker failed globally:', error);
    }
});
