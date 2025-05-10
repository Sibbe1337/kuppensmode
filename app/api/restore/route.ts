import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PubSub } from '@google-cloud/pubsub';
import { v4 as uuid } from 'uuid';
import { db } from '@/lib/firestore';
import { FieldValue } from '@google-cloud/firestore';

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
    const messageId = await pubsub.topic(TOPIC).publishMessage({ data: dataBuffer });
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

    // Immediate ACK to client
    return NextResponse.json({ success: true, restoreId });
  } catch (err) {
    console.error('Failed to enqueue restore job', err);
    return new NextResponse('Failed to queue job', { status: 500 });
  }
} 