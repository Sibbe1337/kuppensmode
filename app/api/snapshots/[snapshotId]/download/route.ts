import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { Storage } from '@google-cloud/storage';

const bucketName = process.env.GCS_BUCKET_NAME;

export async function GET(request: Request, { params }: { params: { snapshotId: string } }) {
  const { userId } = getAuth(request as any);
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { snapshotId } = params;
  const storage = new Storage();
  const filePath = `${userId}/${snapshotId}.json.gz`;

  console.log(`[Download API] userId: ${userId}, snapshotId: ${snapshotId}, filePath: ${filePath}`);

  try {
    const [exists] = await storage.bucket(bucketName!).file(filePath).exists();
    if (!exists) {
      console.error(`[Download API] File does not exist: ${filePath}`);
      return new NextResponse("Snapshot file not found", { status: 404 });
    }
    const [url] = await storage
      .bucket(bucketName!)
      .file(filePath)
      .getSignedUrl({
        action: 'read',
        expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      });
    return NextResponse.json({ url });
  } catch (e) {
    console.error(`[Download API] Error generating signed URL:`, e);
    return new NextResponse("Failed to generate download URL", { status: 500 });
  }
} 