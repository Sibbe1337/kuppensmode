import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { getDb } from "@/lib/firestore";
import { env } from '@notion-lifeline/config';

const stripeSecretKey = env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("[Manage Subscription API] STRIPE_SECRET_KEY environment variable not set.");
}
const stripe = new Stripe(stripeSecretKey!, {
  apiVersion: '2024-06-20',
  typescript: true,
});

export async function POST(req: Request) {
  const db = getDb();
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' }});
  }

  // Fetch user's stripeCustomerId from Firestore
  const userDocRef = db.collection('users').doc(userId);
  const userSnap = await userDocRef.get();

  if (!userSnap.exists) {
    return new NextResponse(JSON.stringify({ error: "User not found." }), { status: 404, headers: { 'Content-Type': 'application/json' }});
  }
  // Check both potential locations for stripeCustomerId from M1 implementation
  const stripeCustomerId = userSnap.data()?.stripeCustomerId || userSnap.data()?.billing?.stripeCustomerId;

  if (!stripeCustomerId) {
    return new NextResponse(JSON.stringify({ error: "Stripe customer ID not found for this user. Cannot manage subscription." }), {
      status: 400, 
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard/settings`; // Or a dedicated billing page

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: portalSession.url });
} 