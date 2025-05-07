import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PubSub } from '@google-cloud/pubsub'; // Added Pub/Sub import
import { v4 as uuid } from 'uuid'; // Added uuid import

// Initialize PubSub client
const pubsub = new PubSub(); 
const TOPIC = process.env.PUBSUB_RESTORE_TOPIC ?? 'notion-lifeline-restore';

// This forces the route to be dynamic if needed, but POST routes often are by default
// export const dynamic = 'force-dynamic'; 

interface RestoreRequestBody {
  snapshotId: string;
  targets?: string[]; // Optional: specific databases/pages to restore
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

  const { snapshotId, targets } = body;

  if (!snapshotId) {
    return new NextResponse("Missing snapshotId", { status: 400 });
  }

  const restoreId = uuid(); // Generate unique job ID

  console.log(`Queueing restore job: ${restoreId} for user: ${userId}, snapshot: ${snapshotId}`);

  // Construct the job payload
  const job = {
    restoreId,
    userId,
    snapshotId,
    targets: targets ?? null, // Use null if targets are not provided
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