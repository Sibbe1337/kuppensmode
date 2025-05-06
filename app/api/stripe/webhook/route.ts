import { NextResponse } from 'next/server';
import Stripe from 'stripe';
// import { db } from '@/lib/firestore'; // TODO: Import Firestore utility

// Initialize Stripe client (need secret key)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
});

// Get webhook secret from environment variables
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!webhookSecret) {
    console.error('Stripe webhook secret is not set.');
    return new NextResponse('Webhook secret configuration error', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  const body = await request.text(); // Read raw body for signature verification

  let event: Stripe.Event;

  try {
    // 1. Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Error verifying Stripe webhook signature: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // 2. Handle the event type
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session?.metadata?.userId; // Assuming you pass userId in metadata when creating session

  console.log(`Received Stripe event: ${event.type} for user: ${userId || 'N/A'}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        if (!userId) {
            console.error('Webhook Error: No userId found in checkout session metadata.');
            break; // Don't proceed if we can't link it to a user
        }
        console.log(`Checkout session completed for user ${userId}.`);
        // TODO: Update user record in Firestore (e.g., set plan to 'paid')
        // Example: 
        // await db.collection('users').doc(userId).update({ 
        //   plan: 'paid', // Or derive plan from price ID in session line items
        //   stripeCustomerId: session.customer as string, // Store customer ID
        //   stripeSubscriptionId: session.subscription as string, // Store subscription ID
        // });
        console.log(`Successfully updated user ${userId} record for completed checkout.`);
        break;
      }
      case 'invoice.payment_failed': {
        console.log(`Payment failed for user ${userId}.`);
        // TODO: Handle payment failure (e.g., notify user, downgrade plan after grace period)
        break;
      }
      case 'customer.subscription.deleted': {
        console.log(`Subscription deleted for user ${userId}.`);
        // TODO: Handle subscription cancellation (e.g., downgrade user plan immediately or at period end)
        // Example: 
        // await db.collection('users').doc(userId).update({ plan: 'free' });
        break;
      }
      // ... handle other event types as needed
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  } catch (dbError) {
      console.error("Database error handling webhook:", dbError);
      // Return 500 so Stripe retries, but avoid breaking on unhandled types
      if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.deleted') {
          return new NextResponse('Database error handling webhook', { status: 500 });
      }
  }

  // 3. Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
} 