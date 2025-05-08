import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server'; 
import { PubSub } from '@google-cloud/pubsub'; // Uncommented

// Initialize PubSub client (outside handler for potential reuse)
const pubsub = new PubSub();
const topicName = process.env.PUBSUB_SNAPSHOT_TOPIC || 'notion-lifeline-snapshot-requests'; // Use env var or default

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