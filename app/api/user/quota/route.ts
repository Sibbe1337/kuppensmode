import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/firestore'; // This alias should also work now
// import { Firestore } from '@google-cloud/firestore'; // Removed direct import
// import { storage } from '@/lib/gcs'; // TODO: Import GCS utility if needed for usage calculation
import { DEFAULT_USER_QUOTA } from '@/config/defaults'; // Use correct alias

// Define the structure of the quota data locally to avoid unresolved import errors.
export interface UserQuota {
  planName: string;
  planId: string;
  snapshotsUsed: number;
  snapshotsLimit: number;
  // storageUsedMB?: number;  // Future enhancement
  // storageLimitMB?: number; // Future enhancement
}
//   planName: string;
//   planId: string;
//   snapshotsUsed: number;
//   snapshotsLimit: number;
//   // storageUsedMB: number; // Future
//   // storageLimitMB: number; // Future
// }

// Simple plan details - replace with more robust logic or DB lookup if needed
// const PLAN_DETAILS = { // Original PLAN_DETAILS, for reference if UserQuota structure needs to be richer
//   free: { name: "Free Tier", snapshotsLimit: 5, storageLimitMB: 100 },
//   paid: { name: "Pro Plan", snapshotsLimit: 50, storageLimitMB: 1000 }, // Example paid plan
// };

// Adopting the simpler DEFAULT_QUOTA structure from your patch example
// const DEFAULT_USER_QUOTA_DATA: UserQuota = { ... };

export async function GET(request: Request) {
  const authResult = await auth();
  const userId = authResult.userId;

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    console.log(`Fetching quota for user: ${userId}`);
  console.log("--- ENV VAR CHECK IN /api/user/quota/route.ts ---"); // Keep for now
  console.log("GOOGLE_CLOUD_PROJECT:", process.env.GOOGLE_CLOUD_PROJECT); // Keep for now
  console.log("GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS); // Keep for now
  console.log("---------------------------------------------------"); // Keep for now

    const userDocRef = db.collection('users').doc(userId);

  try {
    const snap = await userDocRef.get();

    if (!snap.exists) {
      console.log(`User document ${userId} not found. Initializing with default quota.`);
      await userDocRef.set(
        { quota: DEFAULT_USER_QUOTA, createdAt: Date.now() }, // Use imported DEFAULT_USER_QUOTA
        { merge: true }
      );
      return NextResponse.json(DEFAULT_USER_QUOTA);
    }
    
    const data = snap.data();
    if (!data || !data.quota) {
      console.warn(`User document data or quota field for ${userId} is missing. Initializing quota.`);
      await userDocRef.set(
        { quota: DEFAULT_USER_QUOTA, createdAt: data?.createdAt ?? Date.now() },
        { merge: true }
      );
      return NextResponse.json(DEFAULT_USER_QUOTA);
    }

    return NextResponse.json(data.quota as UserQuota); // Cast to UserQuota

  } catch (error) {
    console.error(`GET /api/user/quota error for user ${userId}:`, error);
    if (error instanceof Error && 'code' in error && (error as any).code === 5) {
        console.warn(`Firestore NOT_FOUND (code 5) for ${userId} during .get() in quota. Fallback set attempt...`);
        try {
            await userDocRef.set(
                { quota: DEFAULT_USER_QUOTA, createdAt: Date.now() },
                { merge: true }
            );
            console.log(`Fallback set successful for ${userId}.`);
            return NextResponse.json(DEFAULT_USER_QUOTA, { status: 200 });
        } catch (initErrorInCatch) {
            console.error(`Failed to initialize user ${userId} after NOT_FOUND:`, initErrorInCatch);
            return new NextResponse("Internal Server Error - Fallback init failed", { status: 500 });
        }
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 