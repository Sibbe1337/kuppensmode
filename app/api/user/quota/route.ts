import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/firestore'; // Reverted to shared db instance
// import { Firestore } from '@google-cloud/firestore'; // Removed direct import
// import { storage } from '@/lib/gcs'; // TODO: Import GCS utility if needed for usage calculation

// Define the structure of the quota data
interface UserQuota {
  planName: string;
  planId: string;
  snapshotsUsed: number;
  snapshotsLimit: number;
  // storageUsedMB: number; // Future
  // storageLimitMB: number; // Future
}

// Simple plan details - replace with more robust logic or DB lookup if needed
// const PLAN_DETAILS = { // Original PLAN_DETAILS, for reference if UserQuota structure needs to be richer
//   free: { name: "Free Tier", snapshotsLimit: 5, storageLimitMB: 100 },
//   paid: { name: "Pro Plan", snapshotsLimit: 50, storageLimitMB: 1000 }, // Example paid plan
// };

// Adopting the simpler DEFAULT_QUOTA structure from your patch example
const DEFAULT_USER_QUOTA_DATA: UserQuota = { // Renamed to avoid conflict if UserQuota interface is kept richer
  planName: "Free Tier", // Added to match original UserQuota structure
  planId: 'free',        // Added to match original UserQuota structure
  snapshotsUsed: 0,
  snapshotsLimit: 5, // Matching the original free tier limit
};

export async function GET(request: Request) {
  // Log environment variables at the very beginning of the handler
  console.log("--- ENV VAR CHECK IN /api/user/quota/route.ts ---");
  console.log("GOOGLE_CLOUD_PROJECT:", process.env.GOOGLE_CLOUD_PROJECT);
  console.log("GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
  console.log("---------------------------------------------------");

  const authResult = await auth();
  const userId = authResult.userId;

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  console.log(`Fetching quota for user: ${userId}`); // Cleaned up log message
  const userDocRef = db.collection('users').doc(userId); // Using shared db instance

  try {
    const snap = await userDocRef.get();

    if (!snap.exists) {
      console.log(`User document ${userId} not found. Initializing with default quota.`);
      await userDocRef.set(
        { quota: DEFAULT_USER_QUOTA_DATA, createdAt: Date.now() },
        { merge: true }
      );
      return NextResponse.json(DEFAULT_USER_QUOTA_DATA);
    }

    const data = snap.data();
    if (!data || !data.quota) {
      console.warn(`User document data or quota field for ${userId} is missing. Initializing quota.`);
      await userDocRef.set(
        { quota: DEFAULT_USER_QUOTA_DATA, createdAt: data?.createdAt ?? Date.now() },
        { merge: true }
      );
      return NextResponse.json(DEFAULT_USER_QUOTA_DATA);
    }
    
    return NextResponse.json(data.quota);

  } catch (error) {
    console.error(`GET /api/user/quota error for user ${userId}:`, error);
    if (error instanceof Error && 'code' in error && (error as any).code === 5) {
        console.warn(`Firestore NOT_FOUND (code 5) for ${userId} during .get() in quota. Fallback set attempt...`);
        try {
            await userDocRef.set(
                { quota: DEFAULT_USER_QUOTA_DATA, createdAt: Date.now() },
                { merge: true }
            );
            console.log(`Fallback set successful for ${userId}.`);
            return NextResponse.json(DEFAULT_USER_QUOTA_DATA, { status: 200 });
        } catch (initErrorInCatch) {
            console.error(`Failed to initialize user ${userId} after NOT_FOUND:`, initErrorInCatch);
            return new NextResponse("Internal Server Error - Fallback init failed", { status: 500 });
        }
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 