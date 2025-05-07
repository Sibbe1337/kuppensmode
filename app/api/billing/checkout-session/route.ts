import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { db } from '@/lib/firestore'; // Import Firestore admin instance

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY environment variable not set.");
  throw new Error("Stripe configuration error");
}
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20', 
  typescript: true,
});

// Define expected request body structure
interface CheckoutRequestBody {
  priceId: string; // Stripe Price ID (price_...)
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    let body: CheckoutRequestBody;
    try {
      body = await request.json();
    } catch (error) {
      return new NextResponse("Invalid JSON body", { status: 400 });
    }

    const { priceId } = body;
    if (!priceId || !priceId.startsWith('price_')) {
      return new NextResponse("Invalid or missing Price ID", { status: 400 });
    }

    console.log(`Creating checkout session for user: ${userId}, price: ${priceId}`);

    // --- Get User Data (for Stripe Customer ID) ---
    let stripeCustomerId: string | undefined;
    try {
        const userRef = db.collection('users').doc(userId);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
            stripeCustomerId = userSnap.data()?.stripeCustomerId; 
            console.log(`Found existing Stripe Customer ID: ${stripeCustomerId} for user ${userId}`);
        } else {
             console.log(`User document not found for ${userId}, will create new Stripe customer.`);
             // Optionally create the user doc here if needed, though webhook is better
        }
    } catch (dbError) {
        console.error(`Firestore error fetching user ${userId}:`, dbError);
        // Decide if you want to proceed without customer ID or return error
        // Proceeding allows checkout but makes linking harder pre-webhook
    }
    // --- End Get User Data ---

    // Define URLs (use environment variables for flexibility)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/dashboard?checkout=cancel`;

    // Create the Stripe Checkout Session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription', // Use 'payment' for one-time purchases
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId, // IMPORTANT: Link session to your user ID
      // Add customer details
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
       // If no customer ID, Stripe might create one. Consider adding:
       // customer_creation: stripeCustomerId ? undefined : 'always', // Create if not found
       // Alternatively, pass customer_email if you fetch it from Clerk user
    };

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    if (!checkoutSession.id) {
        throw new Error("Could not create Stripe Checkout Session.");
    }

    console.log(`Created Checkout Session: ${checkoutSession.id} for user ${userId}`);

    // Return the session ID to the frontend
    return NextResponse.json({ sessionId: checkoutSession.id });

  } catch (error) {
    console.error("Error creating checkout session:", error);
    if (error instanceof Stripe.errors.StripeError) {
      return new NextResponse(`Stripe Error: ${error.message}`, { status: error.statusCode || 500 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 