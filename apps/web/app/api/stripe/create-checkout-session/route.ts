import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { getDb } from "@/lib/firestore";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("[Stripe Checkout API] STRIPE_SECRET_KEY environment variable not set.");
}
const stripe = new Stripe(stripeSecretKey!, {
  apiVersion: '2024-06-20',
  typescript: true,
});

interface RequestBody {
    priceId?: string;
}

export async function POST(req: Request) {
  const db = getDb(); // Get instance here
  const { userId } = await auth(); // Corrected to await auth()

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body: RequestBody = await req.json();
  const { priceId } = body;

  if (!priceId) {
      return new NextResponse("Missing priceId", { status: 400 });
  }

  console.log(`Creating Stripe Checkout session for user: ${userId}, price: ${priceId}`);

  const userRef = db.collection('users').doc(userId);
  let stripeCustomerId: string | undefined;

  const userDoc = await userRef.get();
  if (userDoc.exists && userDoc.data()?.stripeCustomerId) {
    stripeCustomerId = userDoc.data()?.stripeCustomerId;
    console.log(`Found existing Stripe Customer ID: ${stripeCustomerId} for user: ${userId}`);
  } else {
    console.log(`No existing Stripe Customer ID found for user ${userId}. Creating new Stripe customer.`);
    const customer = await stripe.customers.create({
      metadata: { userId: userId }, // Essential: link Clerk userId to Stripe customer
      // You can add email and name here later if you reliably fetch them from Clerk
    });
    stripeCustomerId = customer.id;
    console.log(`Created new Stripe Customer ID: ${stripeCustomerId} for user: ${userId}`);
    await userRef.set({ stripeCustomerId: stripeCustomerId }, { merge: true });
  }

  if (!stripeCustomerId) { 
      console.error(`Stripe Customer ID is still undefined for user: ${userId}`);
      return new NextResponse("Failed to retrieve or create Stripe customer.", { status: 500 });
  }

  const origin = req.headers.get('origin') || 'http://localhost:3000';
  const success_url = `${origin}/dashboard/settings?session_id={CHECKOUT_SESSION_ID}`;
  const cancel_url = `${origin}/dashboard/settings`;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    customer: stripeCustomerId, 
    success_url: success_url,
    cancel_url: cancel_url,
    metadata: {
      userId: userId, // CRUCIAL for webhook to identify the user
    },
    subscription_data: {
      metadata: {
        userId: userId,
      }
    },
  });

  if (!session.id) {
      throw new Error('Stripe session ID not found after creation.');
  }

  console.log(`Created Stripe session: ${session.id} for user ${userId} with customer ${stripeCustomerId}`);

  return NextResponse.json({ sessionId: session.id });
} 