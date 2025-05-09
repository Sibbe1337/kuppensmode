import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { db } from '@/lib/firestore'; // Import Firestore admin instance

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error("[Checkout API] STRIPE_SECRET_KEY environment variable not set.");
  // Throw an error or return a 500 during init if you want to prevent startup without it
}
const stripe = new Stripe(stripeSecretKey!, { // Added non-null assertion
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
      console.error("[Checkout API] Unauthorized - No userId");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    let body: CheckoutRequestBody;
    try {
      body = await request.json();
    } catch (error) {
      console.error("[Checkout API] Invalid JSON body:", error);
      return new NextResponse("Invalid JSON body", { status: 400 });
    }

    const { priceId, seats = 1 } = body;
    console.log(`[Checkout API] User: ${userId}, Requested Price ID: ${priceId}, Seats: ${seats}`); // Log incoming data

    if (!priceId || !priceId.startsWith('price_')) {
      console.error("[Checkout API] Invalid or missing Price ID:", priceId);
      return new NextResponse("Invalid or missing Price ID", { status: 400 });
    }
    if (typeof seats !== 'number' || !Number.isInteger(seats) || seats < 1) {
        return new NextResponse("Invalid number of seats", { status: 400 });
    }

    // Fetch user email for Stripe customer_email
    let userEmail: string | undefined;
    try {
        const client = await clerkClient(); // Call clerkClient() to get the instance
        const user = await client.users.getUser(userId);
        userEmail = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress; // Added :any temporarily
        if (!userEmail) console.warn(`[Checkout API] Could not find primary email for user ${userId}`);
    } catch (clerkError) {
        console.error(`[Checkout API] Error fetching user ${userId} from Clerk:`, clerkError);
    }

    // --- Get/Create Stripe Customer ID (from existing logic) ---
    let stripeCustomerId: string | undefined;
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (userSnap.exists && userSnap.data()?.stripeCustomerId) {
      stripeCustomerId = userSnap.data()?.stripeCustomerId; 
    } else {
      console.log(`[Checkout API] No existing Stripe Customer ID for ${userId}. Creating new.`);
      try {
        const customer = await stripe.customers.create({
            email: userEmail, // Add email if available
            metadata: { userId: userId },
        });
        stripeCustomerId = customer.id;
        await userRef.set({ stripeCustomerId: stripeCustomerId }, { merge: true });
      } catch (customerCreateError) {
          console.error(`[Checkout API] Error creating Stripe customer for ${userId}:`, customerCreateError);
          // Fallback or error, for now, proceed without customer if creation fails
      }
    }
    console.log(`[Checkout API] Using Stripe Customer ID: ${stripeCustomerId} for user ${userId}`);
    // --- End Get/Create Stripe Customer ID ---

    const successUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard?checkout=cancel`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: seats }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId, // Keep for webhook reconciliation
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      ...(userEmail && !stripeCustomerId && { customer_email: userEmail }), // Pass email if creating customer implicitly
      subscription_data: { metadata: { userId: userId } },
    };

    console.log("[Checkout API] Creating Stripe session with params:", JSON.stringify(sessionParams, null, 2));
    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.id) {
        console.error("[Checkout API] Stripe session.id is missing after creation.");
        throw new Error("Could not create Stripe Checkout Session.");
    }

    console.log(`[Checkout API] Stripe session created successfully. ID: ${session.id}`);
    // Ensure the response JSON structure is exactly { id: session.id }
    return NextResponse.json({ id: session.id }); 

  } catch (err: any) {
    console.error("[Checkout API] ERROR:", err);
    // Ensure a JSON response for errors too, so client can parse err.message
    return NextResponse.json({ error: err.message || 'Failed to create session' }, { status: 500 });
  }
} 