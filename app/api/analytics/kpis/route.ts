import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/firestore';
import { Timestamp } from '@google-cloud/firestore'; // Import Timestamp for type checking if needed

export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/** GET  /api/analytics/kpis
 *  Returns global aggregated KPIs for the application.
 *
 *  Response shape:
 *    {
 *      snapshotsCreated: number,
 *      storageUsedMB:    number,
 *      lastDiffsRun:     number, // Or totalDiffsRun depending on desired metric
 *      // other global KPIs...
 *    }
 */
export async function GET(_req: NextRequest) {
  console.log('[User KPIs API] Starting request');
  
  try {
    const session = await auth();
    if (!session?.userId) {
      console.log('[User KPIs API] No userId in session, returning 401');
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const db = getDb();
    const userSnapshotsCollectionRef = db.collection('users').doc(session.userId).collection('snapshots');

    // Check if the user's snapshot collection is empty first
    const initialCheck = await userSnapshotsCollectionRef.limit(1).get();
    if (initialCheck.empty) {
      console.log(`[User KPIs API] User ${session.userId} has no snapshots. Returning default KPIs.`);
      return NextResponse.json({ snapshotsTotal: 0, latestSnapshotAt: null });
    }

    // If not empty, proceed to calculate actual totals and latest snapshot
    let snapshotsTotal = 0;
    try {
      const countSnap = await userSnapshotsCollectionRef.count().get();
      snapshotsTotal = countSnap.data().count || 0;
      console.log(`[User KPIs API] Successfully got snapshot count for ${session.userId}: ${snapshotsTotal}`);
    } catch (countErr) {
      console.warn(`[User KPIs API] Count query failed for ${session.userId}, falling back to size():`, countErr);
      const allDocs = await userSnapshotsCollectionRef.get();
      snapshotsTotal = allDocs.size;
      console.log(`[User KPIs API] Fallback size count for ${session.userId}: ${snapshotsTotal}`);
    }

    let latestSnapshotAt: number | null = null;
    try {
      const latestQuery = await userSnapshotsCollectionRef
        .where('status', '==', 'Completed') // Assuming 'Completed' is the status
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (!latestQuery.empty) {
        const docData = latestQuery.docs[0]!.data();
        const timestampData = docData.timestamp;
        if (timestampData instanceof Timestamp) {
            latestSnapshotAt = timestampData.toMillis();
        } else if (timestampData && typeof timestampData === 'object' && timestampData._seconds !== undefined) { // Plain object from some contexts
            latestSnapshotAt = timestampData._seconds * 1000 + (timestampData._nanoseconds / 1000000);
        } else if (typeof timestampData === 'string') { // ISO string
            const date = new Date(timestampData);
            if (!isNaN(date.getTime())) {
                latestSnapshotAt = date.getTime();
            }
        } else if (typeof timestampData === 'number') { // Already epoch ms
            latestSnapshotAt = timestampData;
        } 
        console.log(`[User KPIs API] Latest snapshot for ${session.userId} at: ${latestSnapshotAt}`);
      } else {
        console.log(`[User KPIs API] No 'Completed' snapshots found for ${session.userId} to determine latest time.`);
      }
    } catch (queryErr: any) {
      console.warn(`[User KPIs API] Query for latest snapshot failed for ${session.userId}:`, queryErr.message);
      // In case of error, latestSnapshotAt remains null, which is the desired default
    }

    return NextResponse.json({ snapshotsTotal, latestSnapshotAt });

  } catch (err: any) {
    console.error('[User KPIs API] General error:', {
      name: err.name,
      message: err.message,
      code: err.code,
      details: err.details
    });
    return NextResponse.json(
      { 
        error: 'kpi_fetch_failed', 
        message: 'Internal server error while fetching user KPIs',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      },
      { status: 500 }
    );
  }
} 