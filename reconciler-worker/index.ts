import { createFirestore } from '../packages/shared/firestore';
import { createStorage } from '../packages/shared/storage';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import PQueue from 'p-queue';
import zlib from 'zlib';
import { promisify } from 'util';
const gunzipAsync = promisify(zlib.gunzip);

const db = createFirestore();
const gcs = createStorage();

async function downloadAndParseManifestGCS(bucket: string, userId: string, snapshotId: string) {
  const [compressed] = await gcs.bucket(bucket).file(`${userId}/${snapshotId}.manifest.json.gz`).download();
  const manifestJson = (await gunzipAsync(compressed)).toString();
  return JSON.parse(manifestJson);
}

async function downloadAndParseManifestS3(cfg: any, userId: string, snapshotId: string) {
  const s3 = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  const { Body } = await s3.send(new GetObjectCommand({
    Bucket: cfg.bucket,
    Key: `${userId}/${snapshotId}.manifest.json.gz`,
  }));
  const chunks: Buffer[] = [];
  for await (const chunk of Body as any) chunks.push(chunk);
  const compressed = Buffer.concat(chunks);
  const manifestJson = (await gunzipAsync(compressed)).toString();
  return JSON.parse(manifestJson);
}

async function main() {
  console.log('Reconciler started');

  // Step 1: List all users
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    console.log(`\nChecking user: ${userId}`);
    // Step 2: List all snapshots for the user
    const snapshotsSnap = await db.collection('users').doc(userId).collection('snapshots').get();
    for (const snapDoc of snapshotsSnap.docs) {
      const snap = snapDoc.data();
      const snapshotId = snap.snapshotId;
      const gcsPath = snap.gcsPath;
      const manifestPath = snap.manifestPath;
      console.log(`  Snapshot: ${snapshotId}`);
      // Step 3: List all provider configs for the user
      const providersSnap = await db.collection('userStorageConfigs').doc(userId).collection('providers').where('isEnabled', '==', true).get();
      // Download and parse the primary manifest (GCS)
      let primaryManifest: Record<string, any> | null = null;
      try {
        primaryManifest = await downloadAndParseManifestGCS(snap.gcsPath?.split('/')[2] || 'pagelifeline-snapshots', userId, snapshotId);
      } catch (err) {
        console.error(`    ❌ Could not download/parse primary manifest:`, err);
        continue;
      }
      for (const providerDoc of providersSnap.docs) {
        const cfg = providerDoc.data();
        try {
          let replicaManifest: Record<string, any> | null = null;
          if (cfg.type === 'gcs') {
            // Check existence in GCS
            const [exists] = await gcs.bucket(cfg.bucket).file(`${userId}/${snapshotId}.json.gz`).exists();
            if (!exists) {
              console.error(`    ❌ GCS: Missing snapshot in bucket ${cfg.bucket}`);
              continue;
            } else {
              console.log(`    ✅ GCS: Found in bucket ${cfg.bucket}`);
            }
            // Download and compare manifest
            try {
              replicaManifest = await downloadAndParseManifestGCS(cfg.bucket, userId, snapshotId);
            } catch (err) {
              console.error(`    ❌ GCS: Could not download/parse replica manifest:`, err);
              continue;
            }
          } else if (cfg.type === 's3' || cfg.type === 'r2') {
            // Check existence in S3/R2
            const s3 = new S3Client({
              region: cfg.region,
              endpoint: cfg.endpoint,
              forcePathStyle: cfg.forcePathStyle,
              credentials: {
                accessKeyId: cfg.accessKeyId,
                secretAccessKey: cfg.secretAccessKey,
              },
            });
            try {
              await s3.send(new HeadObjectCommand({
                Bucket: cfg.bucket,
                Key: `${userId}/${snapshotId}.json.gz`,
              }));
              console.log(`    ✅ ${cfg.type.toUpperCase()}: Found in bucket ${cfg.bucket}`);
            } catch (err: any) {
              if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
                console.error(`    ❌ ${cfg.type.toUpperCase()}: Missing snapshot in bucket ${cfg.bucket}`);
                continue;
              } else {
                console.error(`    ❌ ${cfg.type.toUpperCase()}: Error checking bucket ${cfg.bucket}:`, err.message);
                continue;
              }
            }
            // Download and compare manifest
            try {
              replicaManifest = await downloadAndParseManifestS3(cfg, userId, snapshotId);
            } catch (err) {
              console.error(`    ❌ ${cfg.type.toUpperCase()}: Could not download/parse replica manifest:`, err);
              continue;
            }
          }
          // Now compare manifests
          if (primaryManifest && replicaManifest) {
            let discrepancies = 0;
            for (const key in primaryManifest) {
              if (!replicaManifest[key]) {
                console.error(`    ❌ ${cfg.type.toUpperCase()}: Missing item ${key} in manifest`);
                discrepancies++;
              } else if (primaryManifest[key].hash !== replicaManifest[key].hash) {
                console.error(`    ❌ ${cfg.type.toUpperCase()}: Hash mismatch for item ${key}`);
                discrepancies++;
              }
            }
            for (const key in replicaManifest) {
              if (!primaryManifest[key]) {
                console.error(`    ❌ ${cfg.type.toUpperCase()}: Extra item ${key} in replica manifest`);
                discrepancies++;
              }
            }
            if (discrepancies === 0) {
              console.log(`    ✅ ${cfg.type.toUpperCase()}: Manifest hash comparison complete, no discrepancies.`);
            } else {
              console.warn(`    ⚠️  ${cfg.type.toUpperCase()}: ${discrepancies} discrepancies found in manifest comparison.`);
            }
          }
        } catch (err) {
          console.error(`    ❌ Error checking provider ${cfg.type}:`, err);
        }
      }
    }
  }
  console.log('\nReconciler finished.');
}

main().catch(err => {
  console.error('Fatal error in reconciler:', err);
  process.exit(1);
}); 