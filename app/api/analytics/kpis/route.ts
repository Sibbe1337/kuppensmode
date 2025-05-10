import { NextResponse } from 'next/server';
import { auth }         from '@clerk/nextjs/server';
import { Firestore }    from '@google-cloud/firestore';

export const runtime = 'nodejs';          // ❗ we need full Node for Firestore

// -- initialise Firestore once per cold-start ------------------------------
const db = new Firestore();

/** GET  /api/analytics/kpis
 *  Returns a handful of high-level numbers for the dashboard.
 *
 *  Response shape:
 *    {
 *      snapshotsTotal:   number,
 *      latestSnapshotAt: number | null   // epoch ms
 *    }
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error : 'unauthorised' }, { status : 401 });
  }

  try {
    // 1️⃣ total count ------------------------------------
    const snapCol   = db.collection('users').doc(userId).collection('snapshots');
    //   Firestore's count() aggregation – *much* cheaper than loading docs
    //   (requires Firestore ≥ v5.0.0 / "count" aggregation GA)
    const countSnap = await snapCol.count().get();
    const snapshotsTotal = countSnap.data().count || 0;

    // 2️⃣ timestamp of most-recent snapshot ---------------
    const latestQuery = await snapCol
      .where('status', '==', 'Completed')          // only finished ones
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();

    const latestSnapshotAt =
      latestQuery.empty ? null : latestQuery.docs[0]!.data().timestamp;

    return NextResponse.json({ snapshotsTotal, latestSnapshotAt });
  } catch (err: any) {
    console.error('[kpis] failed:', err);
    return NextResponse.json(
      { error : 'internal-error', message : err?.message },
      { status : 500 },
    );
  }
} 