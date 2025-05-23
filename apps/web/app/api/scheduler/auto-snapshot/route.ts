console.log("--- [Scheduler API] Execution STARTED ---");
console.log("[Scheduler API] RAW GCP_SERVICE_ACCOUNT_KEY_JSON type:", typeof env.GCP_SERVICE_ACCOUNT_KEY_JSON);
console.log("[Scheduler API] RAW GCP_SERVICE_ACCOUNT_KEY_JSON is set:", !!env.GCP_SERVICE_ACCOUNT_KEY_JSON);
console.log("[Scheduler API] RAW GCP_PROJECT_ID:", env.GCP_PROJECT_ID);

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { CloudSchedulerClient } from '@google-cloud/scheduler';
// import { db } from '@/lib/firestore'; // Removed as it was unused
import { env } from '@notion-lifeline/config';

// Simplified Initialization & Logging
let schedulerClient: CloudSchedulerClient;
const keyJsonString = env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const projectId = env.GCP_PROJECT_ID;

console.log("[Scheduler API] Initializing. GCP_PROJECT_ID:", projectId);
if (keyJsonString && keyJsonString.length > 100) { // Basic check if string seems like a key
    console.log("[Scheduler API] GCP_SERVICE_ACCOUNT_KEY_JSON IS SET and seems populated (length > 100).");
    try {
        const credentials = JSON.parse(keyJsonString);
        schedulerClient = new CloudSchedulerClient({ credentials, projectId });
        console.log("[Scheduler API] CloudSchedulerClient initialized WITH EXPLICIT credentials.");
    } catch (e: any) {
        console.error("[Scheduler API] FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON. Error:", e.message);
        // Fallback to default for safety, though it will likely fail in Vercel
        console.warn("[Scheduler API] Falling back to CloudSchedulerClient without explicit credentials due to parse error.");
        schedulerClient = new CloudSchedulerClient({ projectId }); 
    }
} else if (process.env.NODE_ENV === 'production') {
    console.error("[Scheduler API] FATAL: GCP_SERVICE_ACCOUNT_KEY_JSON is NOT SET or is too short in production. Client will likely fail.");
    schedulerClient = new CloudSchedulerClient({ projectId }); // Will try default ADC
} else {
    console.warn("[Scheduler API] GCP_SERVICE_ACCOUNT_KEY_JSON not set. Attempting Application Default Credentials (for local dev or GCP-hosted). Client config:", { projectId });
    schedulerClient = new CloudSchedulerClient({ projectId }); // For local dev with gcloud auth login
}

const locationId = process.env.AUTO_SNAPSHOT_SCHEDULER_LOCATION || 'us-central1'; // e.g., us-central1
// The Pub/Sub topic that the snapshot-worker listens to
const pubsubTopicName = process.env.PUBSUB_SNAPSHOT_TOPIC || 'notion-lifeline-snapshot-requests';

interface AutoSnapshotSchedulerBody {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  // userId is derived from auth, not passed in body
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!schedulerClient) {
      console.error("[Scheduler API] POST Request: schedulerClient was not successfully initialized.");
      return NextResponse.json({ error: 'Scheduler client initialization failed. Check server logs.' }, { status: 500 });
  }

  let body: AutoSnapshotSchedulerBody;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { enabled, frequency } = body;

  if (typeof enabled !== 'boolean' || !['daily', 'weekly'].includes(frequency)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  if (!projectId) {
    console.error("GOOGLE_CLOUD_PROJECT env var not set for scheduler.");
    return NextResponse.json({ error: 'Server configuration error for project ID.'}, { status: 500 });
  }
  if (!pubsubTopicName.startsWith('projects/')) {
    console.error("PUBSUB_SNAPSHOT_TOPIC env var must be the full topic path.");
    // It should be `projects/${projectId}/topics/your-topic-name`
    // For now, we construct it if only the name is given, but this should be configured correctly.
  }
  const fullPubsubTopicPath = pubsubTopicName.startsWith('projects/') 
        ? pubsubTopicName 
        : `projects/${projectId}/topics/${pubsubTopicName}`;


  const jobName = `projects/${projectId}/locations/${locationId}/jobs/autoSnapshot-notionLifeline-${userId}`;
  console.log(`[Scheduler API] Managing job: ${jobName} for user ${userId}. Enabled: ${enabled}, Freq: ${frequency}`);

  try {
    if (enabled) {
      let schedule = '0 3 * * *'; // Default: Daily at 3 AM UTC
      if (frequency === 'weekly') {
        schedule = '0 3 * * 1'; // Weekly, Monday at 3 AM UTC
      }
      // TODO: Allow user to customize time/day if desired in UI

      const job = {
        name: jobName,
        description: `Automated Notion snapshot for user ${userId} - ${frequency}`,
        pubsubTarget: {
          topicName: fullPubsubTopicPath,
          data: Buffer.from(JSON.stringify({ userId: userId, source: 'auto-scheduler' })).toString('base64'),
        },
        schedule: schedule,
        timeZone: 'Etc/UTC',
        attemptDeadline: { seconds: 540 }, // Corrected format
      };

      try {
        console.log(`[Scheduler API] Attempting to get existing job: ${jobName}`);
        await schedulerClient.getJob({ name: jobName });
        console.log(`[Scheduler API] Job ${jobName} exists, updating.`);
        await schedulerClient.updateJob({ job });
        return NextResponse.json({ success: true, message: `Auto-snapshot schedule updated to ${frequency}.` });
      } catch (error: any) {
        if (error.code === 5) { // NOT_FOUND
          console.log(`[Scheduler API] Job ${jobName} not found, creating.`);
          await schedulerClient.createJob({ parent: `projects/${projectId}/locations/${locationId}`, job });
          return NextResponse.json({ success: true, message: `Auto-snapshot schedule enabled (${frequency}).` });
        } else {
          console.error(`[Scheduler API] Error getting/creating job ${jobName}:`, error);
          throw error; // Re-throw other errors
        }
      }
    } else { // Disable: Delete the job
      try {
        console.log(`[Scheduler API] Disabling auto-snapshot. Attempting to delete job: ${jobName}`);
        await schedulerClient.deleteJob({ name: jobName });
        console.log(`[Scheduler API] Successfully deleted job ${jobName}.`);
        return NextResponse.json({ success: true, message: 'Auto-snapshot schedule disabled.' });
      } catch (error: any) {
        if (error.code === 5) { // NOT_FOUND - job doesn't exist, which is fine
          console.log(`[Scheduler API] Job ${jobName} not found during delete, already disabled.`);
          return NextResponse.json({ success: true, message: 'Auto-snapshot already disabled.' });
        }
        console.error(`[Scheduler API] Error deleting job ${jobName}:`, error);
        throw error; // Re-throw other errors
      }
    }
  } catch (error: any) {
    console.error(`[Scheduler API] Failed to manage schedule for user ${userId}:`, error);
    return NextResponse.json({ error: error.message || 'Failed to update schedule.' }, { status: 500 });
  }
} 