import { http, Request, Response } from '@google-cloud/functions-framework';
import Stripe from 'stripe';
import { getSecret } from './lib/secrets';
import { db } from './lib/firestore';
import { Timestamp } from '@google-cloud/firestore';

// Define a type for expected user data structure (simplified)
interface UserUpdateData {
  plan: 'free' | 'paid';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planActivatedAt?: Timestamp;
}

let stripeClient: Stripe | null = null;
let webhookSecret: string | null = null;

/**
 * Initializes Stripe client and webhook secret if not already done.
 */
async function initializeStripe(): Promise<void> {
  if (stripeClient && webhookSecret) return;

  console.log('Initializing Stripe client and webhook secret...');
  try {
    const [secretKey, whSecret] = await Promise.all([
      getSecret('STRIPE_SECRET_KEY'),
      getSecret('STRIPE_WEBHOOK_SECRET')
    ]);

    if (!secretKey) throw new Error('STRIPE_SECRET_KEY not found.');
    if (!whSecret) throw new Error('STRIPE_WEBHOOK_SECRET not found.');

    stripeClient = new Stripe(secretKey, { apiVersion: '2024-06-20', typescript: true });
    webhookSecret = whSecret;
    console.log('Stripe client and webhook secret initialized.');
  } catch (error) {
    console.error('Stripe initialization failed:', error);
    // Prevent function execution if Stripe isn't configured
    stripeClient = null;
    webhookSecret = null;
    throw error; 
  }
}

/**
 * HTTP Cloud Function to handle Stripe Webhooks.
 */
export const stripeWebhook = http('stripeWebhook', async (req: Request, res: Response) => {
  console.log('Stripe webhook received...');
  
  try {
    await initializeStripe();
    if (!stripeClient || !webhookSecret) {
      throw new Error('Stripe client or secret not initialized.');
    }

    // Stripe requires the raw body to verify the signature
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
      console.warn('Webhook Error: Missing stripe-signature header');
      res.status(400).send('Webhook Error: Missing signature');
      return;
    }

    let event: Stripe.Event;
    try {
      // req.rawBody is populated by the Functions Framework for specific content types
      // Ensure Cloud Function is configured to receive raw body for application/json
      // Or adjust parsing if needed.
      const rawBody = req.rawBody; 
      if (!rawBody) {
        console.warn('Webhook Error: Raw body not available. Ensure function framework parses it.');
        // Attempt to use req.body if framework provides it parsed but not raw
        // Note: This might fail signature verification if body was modified
        // event = stripeClient.webhooks.constructEvent(JSON.stringify(req.body), sig, webhookSecret);
        throw new Error('Raw body required for signature verification is missing.');
      }
      event = stripeClient.webhooks.constructEvent(rawBody, sig, webhookSecret);
      console.log(`Webhook event constructed: ${event.id}, type: ${event.type}`);
    } catch (err: any) {
      console.warn(`Webhook signature verification failed: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`Processing checkout.session.completed for session: ${session.id}`);

      const userId = session.client_reference_id;
      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

      if (!userId) {
        console.error('Webhook Error: Missing client_reference_id (userId) in checkout session', session.id);
        // Return 200 OK to Stripe to prevent retries for this specific issue
        res.status(200).send('Webhook Error: Missing user identifier'); 
        return;
      }

      console.log(`Updating Firestore for user: ${userId}`);
      try {
        const userRef = db.collection('users').doc(userId);
        const updateData: UserUpdateData = {
          plan: 'paid',
          planActivatedAt: Timestamp.now(),
          ...(stripeCustomerId && { stripeCustomerId }),
          ...(stripeSubscriptionId && { stripeSubscriptionId }),
        };
        await userRef.set(updateData, { merge: true });
        console.log(`User ${userId} plan updated to paid.`);
      } catch (dbError) {
        console.error(`Firestore update failed for user ${userId}:`, dbError);
        // Indicate server error, Stripe will retry
        res.status(500).send('Database update failed'); 
        return;
      }
    }
    // TODO: Handle other potential events like subscription cancellations (`customer.subscription.deleted`)
    else {
      console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a 200 OK response to acknowledge receipt of the event
    res.status(200).json({ received: true });

  } catch (error: any) {
    console.error('Webhook handler error:', error);
    res.status(500).send(`Webhook Handler Error: ${error.message}`);
  }
}); 