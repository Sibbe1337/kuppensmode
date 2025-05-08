import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PubSub } from '@google-cloud/pubsub';
import { v4 as uuid } from 'uuid';

// --- GCP Client Initialization ---
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const TOPIC = process.env.PUBSUB_RESTORE_TOPIC ?? 'notion-lifeline-restore';

let pubSubClientConfig: any = {
  ...(projectId && { projectId }),
};

if (keyJsonString) {
  try {
    console.log('Attempting to use PubSub credentials from GCP_SERVICE_ACCOUNT_KEY_JSON env var (Restore Route).');
    const credentials = JSON.parse(keyJsonString);
    pubSubClientConfig = { ...pubSubClientConfig, credentials };
  } catch (e) {
    console.error("FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON for PubSub (Restore Route).", e);
    throw new Error("Invalid GCP Service Account Key JSON provided for PubSub.");
  }
} else if (process.env.NODE_ENV !== 'production') {
  console.warn("GCP_SERVICE_ACCOUNT_KEY_JSON not set. Attempting Application Default Credentials for PubSub (Restore Route) (may fail).");
} else {
  console.error('FATAL: GCP_SERVICE_ACCOUNT_KEY_JSON is not set in production. PubSub (Restore Route) cannot authenticate.');
  throw new Error("Missing GCP Service Account Key JSON for PubSub authentication.");
}

const pubsub = new PubSub(pubSubClientConfig);
// --- End GCP Client Initialization ---

// This forces the route to be dynamic if needed, but POST routes often are by default
// export const dynamic = 'force-dynamic'; 

interface RestoreRequestBody {
  snapshotId: string;
  targets?: string[]; // Optional: specific databases/pages to restore
  targetParentPageId?: string; // Optional: ID of the page to restore content into
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: RestoreRequestBody;
  try {
    body = await request.json();
  } catch (error) {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  const { snapshotId, targets, targetParentPageId } = body;

  if (!snapshotId) {
    return new NextResponse("Missing snapshotId", { status: 400 });
  }

  const restoreId = uuid(); // Generate unique job ID

  console.log(`Queueing restore job: ${restoreId} for user: ${userId}, snapshot: ${snapshotId}, targetParent: ${targetParentPageId ?? 'Default'}`);

  // Construct the job payload
  const job = {
    restoreId,
    userId,
    snapshotId,
    targets: targets ?? null, // Use null if targets are not provided
    targetParentPageId: targetParentPageId ?? null, // Include targetParentPageId
    requestedAt: Date.now(),
  };

  // Publish the job message to Pub/Sub
  try {
    const messageId = await pubsub.topic(TOPIC).publishMessage({
      json: job, // Publishes the job object as JSON
    });
    console.log(`Message ${messageId} published to topic ${TOPIC}.`);
    
    // Immediately return the restoreId to the client
    return NextResponse.json({ success: true, restoreId: restoreId });
    
  } catch (error) {
    console.error(`Failed to publish restore job ${restoreId} to Pub/Sub:`, error);
    // Return a server error response
    return new NextResponse("Failed to queue restore job", { status: 500 });
  }
} 