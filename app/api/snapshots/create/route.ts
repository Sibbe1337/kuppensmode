import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server'; 
import { PubSub } from '@google-cloud/pubsub';

// --- GCP Client Initialization ---
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const topicName = process.env.PUBSUB_SNAPSHOT_TOPIC || 'notion-lifeline-snapshot-requests';

let pubSubClientConfig: any = {
  ...(projectId && { projectId }),
};

if (keyJsonString) {
  try {
    console.log('Attempting to use PubSub credentials from GCP_SERVICE_ACCOUNT_KEY_JSON env var.');
    const credentials = JSON.parse(keyJsonString);
    pubSubClientConfig = { ...pubSubClientConfig, credentials };
  } catch (e) {
    console.error("FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON for PubSub.", e);
    throw new Error("Invalid GCP Service Account Key JSON provided for PubSub.");
  }
} else if (process.env.NODE_ENV !== 'production') {
  console.warn("GCP_SERVICE_ACCOUNT_KEY_JSON not set. Attempting Application Default Credentials for PubSub (may fail).");
} else {
  console.error('FATAL: GCP_SERVICE_ACCOUNT_KEY_JSON is not set in production. PubSub cannot authenticate.');
  throw new Error("Missing GCP Service Account Key JSON for PubSub authentication.");
}

const pubsub = new PubSub(pubSubClientConfig);
// --- End GCP Client Initialization ---

export async function POST(request: Request) {
  try {
    // 1. Get authenticated user ID
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    console.log(`Initiating snapshot creation request for user: ${userId}`);

    // 2. Publish a job message to Pub/Sub
    const jobData = {
      userId: userId,
      requestedAt: Date.now(),
      // Add any other relevant details if needed (e.g., specific pages? snapshot type?)
    };
    const dataBuffer = Buffer.from(JSON.stringify(jobData));
    
    try {
        const messageId = await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
        console.log(`Snapshot request message ${messageId} published to topic ${topicName} for user ${userId}.`);
    } catch (pubsubError) {
        console.error(`Failed to publish snapshot request for user ${userId} to topic ${topicName}:`, pubsubError);
        throw new Error('Failed to queue snapshot request.'); // Throw error to be caught below
    }

    // 3. Return success response
    return NextResponse.json({ success: true, message: "Snapshot process initiated." });

  } catch (error: any) {
    console.error("Error initiating snapshot creation:", error);
    // Return specific error message if available
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
} 