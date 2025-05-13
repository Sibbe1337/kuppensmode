import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { Storage } from '@google-cloud/storage';

const bucketName = process.env.GCS_BUCKET_NAME;

export async function GET(request: Request, { params }: { params: { snapshotId: string } }) {
  const { userId } = getAuth(request as any);
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  // The snapshotId param from the route is expected to be the full GCS object path
  // relative to the bucket root, e.g., "user_XXXX/snap_YYYY.json.gz"
  const receivedSnapshotPath = params.snapshotId;
  const storage = new Storage();

  // Security Check: Ensure the requested path starts with the authenticated user's ID
  if (!receivedSnapshotPath || !receivedSnapshotPath.startsWith(`${userId}/`)) {
    console.warn(`[Download API] Forbidden access attempt by userId: ${userId} for path: ${receivedSnapshotPath}`);
    return new NextResponse("Forbidden - path does not match user or is invalid", { status: 403 });
  }

  // The receivedSnapshotPath is the filePath
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
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
        // Optional: prompt browser to download with original filename
        // responseDisposition: `attachment; filename="${filePath.split('/').pop()}"` 
      });
    console.log(`[Download API] Generated signed URL for ${filePath}`);
    return NextResponse.json({ url });
  } catch (e) {
    console.error(`[Download API] Error generating signed URL for ${filePath}:`, e);
    return new NextResponse("Failed to generate download URL", { status: 500 });
  }
} 