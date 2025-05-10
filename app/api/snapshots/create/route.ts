import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server'; 
import { PubSub } from '@google-cloud/pubsub';
import { db } from '@/lib/firestore';
import { FieldValue } from '@google-cloud/firestore';
import { DEFAULT_USER_QUOTA } from '@/config/defaults';
import type { UserQuota } from '@/types/user'; // Corrected import for UserQuota type

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

    // --- BEGIN QUOTA CHECK & UPDATE --- 
    const userDocRef = db.collection('users').doc(userId);
    let currentQuota: UserQuota;
    let userDocSnap;

    try {
      userDocSnap = await userDocRef.get();
      if (userDocSnap.exists && userDocSnap.data()?.quota) {
        currentQuota = userDocSnap.data()?.quota as UserQuota;
      } else {
        console.log(`User ${userId} has no quota, initializing with default.`);
        currentQuota = DEFAULT_USER_QUOTA;
        // Initialize quota if user or quota field doesn't exist
        await userDocRef.set({ quota: DEFAULT_USER_QUOTA, createdAt: FieldValue.serverTimestamp() }, { merge: true }); 
      }
    } catch (quotaError) {
      console.error(`[Snapshot Create] Error fetching/initializing quota for user ${userId}:`, quotaError);
      return new NextResponse("Error verifying user quota.", { status: 500 });
    }

    if (currentQuota.snapshotsUsed >= currentQuota.snapshotsLimit) {
      console.log(`User ${userId} over snapshot limit: ${currentQuota.snapshotsUsed}/${currentQuota.snapshotsLimit}`);
      // M-4: Over-limit - return an error that frontend can use to show banner/redirect
      return new NextResponse(JSON.stringify({
        error: "Snapshot limit reached. Please upgrade your plan.",
        errorCode: "SNAPSHOT_LIMIT_REACHED"
      }), { status: 403, headers: { 'Content-Type': 'application/json' } }); // 403 Forbidden or 429 Too Many Requests
    }
    // --- END QUOTA CHECK --- 

    // --- Check if first backup --- 
    let isFirstBackup = false;
    try {
      const userDoc = await userDocRef.get();
      if (userDoc.exists) {
        const activationData = userDoc.data()?.activation;
        if (!activationData || !activationData.createdFirstBackup) {
          isFirstBackup = true;
        }
      } else {
        // User doc doesn't exist, this will definitely be the first backup
        isFirstBackup = true; 
      }
    } catch (err) {
      console.warn(`[Snapshot Create] Error checking user doc for activation status for ${userId}:`, err);
      // Proceed assuming it might be the first backup if check fails
      isFirstBackup = true; 
    }
    // --- End Check ---

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

        // --- Increment snapshotsUsed in quota AFTER successful publish --- 
        try {
            await userDocRef.update({ 'quota.snapshotsUsed': FieldValue.increment(1) });
            console.log(`[Snapshot Create] Incremented snapshotsUsed for user ${userId}`);
        } catch (incrementError) {
            console.error(`[Snapshot Create] Failed to increment snapshotsUsed for user ${userId}:`, incrementError);
            // This is a tricky state: job is queued but quota might not reflect it.
            // For MVP, log and continue. More robust system might try to compensate or alert.
        }
        // --- End Increment ---

        // --- Update activation status if it was the first --- 
        if (isFirstBackup) {
          try {
            await userDocRef.set({ 
              activation: { createdFirstBackup: true }
            }, { merge: true });
            console.log(`[Snapshot Create] Marked createdFirstBackup for user ${userId}`);
          } catch (updateError) {
             console.error(`[Snapshot Create] Failed to mark createdFirstBackup for user ${userId}:`, updateError);
             // Don't fail the main request for this secondary update
          }
        }
        // --- End Update ---

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