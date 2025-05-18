import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getDb } from "@/lib/firestore";
import { customAlphabet } from 'nanoid';
import { FieldValue } from '@shared/firestore';

// Generate a somewhat human-readable, unique-enough code
// Example: PGLF-A1B2C3
const nanoidReferral = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);
const generateReferralCode = () => `PGLF-${nanoidReferral()}`;

// GET handler to retrieve referral code
export async function GET(request: Request) {
  const db = getDb();
  const { userId } = getAuth(request as any);
  if (!userId) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' }});
  }

  const userRef = db.collection('users').doc(userId);

  try {
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      // This case should ideally not happen for an authenticated user if user doc is created on first login
      return new NextResponse(JSON.stringify({ error: "User document not found." }), { status: 404, headers: { 'Content-Type': 'application/json' }});
    }

    const settings = userSnap.data()?.settings || {};
    let referralCode = settings.referralCode;

    if (!referralCode) {
      referralCode = generateReferralCode();
      // TODO: Add a check for extremely rare code collision if this system scales massively.
      // For now, nanoid's uniqueness is generally sufficient for moderate user bases.
      
      await userRef.set(
        { 
          settings: { 
            ...settings, 
            referralCode: referralCode,
            referralsMadeCount: settings.referralsMadeCount || 0 // Initialize if not present
          } 
        },
        { merge: true }
      );
      console.log(`[API ReferralCode] Generated new referral code ${referralCode} for user ${userId}`);
    }

    return NextResponse.json({ referralCode: referralCode, referralsMadeCount: settings.referralsMadeCount || 0 });

  } catch (error: any) {
    console.error(`[API ReferralCode] Error fetching/generating referral code for user ${userId}:`, error);
    return new NextResponse(JSON.stringify({ error: 'Failed to get referral code.', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// POST handler to generate/regenerate referral code
export async function POST(request: Request) {
  const db = getDb();
  const { userId } = getAuth(request as any);
  // ... POST logic ...
} 