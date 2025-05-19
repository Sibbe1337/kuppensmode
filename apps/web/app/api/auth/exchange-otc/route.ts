import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firestore'; // Assuming you have a Firestore init helper
import { FieldValue } from '@google-cloud/firestore';

const db = getDb();
const OTC_COLLECTION = 'nativeAuthOneTimeCodes';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { oneTimeCode } = body;

    if (!oneTimeCode || typeof oneTimeCode !== 'string') {
      console.warn('[exchange-otc] Invalid or missing oneTimeCode in request body.');
      return NextResponse.json({ error: 'Invalid one-time code provided.' }, { status: 400 });
    }

    console.log(`[exchange-otc] Received request to exchange OTC: ${oneTimeCode}`);

    const otcDocRef = db.collection(OTC_COLLECTION).doc(oneTimeCode);
    const otcDocSnap = await otcDocRef.get();

    if (!otcDocSnap.exists) {
      console.warn(`[exchange-otc] One-Time Code not found or already used: ${oneTimeCode}`);
      return NextResponse.json({ error: 'Invalid or expired one-time code.' }, { status: 404 });
    }

    const otcData = otcDocSnap.data();

    // Immediately delete the OTC to prevent reuse, even before expiry check for atomicity
    await otcDocRef.delete();
    console.log(`[exchange-otc] Deleted OTC: ${oneTimeCode} after retrieval attempt.`);

    if (!otcData) { // Should not happen if docSnap.exists was true, but as a safeguard
        console.error(`[exchange-otc] OTC data was undefined after doc existed for OTC: ${oneTimeCode}`);
        return NextResponse.json({ error: 'Failed to retrieve token data for OTC.' }, { status: 500 });
    }

    if (otcData.expiresAt && Date.now() > otcData.expiresAt) {
      console.warn(`[exchange-otc] One-Time Code has expired: ${oneTimeCode}`);
      // Even though deleted, inform client it was expired if check is after delete
      return NextResponse.json({ error: 'One-time code has expired.' }, { status: 410 }); // 410 Gone
    }
    
    // Construct the response payload with the tokens
    // Ensure field names match what Electron app expects
    const responsePayload = {
      accessToken: otcData.accessToken,
      refreshToken: otcData.refreshToken,
      idToken: otcData.idToken,
      userId: otcData.userId, // Make sure electron-relay stored this
      expiresIn: Math.round((otcData.expiresAt - Date.now()) / 1000) // Calculate remaining expiresIn if needed
      // Or, if you stored expiresIn directly from Clerk:
      // expiresIn: otcData.expiresIn 
    };

    console.log(`[exchange-otc] Successfully exchanged OTC ${oneTimeCode} for user ${responsePayload.userId}`);
    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error: any) {
    console.error('[exchange-otc] Fatal error during OTC exchange:', error);
    return NextResponse.json({ error: 'Internal server error during OTC exchange.', details: error.message }, { status: 500 });
  }
} 