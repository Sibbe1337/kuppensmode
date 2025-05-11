import { NextResponse, NextRequest } from 'next/server';
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
export async function GET(_req: NextRequest) {
  console.log('[KPIs API] Starting request');
  
  try {
    const session = await auth();
    console.log('[KPIs API] Auth session:', { 
      hasUserId: !!session?.userId,
      userId: session?.userId 
    });
    
    if (!session?.userId) {
      console.log('[KPIs API] No userId in session, returning 401');
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    const db = getDb();
    console.log('[KPIs API] Firestore instance obtained');
    
    // 1️⃣ total count ------------------------------------
    console.log('[KPIs API] Attempting to get snapshot count for user:', session.userId);
    const snapCol = db.collection('users').doc(session.userId).collection('snapshots');
    
    // Fallback to size() if count() fails
    let snapshotsTotal = 0;
    try {
      const countSnap = await snapCol.count().get();
      snapshotsTotal = countSnap.data().count || 0;
      console.log('[KPIs API] Successfully got snapshot count:', snapshotsTotal);
    } catch (countErr) {
      console.warn('[KPIs API] Count query failed, falling back to size():', countErr);
      const allDocs = await snapCol.get();
      snapshotsTotal = allDocs.size;
      console.log('[KPIs API] Fallback size count:', snapshotsTotal);
    }

    // 2️⃣ timestamp of most-recent snapshot ---------------
    console.log('[KPIs API] Attempting to get latest snapshot for user:', session.userId);
    let latestSnapshotAt: number | null = null;
    
    try {
      const latestQuery = await snapCol
        .where('status', '==', 'Completed')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
      console.log('[KPIs API] Latest snapshot query completed, empty:', latestQuery.empty);

      if (!latestQuery.empty) {
        const timestampData = latestQuery.docs[0]!.data().timestamp;
        console.log('[KPIs API] Raw timestamp data:', timestampData);
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
    } catch (queryErr: any) {
      console.warn('[KPIs API] Latest snapshot query failed, falling back to simple query:', queryErr);
      // Fallback: Get all completed snapshots and sort in memory
      const allCompleted = await snapCol
        .where('status', '==', 'Completed')
        .get();
      
      if (!allCompleted.empty) {
        const snapshots = allCompleted.docs
          .map(doc => ({ timestamp: doc.data().timestamp }))
          .filter(snap => snap.timestamp) // Filter out any without timestamp
          .sort((a, b) => {
            const timeA = a.timestamp?.toMillis?.() ?? a.timestamp?._seconds * 1000 ?? 0;
            const timeB = b.timestamp?.toMillis?.() ?? b.timestamp?._seconds * 1000 ?? 0;
            return timeB - timeA; // Descending order
          });
        
        if (snapshots.length > 0) {
          const latest = snapshots[0].timestamp;
          if (latest?.toMillis) {
            latestSnapshotAt = latest.toMillis();
          } else if (latest?._seconds) {
            latestSnapshotAt = latest._seconds * 1000 + (latest._nanoseconds / 1000000);
          }
        }
      }
    }

    return NextResponse.json({ snapshotsTotal, latestSnapshotAt });
  } catch (err: any) {
    console.error('[KPIs API] Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      details: err.details
    });
    
    // More specific error messages based on common issues
    let errorMessage = 'Internal server error';
    if (err.code === 'permission-denied') {
      errorMessage = 'Firestore permission denied - check service account permissions';
    } else if (err.code === 'unauthenticated') {
      errorMessage = 'Firestore authentication failed - check service account key';
    } else if (err.message?.includes('JSON')) {
      errorMessage = 'Invalid service account key format';
    }

    return NextResponse.json(
      { 
        error: 'kpi_failed', 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      },
      { status: 500 }
    );
  }
} 