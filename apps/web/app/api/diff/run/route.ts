import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PubSub } from '@google-cloud/pubsub';
import { v4 as uuidv4 } from 'uuid'; // Ensure uuid is imported
import { getDb } from "@/lib/firestore"; // Import getDb
import { env } from '@notion-lifeline/config';

export const runtime = 'nodejs';

interface DiffRunRequest {
  snapshotIdFrom: string;
  snapshotIdTo: string;
  // Potentially other options like specific items to compare, priority, etc.
}

const projectId = env.GCP_PROJECT_ID;
const keyJsonString = env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const TOPIC_NAME_DIFF_RUN = process.env.PUBSUB_DIFF_TOPIC || 'notion-lifeline-diff-requests';

let diffRunPubSubInstance: PubSub | null = null;

function getDiffRunPubSubInstance(): PubSub | null { // Allow null return if init fails
  if (diffRunPubSubInstance) {
    return diffRunPubSubInstance;
  }
  if (!projectId) {
    console.warn("[PubSub Lib - DiffRun Route] GOOGLE_CLOUD_PROJECT env var not set. PubSub client cannot be initialized.");
    return null;
  }
  let pubSubClientConfig: any = { projectId };

  if (keyJsonString) {
    try {
      console.log('[PubSub Lib - DiffRun Route] Attempting to use credentials from GCP_SERVICE_ACCOUNT_KEY_JSON.');
      const credentials = JSON.parse(keyJsonString);
      pubSubClientConfig = { ...pubSubClientConfig, credentials };
    } catch (e) {
      console.error("[PubSub Lib - DiffRun Route] FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON.", e);
      // Do not throw here for build, let it be null and fail at runtime if pubsub is used without init
      return null; 
    }
  } else {
    // No keyJsonString provided, relying on ADC or build environment
    if (process.env.NODE_ENV === 'production') {
        console.warn('[PubSub Lib - DiffRun Route] GCP_SERVICE_ACCOUNT_KEY_JSON is NOT SET. PubSub client will initialize via ADC or fail at runtime if not configured.');
    } else {
        console.warn('[PubSub Lib - DiffRun Route] GCP_SERVICE_ACCOUNT_KEY_JSON not set in dev. Attempting Application Default Credentials.');
    }
  }
  try {
    console.log(`[PubSub Lib - DiffRun Route] Initializing PubSub instance for topic ${TOPIC_NAME_DIFF_RUN}.`);
    diffRunPubSubInstance = new PubSub(pubSubClientConfig);
    console.log('[PubSub Lib - DiffRun Route] PubSub instance configured.');
    return diffRunPubSubInstance;
  } catch (error) {
    console.error("[PubSub Lib - DiffRun Route] Failed to initialize PubSub client:", error);
    return null; // Return null if initialization fails
  }
}

const getDiffRunPubSub = () => getDiffRunPubSubInstance();

export async function POST(request: Request) {
  const pubsub = getDiffRunPubSub(); // Get PubSub instance here
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!pubsub) {
    console.error("[API Diff Run] PubSub client not available.");
    return NextResponse.json({ error: "Server configuration error: PubSub not initialized." }, { status: 500 });
  }

  const db = getDb(); // Initialize Firestore client

  try {
    const body: DiffRunRequest = await request.json();
    const { snapshotIdFrom, snapshotIdTo } = body;

    if (!snapshotIdFrom || !snapshotIdTo) {
      return NextResponse.json({ error: 'Missing snapshotIdFrom or snapshotIdTo' }, { status: 400 });
    }

    // Validate snapshots exist and are completed
    const userSnapshotsCol = db.collection('users').doc(userId).collection('snapshots');
    const fromDocRef = userSnapshotsCol.doc(snapshotIdFrom);
    const toDocRef = userSnapshotsCol.doc(snapshotIdTo);

    const [fromDocSnap, toDocSnap] = await Promise.all([
      fromDocRef.get(),
      toDocRef.get()
    ]);

    const fromData = fromDocSnap.data();
    const toData = toDocSnap.data();

    if (!fromDocSnap.exists || fromData?.status !== 'Completed' || 
        !toDocSnap.exists || toData?.status !== 'Completed') {
      console.warn(`[API Diff Run] Validation failed for user ${userId}: from (${snapshotIdFrom}, exists: ${fromDocSnap.exists}, status: ${fromData?.status}), to (${snapshotIdTo}, exists: ${toDocSnap.exists}, status: ${toData?.status})`);
      return NextResponse.json({ error: "Snapshot(s) not found or not completed." }, { status: 404 });
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
    
    await pubsub.topic(TOPIC_NAME_DIFF_RUN).publishMessage({ data: dataBuffer });
    console.log(`[API Diff Run] Message published for job ${diffJobId} to topic ${TOPIC_NAME_DIFF_RUN}.`);

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
        return NextResponse.json({ error: `Pub/Sub topic '${TOPIC_NAME_DIFF_RUN}' not found. Please configure the topic.`, details: errorMessage }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to queue difference analysis.", details: errorMessage }, { status: 500 });
  }
} 