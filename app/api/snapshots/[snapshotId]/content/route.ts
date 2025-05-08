import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Storage } from '@google-cloud/storage';
import { gunzipSync } from 'zlib'; // Use Node.js built-in zlib for decompression

// --- GCP Client Initialization ---
// Reusing the logic from other routes to initialize Storage client
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const bucketName = process.env.GCS_BUCKET_NAME;

let storageClientConfig: any = {
  ...(projectId && { projectId }),
};

if (keyJsonString) {
  try {
    console.log('Attempting to use Storage credentials from GCP_SERVICE_ACCOUNT_KEY_JSON env var (Snapshot Content Route).');
    const credentials = JSON.parse(keyJsonString);
    storageClientConfig = { ...storageClientConfig, credentials };
  } catch (e) {
    console.error("FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON for Storage (Snapshot Content Route).", e);
    // Throwing error here will prevent the function from initializing storageClient properly
    // Handle appropriately based on deployment strategy - maybe fall back if needed?
    // For now, we assume the key is required if present.
    throw new Error("Invalid GCP Service Account Key JSON provided for Storage.");
  }
} else if (process.env.NODE_ENV !== 'production' && !process.env.GCP_SERVICE_ACCOUNT_KEY_JSON) {
   // Allow missing credentials only in non-production environments if the key JSON is explicitly missing
   console.warn('GCP_SERVICE_ACCOUNT_KEY_JSON not found. Storage client initialized without explicit credentials (Snapshot Content Route).');
} else if (process.env.NODE_ENV === 'production' && !keyJsonString) {
    // In production, credentials MUST be provided via env var
    console.error("FATAL: GCP_SERVICE_ACCOUNT_KEY_JSON is required in production for Storage (Snapshot Content Route).");
    throw new Error("GCP Service Account Key JSON is required in production.");
}

const storage = new Storage(storageClientConfig);

// Type definition for the items we want to return to the frontend
interface SnapshotItemSummary {
    id: string;
    name: string; // Extracted name/title
    type: 'database' | 'page' | string; // Original object type
}

// Helper to extract a display name from Notion title arrays or properties
function getItemName(item: any): string {
    if (item.object === 'database' && item.title && Array.isArray(item.title) && item.title[0]?.plain_text) {
        return item.title[0].plain_text;
    }
    if (item.object === 'page' && item.properties?.title?.title && Array.isArray(item.properties.title.title) && item.properties.title.title[0]?.plain_text) {
         return item.properties.title.title[0].plain_text;
    }
     if (item.object === 'page' && item.properties?.Name?.title && Array.isArray(item.properties.Name.title) && item.properties.Name.title[0]?.plain_text) {
         // Handle cases where title property might be named "Name" (common in databases)
         return item.properties.Name.title[0].plain_text;
     }
    return item.id; // Fallback to ID if no suitable title found
}


export async function GET(
  request: Request,
  { params }: { params: { snapshotId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const snapshotId = params.snapshotId;
    if (!snapshotId) {
      return new NextResponse("Missing snapshotId parameter", { status: 400 });
    }

    if (!bucketName) {
        console.error('GCS_BUCKET_NAME environment variable not set.');
        return new NextResponse('Server configuration error: Missing bucket name.', { status: 500 });
    }

    // Construct the file path within GCS
    const filePath = `${userId}/${snapshotId}.json.gz`;
    console.log(`Attempting to fetch snapshot content: gs://${bucketName}/${filePath}`);

    const file = storage.bucket(bucketName).file(filePath);

    // Download the compressed file buffer
    const [compressedBuffer] = await file.download();
    console.log(`Downloaded ${filePath}, size: ${compressedBuffer.length} bytes`);

    // Decompress using gunzipSync
    const decompressedBuffer = gunzipSync(compressedBuffer);
    console.log(`Decompressed snapshot data.`);

    // Parse the JSON
    const snapshotData = JSON.parse(decompressedBuffer.toString('utf-8'));
    console.log(`Parsed snapshot JSON data.`);

    // Extract and map the items for the UI
    if (!snapshotData || !Array.isArray(snapshotData.items)) {
       console.error('Snapshot data is missing or items array is not found.');
       return new NextResponse('Invalid snapshot file format', { status: 500 });
    }

    const itemSummaries: SnapshotItemSummary[] = snapshotData.items.map((item: any) => ({
        id: item.id,
        name: getItemName(item), // Use helper to get a readable name
        type: item.object ?? 'unknown' // Provide default if object type is missing
    }));

    console.log(`Returning ${itemSummaries.length} item summaries.`);
    return NextResponse.json(itemSummaries);

  } catch (error: any) {
    console.error(`Error fetching snapshot content for snapshotId ${params?.snapshotId}:`, error);
    
    // Handle specific GCS error for file not found (code 404)
    if (error.code === 404) {
        return new NextResponse('Snapshot file not found in storage.', { status: 404 });
    }
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
        return new NextResponse('Failed to parse snapshot file content.', { status: 500 });
    }
    
    // Handle Zlib errors
    if (error.code && error.code.startsWith('Z_')) {
         return new NextResponse('Failed to decompress snapshot file.', { status: 500 });
    }

    // Generic server error
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 