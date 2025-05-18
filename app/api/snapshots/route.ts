import { NextResponse } from 'next/server';
import { auth, getAuth } from '@clerk/nextjs/server';
import { createStorage } from '../../packages/shared/storage';
import type { Snapshot } from '@/types';
import { getDb } from "@/lib/firestore";
import { FieldValue } from '@shared/firestore';

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const bucketName = process.env.GCS_BUCKET_NAME;

let storageInstance: Storage | null = null;

function getStorageInstance(): Storage {
  if (storageInstance) {
    return storageInstance;
  }
  let storageClientConfig: any = {
    ...(projectId && { projectId }),
  };
  if (keyJsonString) {
    try {
      console.log('[Storage Lib - Snapshots Route] Attempting to use credentials from GCP_SERVICE_ACCOUNT_KEY_JSON.');
      const credentials = JSON.parse(keyJsonString);
      storageClientConfig = { ...storageClientConfig, credentials };
    } catch (e) {
      console.error("[Storage Lib - Snapshots Route] FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON.", e);
      throw new Error("Invalid GCP Service Account Key JSON provided for Storage.");
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Storage Lib - Snapshots Route] GCP_SERVICE_ACCOUNT_KEY_JSON is NOT SET. Storage client will initialize without explicit credentials. Operations may fail if ADC not available/configured at runtime.');
    } else {
      console.warn('[Storage Lib - Snapshots Route] GCP_SERVICE_ACCOUNT_KEY_JSON not set in dev. Attempting Application Default Credentials.');
    }
  }
  storageInstance = createStorage(storageClientConfig);
  console.log('[Storage Lib - Snapshots Route] Storage instance configured.');
  return storageInstance;
}

const getStorage = () => getStorageInstance();

export async function GET(request: Request) {
  const storage = getStorage();
  const db = getDb();
  const { userId } = getAuth(request as any);
  if (!bucketName) {
    console.error("GCS_BUCKET_NAME environment variable not set.");
    return new NextResponse("Server configuration error", { status: 500 });
  }

  try {
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    console.log(`Fetching snapshots for user: ${userId} from bucket: ${bucketName}`);

    // List files from GCS
    const [files] = await storage.bucket(bucketName).getFiles({ prefix: `${userId}/` });
    console.log(`Found ${files.length} files/folders for user ${userId}`);

    const snapshotPromises = files
      .filter(file => file.name !== `${userId}/` && file.name.endsWith('.json.gz') && !file.name.endsWith('.manifest.json.gz'))
      .map(async (file) => {
        const timestamp = file.metadata.timeCreated;
        const sizeBytes = Number(file.metadata.size || 0);
        const sizeKB = Math.round(sizeBytes / 1024);
        
        // Extract snapshotId from filename (e.g., snap_userId_timestamp)
        // This needs to be consistent with how snapshotId is generated and used for diffSummary
        const fileNameParts = file.name.split('/').pop()?.split('.json.gz');
        const snapshotId = fileNameParts ? fileNameParts[0] : file.name; // Fallback to full path if parsing fails

        let diffSummary = null;
        try {
          const diffDocRef = db.collection('users').doc(userId).collection('snapshotDiffs').doc(snapshotId);
          const diffDoc = await diffDocRef.get();
          if (diffDoc.exists) {
            const data = diffDoc.data();
            diffSummary = {
              added: data?.added || 0,
              removed: data?.removed || 0,
              changed: data?.changed || 0,
              previousSnapshotId: data?.previousSnapshotId || undefined,
            };
          }
        } catch (fsError) {
          console.warn(`[API Snapshots] Could not fetch diffSummary for ${snapshotId}:`, fsError);
        }

        return {
          id: file.name, // GCS path as ID
          snapshotIdActual: snapshotId, // Parsed snapshotId for linking to diff
          timestamp: timestamp || new Date().toISOString(),
          sizeKB: sizeKB,
          status: 'Completed',
          diffSummary: diffSummary,
        } as Snapshot; // Cast to Snapshot type which now includes diffSummary
      });

    const snapshotsWithDiffs = await Promise.all(snapshotPromises);
    
    const sortedSnapshots = snapshotsWithDiffs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log(`Returning ${sortedSnapshots.length} snapshots for user ${userId}`);
    return NextResponse.json(sortedSnapshots);

  } catch (error) {
    console.error(`Error fetching snapshots from GCS for user:`, error);
    // Check if userId was available in case auth() failed
    // You might want more specific error handling based on GCS errors
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const storage = getStorage();
  const db = getDb();
  const { userId } = getAuth(request as any);
  // ... DELETE logic ...
} 