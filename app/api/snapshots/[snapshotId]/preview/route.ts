import { NextResponse, NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Storage } from "@google-cloud/storage"; // Import Storage
import zlib from "zlib";

// Initialize GCS Storage client (similar to other routes)
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const bucketName = process.env.GCS_BUCKET_NAME;

let storageClientConfig: any = { ...(projectId && { projectId }) };
if (keyJsonString) {
  try {
    const credentials = JSON.parse(keyJsonString);
    storageClientConfig = { ...storageClientConfig, credentials };
  } catch (e) {
    console.error("[Snapshot Preview API] FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON.", e);
    // This is a server config error, requests will likely fail if this happens
  }
}
const storage = new Storage(storageClientConfig);

interface SnapshotItemPreview {
    id: string;
    title: string;
    type: string; 
}

export async function GET(request: NextRequest, { params }: { params: { snapshotPath: string[] }}) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!bucketName) {
    console.error("[Snapshot Preview API] GCS_BUCKET_NAME not configured.");
    return new NextResponse("Server configuration error", { status: 500 });
  }
  
  const filePath = params.snapshotPath.join('/');
  console.log(`[Snapshot Preview API] Catch-all. Attempting to preview file: ${filePath} in bucket ${bucketName}`);

  if (!filePath.startsWith(`${userId}/`)) {
    console.warn(`[Snapshot Preview API] Unauthorized access attempt by ${userId} for path ${filePath}`);
    return new NextResponse("Forbidden: Path does not match user", { status: 403 });
  }

  const file = storage.bucket(bucketName).file(filePath);

  try {
    const [buf] = await file.download();
    console.log(`[Snapshot Preview API] File ${filePath} downloaded, size: ${buf.length}`);

    const jsonString = filePath.endsWith(".gz") 
        ? zlib.gunzipSync(buf).toString()
        : buf.toString();
    
    const jsonData = JSON.parse(jsonString);
    console.log("[Snapshot Preview API] JSON parsed.");

    const itemsArray = jsonData?.items && Array.isArray(jsonData.items) ? jsonData.items : [];
    const firstLevel: SnapshotItemPreview[] = itemsArray.map(
      (x: any) => ({
         id: x.id || "unknown-id", 
         title: x.title && Array.isArray(x.title) && x.title.length > 0 
                ? x.title[0]?.plain_text || "(untitled)" 
                : (typeof x.title === 'string' ? x.title : (x.name || "(untitled)")),
         type: x.object || "unknown-type"
        })
    );
    console.log(`[Snapshot Preview API] Found ${firstLevel.length} first-level items.`);
    return NextResponse.json({ items: firstLevel });

  } catch (e: any) {
    console.error(`[Snapshot Preview API] Error processing file ${filePath}:`, e);
    if (e.code === 404 || (e.message && e.message.includes("No such object"))) {
        return new NextResponse("Snapshot file not found", { status: 404 });
    }
    return new NextResponse("Error processing snapshot preview", { status: 500 });
  }
} 