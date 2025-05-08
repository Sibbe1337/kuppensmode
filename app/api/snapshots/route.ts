import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Storage } from '@google-cloud/storage';
import type { Snapshot } from '@/types';

// Initialize GCS Storage client
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const bucketName = process.env.GCS_BUCKET_NAME;

let storageClientConfig: any = {
  ...(projectId && { projectId }),
};

if (keyJsonString) {
  try {
    console.log('Attempting to use Storage credentials from GCP_SERVICE_ACCOUNT_KEY_JSON env var.');
    const credentials = JSON.parse(keyJsonString);
    storageClientConfig = { ...storageClientConfig, credentials };
  } catch (e) {
    console.error("FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON for Storage.", e);
    throw new Error("Invalid GCP Service Account Key JSON provided for Storage.");
  }
} else if (process.env.NODE_ENV !== 'production') {
  console.warn("GCP_SERVICE_ACCOUNT_KEY_JSON not set. Attempting Application Default Credentials for Storage (may fail).");
} else {
  console.error('FATAL: GCP_SERVICE_ACCOUNT_KEY_JSON is not set in production. Storage cannot authenticate.');
  throw new Error("Missing GCP Service Account Key JSON for Storage authentication.");
}

const storage = new Storage(storageClientConfig);

export async function GET(request: Request) {
  if (!bucketName) {
    console.error("GCS_BUCKET_NAME environment variable not set.");
    return new NextResponse("Server configuration error", { status: 500 });
  }

  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    console.log(`Fetching snapshots for user: ${userId} from bucket: ${bucketName}`);

    // List files from GCS
    const [files] = await storage.bucket(bucketName).getFiles({ prefix: `${userId}/` });
    console.log(`Found ${files.length} files/folders for user ${userId}`);

    // Map GCS file data to Snapshot[] format
    const snapshots: Snapshot[] = files
      .filter(file => file.name !== `${userId}/`) // Filter out the directory placeholder itself
      .map((file) => {
        const timestamp = file.metadata.timeCreated;
        const sizeBytes = Number(file.metadata.size || 0);
        const sizeKB = Math.round(sizeBytes / 1024);

        return {
          id: file.name, // Use the full GCS path as the unique ID
          timestamp: timestamp || new Date().toISOString(), // Use file creation time, fallback to now
          sizeKB: sizeKB,
          status: 'Completed', // Assuming all listed files are completed snapshots
        };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Sort newest first

    console.log(`Returning ${snapshots.length} snapshots for user ${userId}`);
    return NextResponse.json(snapshots);

  } catch (error) {
    console.error(`Error fetching snapshots from GCS for user:`, error);
    // Check if userId was available in case auth() failed
    // You might want more specific error handling based on GCS errors
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 