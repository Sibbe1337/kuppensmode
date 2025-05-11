import { NextResponse } from 'next/server';
import { auth }         from '@clerk/nextjs/server';
// import { Firestore }    from '@google-cloud/firestore'; // We'll use our lazy loader
import { getDb } from '@/lib/firestore'; // Using our lazy loader

export const dynamic = "force-dynamic"; // Added
export const runtime = 'nodejs';          // ❗ we need full Node for Firestore

// -- initialise Firestore once per cold-start -- // This global const db is removed, getDb() is used inside handler
// const db = new Firestore(); 

/** GET  /api/analytics/kpis
 *  Returns a handful of high-level numbers for the dashboard.
 *
 *  Response shape:
 *    {
 *      snapshotsTotal:   number,
 *      latestSnapshotAt: number | null   // epoch ms, or Firestore Timestamp
 *    }
 */
export async function GET() {
  const db = getDb(); // Get instance here
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error : 'unauthorised' }, { status : 401 });
  }

  try {
    // 1️⃣ total count ------------------------------------
    const snapCol   = db.collection('users').doc(userId).collection('snapshots');
    const countSnap = await snapCol.count().get();
    const snapshotsTotal = countSnap.data().count || 0;

    // 2️⃣ timestamp of most-recent snapshot ---------------
    const latestQuery = await snapCol
      .where('status', '==', 'Completed')
      .orderBy('timestamp', 'desc') // Ensure this field exists and is a Timestamp for ordering
      .limit(1)
      .get();

    let latestSnapshotAt: number | null = null;
    if (!latestQuery.empty) {
        const timestampData = latestQuery.docs[0]!.data().timestamp;
        // Firestore Timestamps might be objects { _seconds: ..., _nanoseconds: ... } or actual Timestamp instances
        // Convert to epoch milliseconds for consistent client-side handling
        if (timestampData && typeof timestampData.toMillis === 'function') { // Firestore Admin SDK Timestamp
            latestSnapshotAt = timestampData.toMillis();
        } else if (timestampData && typeof timestampData === 'object' && timestampData._seconds !== undefined) { // Plain object from some contexts
            latestSnapshotAt = timestampData._seconds * 1000 + (timestampData._nanoseconds / 1000000);
        } else if (typeof timestampData === 'string') { // ISO string, convert
            latestSnapshotAt = new Date(timestampData).getTime();
        } else if (typeof timestampData === 'number') { // Already epoch ms
            latestSnapshotAt = timestampData;
        } 
    }

    return NextResponse.json({ snapshotsTotal, latestSnapshotAt });
  } catch (err: any) {
    console.error('[KPIs API] failed:', err); // Added API to log for clarity
    return NextResponse.json(
      { error : 'kpi_failed', message : err?.message }, // Use your suggested error shape
      { status : 500 },
    );
  }
} 