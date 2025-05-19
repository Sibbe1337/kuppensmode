import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firestore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();
    // Attempt a simple read. Ensure the 'meta' collection and 'ping' document can be created/read
    // by the service account, or use a publicly readable document if appropriate.
    // If the doc doesn't exist, .get() doesn't throw an error unless permissions are wrong.
    // We need to check doc.exists for a more accurate health check if doc presence is required.
    // For a simple ping, just attempting the operation is usually enough to check connectivity.
    const pingDoc = await db.collection('meta').doc('ping').get(); 

    // Optional: Check if the document actually exists if that's part of the health criteria
    // if (!pingDoc.exists) {
    //   throw new Error("Firestore 'meta/ping' document not found.");
    // }

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() }, { status: 200 });

  } catch (e: any) {
    console.error('Firestore health check failed during /api/status GET:', e);
    return NextResponse.json(
      {
        ok: false,
        timestamp: new Date().toISOString(),
        error: "Firestore ping failed",
        details: e.message, // Provide the actual error message for debugging
      },
      { status: 503 } // Service Unavailable
    );
  }
} 