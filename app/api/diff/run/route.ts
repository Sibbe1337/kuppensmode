import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PubSub } from '@google-cloud/pubsub';
import { v4 as uuidv4 } from 'uuid'; // Ensure uuid is imported

export const runtime = 'nodejs';

interface DiffRunRequest {
  snapshotIdFrom: string;
  snapshotIdTo: string;
  // Potentially other options like specific items to compare, priority, etc.
}

let pubsub: PubSub | null = null;
const topicName = process.env.PUBSUB_DIFF_TOPIC || 'notion-lifeline-diff-requests';

// Initialize PubSub client (outside handler for potential reuse)
if (process.env.GOOGLE_CLOUD_PROJECT) {
  try {
    pubsub = new PubSub({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
    console.log(`[API Diff Run] PubSub client initialized for topic: ${topicName}`);
  } catch (error) {
    console.error("[API Diff Run] Failed to initialize PubSub client:", error);
    pubsub = null; // Ensure it's null if init fails
  }
} else {
  console.warn("[API Diff Run] GOOGLE_CLOUD_PROJECT env var not set. PubSub client for diff requests not initialized.");
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!pubsub) {
    console.error("[API Diff Run] PubSub client not available.");
    return NextResponse.json({ error: "Server configuration error: PubSub not initialized." }, { status: 500 });
  }

  try {
    const body: DiffRunRequest = await request.json();
    const { snapshotIdFrom, snapshotIdTo } = body;

    if (!snapshotIdFrom || !snapshotIdTo) {
      return NextResponse.json({ error: 'Missing snapshotIdFrom or snapshotIdTo' }, { status: 400 });
    }

    const diffJobId = uuidv4();
    console.log(`[API Diff Run] User: ${userId} requested diff between ${snapshotIdFrom} and ${snapshotIdTo}. Job ID: ${diffJobId}`);

    const jobData = {
      userId,
      snapshotIdFrom,
      snapshotIdTo,
      diffJobId,
      requestedAt: new Date().toISOString(),
    };
    const dataBuffer = Buffer.from(JSON.stringify(jobData));
    
    await pubsub.topic(topicName).publishMessage({ data: dataBuffer });
    console.log(`[API Diff Run] Message published for job ${diffJobId} to topic ${topicName}.`);

    return NextResponse.json({ 
      success: true, 
      message: "Difference analysis job queued.", 
      jobId: diffJobId,
      statusUrl: `/api/diff/status/${diffJobId}` // Client can poll this URL
    });

  } catch (error: any) {
    console.error("[API Diff Run] Error:", error);
    const errorMessage = error.message || "Failed to queue difference analysis.";
    // Check for specific Pub/Sub errors if needed, e.g., topic not found
    if (error.code === 5) { // Typically GRPC code for NOT_FOUND
        return NextResponse.json({ error: `Pub/Sub topic '${topicName}' not found. Please configure the topic.`, details: errorMessage }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to queue difference analysis.", details: errorMessage }, { status: 500 });
  }
} 