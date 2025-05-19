import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { PubSub } from '@google-cloud/pubsub';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from "@/lib/firestore"; // Assuming getDb is correctly set up in your project
import { FieldValue, Timestamp } from '@google-cloud/firestore'; // Import Timestamp for type checking if needed
import { auth } from '@clerk/nextjs/server';
import { env } from '@notion-lifeline/config';

const projectId = env.GCP_PROJECT_ID;
const keyJsonString = env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const TOPIC_NAME_RESTORE = process.env.PUBSUB_RESTORE_TOPIC ?? 'notion-lifeline-restore';

let restorePubSubInstance: PubSub | null = null;

/**
 * Initializes and returns a PubSub client instance for the restore topic.
 * Uses a singleton pattern to reuse the instance.
 * @returns {PubSub} The PubSub client instance.
 * @throws Will throw an error if PubSub client cannot be initialized (e.g., invalid credentials).
 */
function getRestorePubSubInstance(): PubSub {
  if (restorePubSubInstance) {
    return restorePubSubInstance;
  }
  let pubSubClientConfig: any = {
    ...(projectId && { projectId }),
  };
  if (keyJsonString) {
    try {
      console.log('[PubSub Lib - LatestGoodRestore] Attempting to use credentials from GCP_SERVICE_ACCOUNT_KEY_JSON.');
      const credentials = JSON.parse(keyJsonString);
      pubSubClientConfig = { ...pubSubClientConfig, credentials };
    } catch (e) {
      console.error("[PubSub Lib - LatestGoodRestore] FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON.", e);
      // This is a server configuration error, so rethrow
      throw new Error("Invalid GCP Service Account Key JSON provided for PubSub (LatestGoodRestore).");
    }
  } else {
    // Log warning if no explicit credentials in production, rely on ADC
    if (process.env.NODE_ENV === 'production') {
        console.warn('[PubSub Lib - LatestGoodRestore] GCP_SERVICE_ACCOUNT_KEY_JSON is NOT SET. PubSub client will initialize without explicit credentials.');
    } else {
        console.warn('[PubSub Lib - LatestGoodRestore] GCP_SERVICE_ACCOUNT_KEY_JSON not set in dev. Attempting Application Default Credentials.');
    }
  }
  console.log(`[PubSub Lib - LatestGoodRestore] Initializing PubSub instance for topic ${TOPIC_NAME_RESTORE}.`);
  restorePubSubInstance = new PubSub(pubSubClientConfig);
  return restorePubSubInstance;
}

/**
 * POST /api/restore/latest-good
 * 
 * Initiates a restore process for the authenticated user's most recent successfully completed snapshot.
 * This endpoint is designed for "panic button" scenarios where the user wants to quickly revert
 * to the last known good state without selecting a specific snapshot.
 * 
 * The restore is performed to a default target location (e.g., a new top-level page in Notion),
 * as configured in the restore-worker environment (DEFAULT_RESTORE_PARENT_PAGE_ID).
 * 
 * Process:
 * 1. Authenticates the user via Clerk.
 * 2. Queries Firestore for the user's snapshots, filtering by status='Completed' and ordering by 'createdAt' descending.
 * 3. Takes the first result (the latest completed snapshot).
 * 4. If no such snapshot is found, returns a 404 error.
 * 5. Generates a new restore job ID (UUID).
 * 6. Creates an initial record for this restore job in Firestore (e.g., users/{userId}/restores/{restoreId}).
 * 7. Publishes a message to the designated Pub/Sub topic (e.g., 'notion-lifeline-restore') with the
 *    restoreId, userId, and the found snapshotId. `targets` and `targetParentPageId` are set to null,
 *    relying on the worker's default behavior.
 * 8. Returns a success response with the restoreId and snapshotId.
 */
export async function POST(request: Request) {
  const db = getDb();
  const pubsub = getRestorePubSubInstance();
  const authResult = await getAuth(request as any); // Cast to any if NextRequest type causes issues with getAuth
  const userId = authResult?.userId;

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log(`[API RestoreLatestGood] User ${userId} initiated restore latest good snapshot.`);
    const snapshotsRef = db.collection('users').doc(userId).collection('snapshots');
    const latestGoodSnapshotQuery = snapshotsRef
      .where('status', '==', 'Completed') // Assumption: status field with value 'Completed'
      .orderBy('createdAt', 'desc')       // Assumption: createdAt field for ordering
      .limit(1);

    const snapshotDocs = await latestGoodSnapshotQuery.get();

    if (snapshotDocs.empty) {
      console.log(`[API RestoreLatestGood] No completed snapshots found for user ${userId}.`);
      return NextResponse.json({ success: false, message: 'No completed snapshots found to restore.' }, { status: 404 });
    }

    const latestGoodSnapshot = snapshotDocs.docs[0];
    const snapshotId = latestGoodSnapshot.id;
    const snapshotData = latestGoodSnapshot.data(); // Contains original snapshot details if needed

    console.log(`[API RestoreLatestGood] Found latest good snapshot: ${snapshotId} for user ${userId}. Data:`, snapshotData);

    const restoreId = uuidv4();
    const restoreDocRef = db.collection('users').doc(userId).collection('restores').doc(restoreId);

    try {
      await restoreDocRef.set({
        originalSnapshotId: snapshotId, // Store reference to the original snapshot
        snapshotDetails: { // Optionally store some denormalized data from the snapshot
            createdAt: snapshotData.createdAt || null, // Assuming createdAt exists
            // Add other relevant fields from snapshotData if useful for display/tracking
        },
        requestedAt: FieldValue.serverTimestamp(),
        status: 'initiated', // Initial status for the new restore job
        type: 'latest-good', // Indicate the type of restore request
        targetParentPageId: null, // Worker will use its default
      });
      console.log(`[API RestoreLatestGood] Initial restore document ${restoreId} created for user: ${userId}.`);
    } catch (dbError) {
      console.error(`[API RestoreLatestGood] Failed to create initial restore document for ${restoreId}:`, dbError);
      // Continue to queue the job, but frontend might not find the tracking doc immediately.
    }

    const jobPayload = {
      restoreId,
      userId,
      snapshotId, // The ID of the snapshot to be restored
      targets: null, // For default restore, no specific targets
      targetParentPageId: null, // Worker will use DEFAULT_RESTORE_PARENT_PAGE_ID
      requestedAt: Date.now(), // ms timestamp
      restoreType: 'latest-good' // Add type for worker if it needs to differentiate
    };

    const dataBuffer = Buffer.from(JSON.stringify(jobPayload));
    const messageId = await pubsub.topic(TOPIC_NAME_RESTORE).publishMessage({ data: dataBuffer });
    
    console.log(`[API RestoreLatestGood] Restore request ${messageId} (Job ID: ${restoreId}) published for user: ${userId}.`);

    // M6.1 style Audit Log
    try {
      await db.collection('users').doc(userId).collection('audit').add({
        timestamp: FieldValue.serverTimestamp(),
        type: 'restore_latest_good_initiated',
        details: {
          restoreId: restoreId,
          triggeredSnapshotId: snapshotId,
          status: 'pending'
        },
      });
    } catch (auditError) {
      console.error(`[API RestoreLatestGood] Failed to write audit log for ${restoreId}:`, auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Restore of latest good snapshot has been initiated.',
      snapshotId: snapshotId,
      restoreJobId: restoreId
    }, { status: 202 }); // 202 Accepted

  } catch (error: any) {
    console.error(`[API RestoreLatestGood] Error for user ${userId}:`, error);
    return NextResponse.json({ success: false, message: error.message || 'An unexpected error occurred.' }, { status: 500 });
  }
} 