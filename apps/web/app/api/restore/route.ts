import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { PubSub } from '@google-cloud/pubsub';
import { v4 as uuid } from 'uuid';
import { getDb } from "@/lib/firestore";
import { FieldValue } from '@google-cloud/firestore';
import { auth } from '@clerk/nextjs/server';
import { env } from '@notion-lifeline/config';

const projectId = env.GCP_PROJECT_ID;
const keyJsonString = env.GCP_SERVICE_ACCOUNT_KEY_JSON;
const TOPIC_NAME_RESTORE = process.env.PUBSUB_RESTORE_TOPIC ?? 'notion-lifeline-restore'; // Renamed TOPIC to avoid conflict if other PubSub topics are used

let restorePubSubInstance: PubSub | null = null;

function getRestorePubSubInstance(): PubSub {
  if (restorePubSubInstance) {
    return restorePubSubInstance;
  }
  let pubSubClientConfig: any = {
    ...(projectId && { projectId }),
  };
  if (keyJsonString) {
    try {
      console.log('[PubSub Lib - Restore Route] Attempting to use credentials from GCP_SERVICE_ACCOUNT_KEY_JSON.');
      const credentials = JSON.parse(keyJsonString);
      pubSubClientConfig = { ...pubSubClientConfig, credentials };
    } catch (e) {
      console.error("[PubSub Lib - Restore Route] FATAL: Failed to parse GCP_SERVICE_ACCOUNT_KEY_JSON.", e);
      throw new Error("Invalid GCP Service Account Key JSON provided for PubSub (Restore Route).");
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
        console.warn('[PubSub Lib - Restore Route] GCP_SERVICE_ACCOUNT_KEY_JSON is NOT SET. PubSub client will initialize without explicit credentials. Operations may fail if ADC not available/configured at runtime.');
    } else {
        console.warn('[PubSub Lib - Restore Route] GCP_SERVICE_ACCOUNT_KEY_JSON not set in dev. Attempting Application Default Credentials.');
    }
  }
  console.log(`[PubSub Lib - Restore Route] Initializing PubSub instance for topic ${TOPIC_NAME_RESTORE}. ProjectId: ${pubSubClientConfig.projectId || 'Default'}. Auth method: ${pubSubClientConfig.credentials ? 'JSON Key Var' : 'Default/ADC'}`);
  restorePubSubInstance = new PubSub(pubSubClientConfig);
  console.log('[PubSub Lib - Restore Route] PubSub instance configured.');
  return restorePubSubInstance;
}

const getRestorePubSub = () => getRestorePubSubInstance();

// This forces the route to be dynamic if needed, but POST routes often are by default
// export const dynamic = 'force-dynamic'; 

interface RestoreRequestBody {
  snapshotId: string;
  targets?: string[]; // Optional: specific databases/pages to restore
  targetParentPageId?: string; // Optional: ID of the page to restore content into
}

export async function GET(request: Request) {
  const db = getDb(); // Get instance here
  const { userId } = getAuth(request as any);
  // ... GET handler logic ...
}

export async function POST(request: Request) {
  const db = getDb(); // Get instance here
  const pubsub = getRestorePubSub(); // Get PubSub instance here
  const { userId } = getAuth(request as any);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let body: RestoreRequestBody;
  try {
    body = await request.json();
  } catch (e) {
    return new NextResponse("Invalid JSON body", { status: 400 });
  }

  const { snapshotId, targets, targetParentPageId } = body;

  if (!snapshotId) {
    return new NextResponse("Missing snapshotId", { status: 400 });
  }

  // --- Check if first restore --- 
  let isFirstRestore = false;
  const userDocRef = db.collection('users').doc(userId);
  try {
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      const activationData = userDoc.data()?.activation;
      if (!activationData || !activationData.initiatedFirstRestore) {
        isFirstRestore = true;
      }
    } else {
      // User doc doesn't exist, implies not activated yet
      isFirstRestore = true; 
    }
  } catch (err) {
    console.warn(`[Restore] Error checking user doc for activation status for ${userId}:`, err);
    isFirstRestore = true; // Proceed assuming first restore if check fails
  }
  // --- End Check ---

  const restoreId = uuid();

  // Create an initial Firestore document for this restore job
  const restoreDocRef = db.collection('users').doc(userId).collection('restores').doc(restoreId);
  try {
    await restoreDocRef.set({
      snapshotId: snapshotId,
      requestedAt: FieldValue.serverTimestamp(),
      status: 'initiated',
      targetParentPageId: targetParentPageId ?? null,
      // restoreRootPageId and restoreUrl will be populated by the worker upon successful completion
    });
    console.log(`Initial restore document ${restoreId} created for user: ${userId}`);
  } catch (dbError) {
    console.error(`Failed to create initial restore document for ${restoreId}:`, dbError);
    // Decide if this should be a fatal error. For now, log and continue to queue the job.
    // If the frontend relies on this doc existing, this might need to be rethought.
  }

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

  try {
    const dataBuffer = Buffer.from(JSON.stringify(job));
    const messageId = await pubsub.topic(TOPIC_NAME_RESTORE).publishMessage({ data: dataBuffer });
    console.log(`Restore request ${messageId} published for user: ${userId}.`);

    // --- Update activation status if it was the first --- 
    if (isFirstRestore) {
      try {
        await userDocRef.set({ 
          activation: { initiatedFirstRestore: true }
        }, { merge: true });
        console.log(`[Restore] Marked initiatedFirstRestore for user ${userId}`);
      } catch (updateError) {
         console.error(`[Restore] Failed to mark initiatedFirstRestore for user ${userId}:`, updateError);
      }
    }
    // --- End Update ---

    // M6.1 (Adapted for Restore): Add audit log for restore initiation
    try {
      const auditLogInitiated = {
        timestamp: FieldValue.serverTimestamp(),
        type: 'restore_initiated',
        details: {
          restoreId: restoreId,
          snapshotId: snapshotId,
          targetParentPageId: targetParentPageId ?? null,
          status: 'pending' // Initial status of the audit log for this event
        },
      };
      await db.collection('users').doc(userId).collection('audit').add(auditLogInitiated);
      console.log(`[Restore API] Audit log created for initiated restore ${restoreId}.`);
    } catch (auditError) {
      console.error(`[Restore API] Failed to write audit log for initiated restore ${restoreId}:`, auditError);
      // Non-fatal for the restore initiation itself
    }

    // Immediate ACK to client
    return NextResponse.json({ success: true, restoreId });
  } catch (err) {
    console.error('Failed to enqueue restore job', err);
    return new NextResponse('Failed to queue job', { status: 500 });
  }
} 