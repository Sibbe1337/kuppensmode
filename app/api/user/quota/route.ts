import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/firestore';

// Note: The S3StorageAdapter class and its direct StorageAdapter import have been removed from this file.
// It's assumed that the primary S3StorageAdapter lives in src/storage/S3StorageAdapter.ts
// and this API route does not directly instantiate it for quota logic.
// If direct S3 operations were needed here, it should import the adapter from src/storage.

const db = getDb();

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      // If user doc doesn't exist, they might be new or an issue occurred.
      // Return default free tier quota or an appropriate error/status.
      console.warn(`[API /api/user/quota] User document not found for userId: ${userId}. Returning default/free tier quota.`);
      return NextResponse.json({
        userId,
        planName: 'Free Tier',
        currentSnapshots: 0,
        maxSnapshots: 5, // Example default free tier limit
        // Add other relevant default quota fields
      }, { status: 200 }); 
    }

    const userData = userDocSnap.data();
    const planName = userData?.planName || 'Free Tier'; 
    
    const snapshotsCollectionRef = db.collection('users').doc(userId).collection('snapshots');
    // Get count of non-failed snapshots, or all if status isn't tracked granularly here for quota
    const snapshotsQuerySnap = await snapshotsCollectionRef.where('status', '==', 'success').count().get();
    const currentSnapshots = snapshotsQuerySnap.data().count;

    // Define plan limits (these would ideally come from a config, DB, or Stripe plan metadata)
    const planLimits: Record<string, { snapshots: number; storageGB?: number /* etc. */ }> = {
      'Free Tier': { snapshots: 5 },
      'Pro': { snapshots: 100 },
      'Teams': { snapshots: 1000 },
    };

    const maxSnapshots = planLimits[planName]?.snapshots || 5;

    const quotaInfo = {
      userId,
      planName,
      currentSnapshots,
      maxSnapshots,
      // TODO: Add other quota details like storage used, features enabled, etc.
    };

    return NextResponse.json(quotaInfo, { status: 200 });

  } catch (error: any) {
    console.error(`[API /api/user/quota] Error fetching quota for user ${userId}:`, error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}