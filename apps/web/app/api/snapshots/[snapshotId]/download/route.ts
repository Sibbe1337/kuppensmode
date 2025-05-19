import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { Storage } from '@google-cloud/storage';
import { env } from '@notion-lifeline/config';

const bucketName = process.env.GCS_BUCKET_NAME;
const keyJsonString = env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const projectId = env.GCP_PROJECT_ID;

export async function GET(request: Request, { params }: { params: { snapshotId: string } }) {
  console.log("[Download API] GCP_SERVICE_ACCOUNT_KEY_JSON (first 70 chars):", keyJsonString?.substring(0, 70));
  console.log("[Download API] GCS_BUCKET_NAME:", bucketName);
  console.log("[Download API] GOOGLE_CLOUD_PROJECT:", projectId);

  const { userId } = getAuth(request as any);
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const receivedSnapshotPath = params.snapshotId;
  
  let storageClientConfig: any = {};
  if (keyJsonString && projectId) {
    try {
      const credentials = JSON.parse(keyJsonString);
      storageClientConfig = { credentials, projectId };
      console.log("[Download API] Using explicit credentials from GCP_SERVICE_ACCOUNT_KEY_JSON.");
    } catch (e) {
      console.error("[Download API] FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON.", e);
      return new NextResponse("Server configuration error - Key JSON parsing", { status: 500 });
    }
  } else {
    console.warn("[Download API] GCP_SERVICE_ACCOUNT_KEY_JSON or GOOGLE_CLOUD_PROJECT is NOT SET. Attempting to use default credentials.");
    // Let Storage() try to find ADC or other implicit credentials if explicit ones are missing
    if (projectId) storageClientConfig.projectId = projectId;
  }

  const storage = new Storage(storageClientConfig);

  if (!receivedSnapshotPath || !receivedSnapshotPath.startsWith(`${userId}/`)) {
    console.warn(`[Download API] Forbidden access attempt by userId: ${userId} for path: ${receivedSnapshotPath}`);
    return new NextResponse("Forbidden - path does not match user or is invalid", { status: 403 });
  }

  const filePath = receivedSnapshotPath;
  console.log(`[Download API] Attempting to get signed URL for GCS file: gs://${bucketName}/${filePath}`);

  try {
    const [exists] = await storage.bucket(bucketName!).file(filePath).exists();
    if (!exists) {
      console.error(`[Download API] File does not exist: gs://${bucketName}/${filePath}`);
      return new NextResponse("Snapshot file not found", { status: 404 });
    }

    const [url] = await storage
      .bucket(bucketName!)
      .file(filePath)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 10 * 60 * 1000, 
      });
    console.log(`[Download API] Generated signed URL for ${filePath}`);
    return NextResponse.json({ url });
  } catch (e) {
    console.error(`[Download API] Error generating signed URL for ${filePath}:`, e);
    return new NextResponse("Failed to generate download URL", { status: 500 });
  }
} 