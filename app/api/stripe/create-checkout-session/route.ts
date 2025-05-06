import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
// import Stripe from 'stripe'; // TODO: Uncomment when implementing Stripe

// TODO: Initialize Stripe client (outside handler)
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2024-06-20', // Use the API version you intend to target
// });

interface RequestBody {
    priceId?: string;
}

export async function POST(request: Request) {
  try {
    // 1. Get authenticated user ID
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Parse request body
    const body: RequestBody = await request.json();
    const { priceId } = body;

    if (!priceId) {
        return new NextResponse("Missing priceId", { status: 400 });
    }

    console.log(`Creating Stripe Checkout session for user: ${userId}, price: ${priceId}`);

    // 3. TODO: Get user's Stripe Customer ID (create one if it doesn't exist)
    // This usually involves looking up the user in your DB where you store their stripeCustomerId
    // Example: 
    // let customerId = await getUserStripeCustomerId(userId);
    // if (!customerId) { 
    //     const customer = await stripe.customers.create({ metadata: { userId } });
    //     customerId = customer.id;
    //     await saveUserStripeCustomerId(userId, customerId);
    // }

    // 4. TODO: Create Stripe Checkout Session
    // Example:
    // const session = await stripe.checkout.sessions.create({
    //   payment_method_types: ['card'],
    //   line_items: [{ price: priceId, quantity: 1 }],
    //   mode: 'subscription', // Assuming subscription
    //   customer: customerId, // Associate with Stripe customer
    //   success_url: `${request.headers.get('origin')}/dashboard?session_id={CHECKOUT_SESSION_ID}`, // Redirect back to dashboard on success
    //   cancel_url: `${request.headers.get('origin')}/`, // Redirect back to dashboard on cancel
    // });
    // const sessionId = session.id;

    // MOCK RESPONSE FOR NOW
    const mockSessionId = `cs_test_${Buffer.from(userId + priceId).toString('base64')}`;
    const sessionId = mockSessionId;

    console.log(`Created mock Stripe session: ${sessionId}`);

    // 5. Return the session ID
    return NextResponse.json({ sessionId });

  } catch (error) {
    console.error("Error creating Stripe checkout session:", error);
     if (error instanceof SyntaxError) {
        return new NextResponse("Invalid request body", { status: 400 });
    }
    // TODO: Add more specific Stripe error handling
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 