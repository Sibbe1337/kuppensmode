import { NextResponse } from 'next/server';
import { getDb } from "@/lib/firestore"; // Changed to getDb
import { Timestamp } from '@google-cloud/firestore'; // For typing

export const runtime = 'nodejs'; // Or 'edge' if no Node.js specific APIs are used and DB access is edge-compatible
// export const dynamic = 'force-dynamic'; // Force dynamic rendering if data is always fresh

interface DailyStats {
  backupSuccessRate: number;
  totalPagesStored: number;
  lastUpdated: Timestamp | { seconds: number, nanoseconds: number }; // Firestore timestamp
  totalUsers?: number;
  totalSuccessfulSnapshotsStored?: number;
  // Add other relevant stats
}

export async function GET(request: Request) {
  const db = getDb(); // Get instance here
  try {
    const statsDocRef = db.collection('stats').doc('daily');
    const docSnap = await statsDocRef.get();

    if (!docSnap.exists) {
      return new NextResponse(JSON.stringify({ error: "Daily stats not found." }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stats = docSnap.data() as DailyStats;

    // Convert Firestore Timestamp to ISO string for JSON response if it's a Firestore Timestamp object
    let lastUpdatedISO = 'N/A';
    if (stats.lastUpdated && typeof (stats.lastUpdated as any).toDate === 'function') {
        lastUpdatedISO = (stats.lastUpdated as Timestamp).toDate().toISOString();
    } else if (stats.lastUpdated && typeof (stats.lastUpdated as any).seconds === 'number') {
        lastUpdatedISO = new Date((stats.lastUpdated as {seconds: number}).seconds * 1000).toISOString();
    }

    const jsonData = {
      backupSuccessRate: stats.backupSuccessRate,
      totalPagesStored: stats.totalPagesStored,
      lastUpdated: lastUpdatedISO,
      status: "operational", // Example overall status
    };

    // Minimal HTML badge (SVG or simple HTML)
    // This is a very basic example. A more robust badge could be an SVG.
    const successRateFormatted = stats.backupSuccessRate.toFixed(2);
    const pagesFormatted = (stats.totalPagesStored / 1000).toFixed(0) + "K"; // Example: 500K
    
    const htmlBadge = `
      <div style="display: inline-flex; align-items: center; background-color: #e6f7ff; border: 1px solid #91d5ff; border-radius: 4px; padding: 4px 8px; font-family: sans-serif; font-size: 12px; color: #0050b3;">
        <span style="height: 8px; width: 8px; background-color: #52c41a; border-radius: 50%; margin-right: 6px;"></span>
        <span>${successRateFormatted}% backup success • ${pagesFormatted} pages stored</span>
      </div>
    `;

    // Respond based on Accept header or query param
    const acceptHeader = request.headers.get('Accept');
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format');

    if (format === 'html' || (acceptHeader && acceptHeader.includes('text/html'))) {
      return new NextResponse(htmlBadge, {
        status: 200,
        headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=300, s-maxage=60' }, // Cache for 5 mins, 1 min on CDN
      });
    }

    return new NextResponse(JSON.stringify(jsonData), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300, s-maxage=60' }, 
    });

  } catch (error: any) {
    console.error("[API Status] Error fetching daily stats:", error);
    return new NextResponse(JSON.stringify({ error: "Failed to fetch status.", details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 