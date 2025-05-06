import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripe } from '@/lib/stripe'; // Use the utility
import { getSecret } from '@/lib/secrets'; // To potentially fetch Price ID if needed
import { db } from '@/lib/firestore'; // To potentially check user status

// Ensure necessary environment variables are set
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function POST(req: NextRequest) {
  console.log('POST /api/subscribe called');
  const { userId } = auth();

  if (!userId) {
    console.warn('/api/subscribe: Unauthorized access attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!STRIPE_PRICE_ID) {
    console.error('/api/subscribe: STRIPE_PRICE_ID environment variable not set.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  console.log(`/api/subscribe: Authorized for userId: ${userId}`);

  try {
    const stripe = await getStripe();

    // Optional: Check if user is already subscribed in Firestore
    // const userDoc = await db.collection('users').doc(userId).get();
    // if (userDoc.exists && userDoc.data()?.plan === 'paid') {
    //   return NextResponse.json({ error: 'Already subscribed' }, { status: 400 });
    // }

    // Create a Stripe Checkout session
    console.log(`/api/subscribe: Creating Stripe Checkout session for user ${userId}`);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      // Include userId to link the subscription in the webhook
      client_reference_id: userId, 
      // Or use metadata:
      // metadata: {
      //   clerkUserId: userId,
      // },
      success_url: `${APP_BASE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_BASE_URL}/dashboard`, // Or a dedicated cancellation page
    });

    console.log(`/api/subscribe: Stripe session created: ${session.id}`);

    // Return the session URL
    if (!session.url) {
        console.error(`/api/subscribe: Stripe session URL is missing! Session ID: ${session.id}`);
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    return NextResponse.json({ sessionId: session.id, url: session.url });

  } catch (error: any) {
    console.error(`/api/subscribe: Error creating Stripe session for user ${userId}:`, error);
    // Provide a more generic error to the client
    return NextResponse.json({ error: 'Could not create checkout session', details: error.message }, { status: 500 });
  }
} 