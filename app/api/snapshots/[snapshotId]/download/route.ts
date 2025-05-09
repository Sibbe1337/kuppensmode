import { NextResponse, NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Storage } from "@google-cloud/storage"; // Import Storage

// Initialize GCS Storage client
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const bucketName = process.env.GCS_BUCKET_NAME;

let storageClientConfig: any = { ...(projectId && { projectId }) };
if (keyJsonString) {
  try {
    const credentials = JSON.parse(keyJsonString);
    storageClientConfig = { ...storageClientConfig, credentials };
  } catch (e) {
    console.error("[Snapshot Download API] FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON.", e);
  }
}
const storage = new Storage(storageClientConfig);

export async function GET(request: NextRequest, { params }: { params: { snapshotPath: string[] }}) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!bucketName) {
    console.error("[Snapshot Download API] GCS_BUCKET_NAME not configured.");
    return new NextResponse("Server configuration error", { status: 500 });
  }
  
  const filePath = params.snapshotPath.join('/');
  console.log(`[Snapshot Download API] Catch-all. Attempting to get signed URL for file: ${filePath} in bucket ${bucketName}`);

  if (!filePath.startsWith(`${userId}/`)) {
    console.warn(`[Snapshot Download API] Unauthorized access attempt by ${userId} for path ${filePath}`);
    return new NextResponse("Forbidden: Path does not match user", { status: 403 });
  }

  const file = storage.bucket(bucketName).file(filePath);

  try {
    const [exists] = await file.exists();
    if (!exists) {
      console.error(`[Snapshot Download API] File ${filePath} does not exist.`);
      return new NextResponse("Snapshot file not found", { status: 404 });
    }

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      responseDisposition: `attachment; filename="${filePath.split('/').pop()}"`,
    });
    console.log(`[Snapshot Download API] Generated signed URL: ${url}`);
    return NextResponse.redirect(url);

  } catch (e: any) {
    console.error(`[Snapshot Download API] Error generating signed URL for ${filePath}:`, e);
    return new NextResponse("Error generating download link", { status: 500 });
  }
} 