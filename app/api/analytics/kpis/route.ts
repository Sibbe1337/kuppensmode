import { NextResponse } from 'next/server';
import { db } from '@/lib/firestore'; // Assuming global Firestore admin instance
import { KpiCardProps } from '@/components/dashboard/KpiCard'; // Import for type consistency

export const runtime = 'nodejs';

// Define the structure of the data stored in stats/daily by updateDailyStats
interface DailyStatsDoc {
  totalUsers?: number;
  totalSnapshotsAttemptedLast24h?: number;
  totalSnapshotsSuccessfulLast24h?: number;
  backupSuccessRateLast24h?: number;
  totalSuccessfulSnapshotsStored?: number; // This is count of snapshot documents
  lastUpdated?: any; // Firestore Timestamp
}

export async function GET(request: Request) {
  try {
    const statsDocRef = db.collection('stats').doc('daily');
    const docSnap = await statsDocRef.get();

    let dailyStats: DailyStatsDoc = {};
    if (docSnap.exists) {
      dailyStats = docSnap.data() as DailyStatsDoc;
    }

    const kpis: Omit<KpiCardProps, 'slotRight' | 'className'>[] = [];

    // 1. Total Snapshots
    kpis.push({
      title: "Total Snapshots Created",
      value: (dailyStats.totalSuccessfulSnapshotsStored || 0).toLocaleString(),
      delta: "+0.5%", // Placeholder delta
      subtitle: "All successful snapshots",
      gradientPreset: "blue",
    });

    // 2. Avg. Processing Time (Placeholder for MVP)
    kpis.push({
      title: "Avg. Processing Time",
      value: "1.1s", // Placeholder value
      delta: "-2%", // Placeholder delta
      subtitle: "Snapshot worker efficiency",
      gradientPreset: "purple",
    });

    // 3. Registered Users (as Active Data Points proxy)
    kpis.push({
      title: "Registered Users",
      value: (dailyStats.totalUsers || 0).toLocaleString(),
      delta: "+15", // Placeholder delta (e.g., new users this week)
      subtitle: "Total users signed up",
      gradientPreset: "cyan",
    });

    return NextResponse.json(kpis);

  } catch (error: any) {
    console.error("[API Analytics KPIs] Error fetching KPI data:", error);
    return NextResponse.json({ error: "Failed to fetch KPI data.", details: error.message }, { status: 500 });
  }
} 