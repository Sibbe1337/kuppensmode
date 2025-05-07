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
  seats?: number; // Number of seats (optional, defaults to 1)
  billingInterval?: 'month' | 'year'; // Optional context from frontend
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

    const { priceId, seats = 1, billingInterval } = body;
    if (!priceId || !priceId.startsWith('price_')) {
      return new NextResponse("Invalid or missing Price ID", { status: 400 });
    }
    if (typeof seats !== 'number' || !Number.isInteger(seats) || seats < 1) {
        return new NextResponse("Invalid number of seats", { status: 400 });
    }

    console.log(`Creating checkout session for user: ${userId}, price: ${priceId}, seats: ${seats}, interval: ${billingInterval ?? 'N/A'}`);

    // --- Fetch Price object to get metadata (e.g., trialDays) ---
    let price: Stripe.Price | null = null;
    try {
        price = await stripe.prices.retrieve(priceId);
        console.log("Retrieved Price object:", price.id, "Metadata:", price.metadata);
    } catch (priceError: any) {
        console.error(`Error retrieving Stripe Price ${priceId}:`, priceError);
        return new NextResponse(`Invalid Price ID: ${priceError.message}`, { status: 404 });
    }
    // --- End Fetch Price ---

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

    // Determine trial days from Price metadata
    const trialDays = price.metadata?.trialDays ? parseInt(price.metadata.trialDays, 10) : undefined;
    if (trialDays !== undefined && isNaN(trialDays)) {
        console.warn(`Invalid non-numeric trialDays ('${price.metadata.trialDays}') found in metadata for price ${priceId}. Ignoring trial.`);
    }
    const effectiveTrialDays = (trialDays !== undefined && !isNaN(trialDays)) ? trialDays : undefined;

    // Create the Stripe Checkout Session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: seats,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      // Add subscription data: trial period and metadata for webhooks
      subscription_data: {
        ...(effectiveTrialDays && effectiveTrialDays > 0 && {
            trial_period_days: effectiveTrialDays,
        }),
        metadata: {
          userId: userId,
        },
      },
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