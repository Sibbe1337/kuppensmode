import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { db } from '@/lib/firestore';
import { FieldValue } from '@google-cloud/firestore';
import { DEFAULT_USER_QUOTA } from '@/config/defaults'; // For plan details

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("Stripe secret key not configured.");
}
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

// Helper to get plan details based on Price ID (similar to webhook)
// You might want to refactor this into a shared lib if used in multiple places
const PRO_PLAN_PRICE_ID = process.env.STRIPE_PRO_PLAN_PRICE_ID;
const TEAMS_PLAN_PRICE_ID = process.env.STRIPE_TEAMS_PLAN_PRICE_ID;
const FREE_PLAN_ID = "free";

const PRO_PLAN_QUOTA = { planName: "Pro", planId: PRO_PLAN_PRICE_ID || "pro_fallback", snapshotsUsed: 0, snapshotsLimit: 50 };
const TEAMS_PLAN_QUOTA = { planName: "Teams", planId: TEAMS_PLAN_PRICE_ID || "teams_fallback", snapshotsUsed: 0, snapshotsLimit: 500 };
const FREE_PLAN_QUOTA = DEFAULT_USER_QUOTA;

function getPlanDetailsFromPriceId(priceId: string | undefined): { planId: string; quota: any; planName: string } {
    const safeProPriceId = PRO_PLAN_PRICE_ID || 'pro_fallback_undefined';
    const safeTeamsPriceId = TEAMS_PLAN_PRICE_ID || 'teams_fallback_undefined';
    
    switch (priceId) {
        case safeProPriceId:
            return { planId: PRO_PLAN_PRICE_ID!, quota: PRO_PLAN_QUOTA, planName: "Pro" };
        case safeTeamsPriceId:
            return { planId: TEAMS_PLAN_PRICE_ID!, quota: TEAMS_PLAN_QUOTA, planName: "Teams" };
        default:
            console.warn(`verify-checkout: Unknown priceId '${priceId}' during plan lookup. Defaulting to Free.`);
            return { planId: FREE_PLAN_ID, quota: FREE_PLAN_QUOTA, planName: "Free" };
    }
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
  }

  try {
    console.log(`Verifying checkout session ${sessionId} for user ${userId}`);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['line_items', 'customer', 'subscription']
    });

    if (session.payment_status !== 'paid' || session.status !== 'complete') {
      console.warn(`Session ${sessionId} not successfully paid/completed. Status: ${session.status}, Payment: ${session.payment_status}`);
      return NextResponse.json({ error: 'Checkout session not successfully paid.' }, { status: 402 }); // Payment Required or other appropriate status
    }

    // Ensure client_reference_id matches the authenticated user
    if (session.client_reference_id !== userId) {
        console.error(`CRITICAL: client_reference_id mismatch! Session: ${session.client_reference_id}, Authenticated: ${userId}`);
        return NextResponse.json({ error: 'Session user mismatch' }, { status: 403 });
    }

    const priceId = session.line_items?.data[0]?.price?.id;
    if (!priceId) {
        console.error(`Could not extract priceId from session ${sessionId}`);
        return NextResponse.json({ error: 'Could not determine plan from session' }, { status: 500 });
    }

    const { planId: newPlanId, quota: newQuota, planName: newPlanName } = getPlanDetailsFromPriceId(priceId);
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    
    const userRef = db.collection('users').doc(userId);
    const userDataToUpdate: { [key: string]: any } = {
        stripeSubscriptionStatus: 'active', // or session.subscription.status
        planId: newPlanId,
        planName: newPlanName,
        quota: newQuota,
        updatedAt: FieldValue.serverTimestamp(),
    };
    if (stripeCustomerId) userDataToUpdate.stripeCustomerId = stripeCustomerId;
    if (stripeSubscriptionId) userDataToUpdate.stripeSubscriptionId = stripeSubscriptionId;

    await userRef.set(userDataToUpdate, { merge: true });
    console.log(`User ${userId} successfully updated to plan ${newPlanName} from checkout session ${sessionId}.`);

    return NextResponse.json({ success: true, planName: newPlanName });

  } catch (error: any) {
    console.error(`Error verifying checkout session ${sessionId} for user ${userId}:`, error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
} 