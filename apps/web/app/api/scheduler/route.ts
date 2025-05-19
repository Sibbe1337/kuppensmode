import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PubSub } from '@google-cloud/pubsub';

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const keyJsonString = process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const TOPIC_NAME = process.env.PUBSUB_SCHEDULE_SNAPSHOT_TOPIC || 'scheduleSnapshot';

let pubSubInstance: PubSub | null = null;

function getPubSubInstance(): PubSub {
  if (pubSubInstance) {
    return pubSubInstance;
  }
  let pubSubClientConfig: any = {
    ...(projectId && { projectId }),
  };
  if (keyJsonString) {
    try {
      console.log('[PubSub Lib - Scheduler Route] Attempting to use credentials from GCP_SERVICE_ACCOUNT_KEY_JSON.');
      const credentials = JSON.parse(keyJsonString);
      pubSubClientConfig = { ...pubSubClientConfig, credentials };
    } catch (e) {
      console.error("[PubSub Lib - Scheduler Route] FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON.", e);
      throw new Error("Invalid GCP Service Account Key JSON provided for PubSub.");
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
        console.warn('[PubSub Lib - Scheduler Route] GCP_SERVICE_ACCOUNT_KEY_JSON is NOT SET. PubSub client will initialize without explicit credentials. Operations may fail if ADC not available/configured at runtime.');
    } else {
        console.warn('[PubSub Lib - Scheduler Route] GCP_SERVICE_ACCOUNT_KEY_JSON not set in dev. Attempting Application Default Credentials.');
    }
  }
  console.log(`[PubSub Lib - Scheduler Route] Initializing PubSub instance. ProjectId: ${pubSubClientConfig.projectId || 'Default'}. Auth method: ${pubSubClientConfig.credentials ? 'JSON Key Var' : 'Default/ADC'}`);
  pubSubInstance = new PubSub(pubSubClientConfig);
  console.log('[PubSub Lib - Scheduler Route] PubSub instance configured.');
  return pubSubInstance;
}

const getPubSub = () => getPubSubInstance();

interface ScheduleRequestBody {
  cron: string; // e.g., "0 2 * * *"
  // action?: 'create' | 'update' | 'delete'; // For future enhancements like managing specific jobs
  // scheduleId?: string; // For future enhancements
}

export async function POST(request: Request) {
  const pubsub = getPubSub(); // Get instance here
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let body: ScheduleRequestBody;
  try {
    body = await request.json();
  } catch (e) {
    return new NextResponse(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { cron } = body;

  if (!cron) { // Basic validation for cron string
    return new NextResponse(JSON.stringify({ error: "Missing cron expression" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  console.log(`[Scheduler API] User: ${userId} requested to schedule snapshots with cron: ${cron}`);

  const jobPayload = {
    userId,
    cronString: cron,
    // In a more advanced setup, this might also include a unique scheduleId for management
  };

  try {
    const dataBuffer = Buffer.from(JSON.stringify(jobPayload));
    const messageId = await pubsub.topic(TOPIC_NAME).publishMessage({ data: dataBuffer });
    console.log(`[Scheduler API] Schedule request ${messageId} published for user: ${userId} with cron: ${cron}.`);

    // The actual creation/update of the Google Cloud Scheduler job
    // will be handled by a worker subscribing to the 'scheduleSnapshot' topic.
    return NextResponse.json({ success: true, message: "Schedule request received.", messageId });

  } catch (err: any) {
    console.error('[Scheduler API] Failed to publish schedule request to Pub/Sub', err);
    // Check for common Pub/Sub errors like topic not found
    if (err.message && err.message.includes('Topic not found')) {
        return new NextResponse(JSON.stringify({ error: `Pub/Sub topic ${TOPIC_NAME} not found. Please ensure it is created.` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    return new NextResponse(JSON.stringify({ error: 'Failed to queue schedule request' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
} 