import { NextResponse } from 'next/server';
// import { getDb } from "@/lib/firestore"; // Not needed for basic status
// import { Timestamp } from '@google-cloud/firestore'; // Not needed for basic status

export const dynamic = "force-dynamic"; // Ensure dynamic rendering
export const runtime = 'nodejs';

// interface DailyStats { // Commenting out as we are simplifying for now
//   backupSuccessRate: number;
//   totalPagesStored: number;
//   lastUpdated: Timestamp | { seconds: number, nanoseconds: number }; 
//   totalUsers?: number;
//   totalSuccessfulSnapshotsStored?: number;
// }

export async function GET(request: Request) {
  // const db = getDb(); // Not needed for basic status
  try {
    // const statsDocRef = db.collection('stats').doc('daily');
    // const docSnap = await statsDocRef.get();

    // if (!docSnap.exists) {
    //   return new NextResponse(JSON.stringify({ error: "Daily stats not found." }), {
    //     status: 404,
    //     headers: { 'Content-Type': 'application/json' },
    //   });
    // }
    // const stats = docSnap.data() as DailyStats;
    // let lastUpdatedISO = 'N/A';
    // if (stats.lastUpdated && typeof (stats.lastUpdated as any).toDate === 'function') {
    //     lastUpdatedISO = (stats.lastUpdated as Timestamp).toDate().toISOString();
    // } else if (stats.lastUpdated && typeof (stats.lastUpdated as any).seconds === 'number') {
    //     lastUpdatedISO = new Date((stats.lastUpdated as {seconds: number}).seconds * 1000).toISOString();
    // }

    // const jsonData = {
    //   backupSuccessRate: stats.backupSuccessRate,
    //   totalPagesStored: stats.totalPagesStored,
    //   lastUpdated: lastUpdatedISO,
    //   status: "operational",
    // }; 

    // Simplified status for now, as per user suggestion
    return NextResponse.json({ ok: true, timestamp: Date.now(), status: "operational" });

  } catch (error: any) {
    console.error("[API Status] Error fetching status:", error);
    return new NextResponse(JSON.stringify({ error: "Failed to fetch status.", details: error.message, ok: false, status: "error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 