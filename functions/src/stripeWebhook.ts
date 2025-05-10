import { http, Request, Response } from '@google-cloud/functions-framework';
import Stripe from 'stripe';
import { getSecret } from './lib/secrets';
import { db } from './lib/firestore';
import { Timestamp } from '@google-cloud/firestore';
const PostHog = require('posthog-node');

// Define DEFAULT_USER_QUOTA locally for robustness in Cloud Function environment
// Matches structure from notion-lifeline/src/config/defaults.ts
interface UserQuota {
  planName: string;
  planId: string; // Conceptual planId, e.g., "free", "paid_monthly_team"
  snapshotsUsed: number; // This should ideally be preserved or reset carefully on downgrade
  snapshotsLimit: number;
}

const DEFAULT_USER_QUOTA: UserQuota = {
  planName: "Free Tier",
  planId: "free",
  snapshotsUsed: 0, // Resetting to 0 on downgrade, or could fetch existing if needed
  snapshotsLimit: 5,
};
// End DEFAULT_USER_QUOTA definition

// Define a type for the billing document
interface BillingInfo {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  planId: string | null; // Stripe Product ID or a conceptual plan ID
  priceId: string | null; // Stripe Price ID
  currentPeriodStart: Timestamp | null;
  currentPeriodEnd: Timestamp | null;
  status: Stripe.Subscription.Status | string; // Stripe subscription status
  seats?: number;
  cancelAtPeriodEnd: boolean | null;
  canceledAt: Timestamp | null;
  endedAt: Timestamp | null;
}

let stripeClient: Stripe | null = null;
let webhookSecret: string | null = null;
let posthogClient: InstanceType<typeof PostHog> | null = null; // Correctly type PostHog client instance

/**
 * Initializes Stripe client, webhook secret, and PostHog client.
 */
async function initializeClients(): Promise<void> {
  if (stripeClient && webhookSecret && posthogClient) return;

  console.log('Initializing Stripe and PostHog clients...');
  try {
    const [secretKey, whSecret, phApiKey, phHost] = await Promise.all([
      getSecret('STRIPE_SECRET_KEY'),
      getSecret('STRIPE_WEBHOOK_SECRET'),
      getSecret('POSTHOG_API_KEY'), // Assuming PostHog API key is in secrets
      Promise.resolve(process.env.POSTHOG_HOST || 'https://app.posthog.com') // Get PostHog host
    ]);

    if (!secretKey) throw new Error('STRIPE_SECRET_KEY not found.');
    if (!whSecret) throw new Error('STRIPE_WEBHOOK_SECRET not found.');
    if (!phApiKey) console.warn('POSTHOG_API_KEY not found. PostHog events disabled.');

    stripeClient = new Stripe(secretKey, { apiVersion: '2024-06-20', typescript: true });
    webhookSecret = whSecret;
    console.log('Stripe client and webhook secret initialized.');

    if (phApiKey && PostHog) { // Check if PostHog was successfully required
      posthogClient = new PostHog(phApiKey, { host: phHost });
      console.log('PostHog client initialized.');
    }

  } catch (error) {
    console.error('Client initialization failed:', error);
    stripeClient = null;
    webhookSecret = null;
    posthogClient = null; // Ensure it's null on error
    throw error; 
  }
}

// Helper function to get plan name from Stripe Product ID (conceptual)
// This might involve fetching Product details from Stripe or having a mapping
async function getPlanNameFromProductId(productId: string | null): Promise<string> {
    if (!productId) return "Unknown Plan";
    // Example: Fetch product from Stripe
    // if (stripeClient && productId) {
    //   try {
    //     const product = await stripeClient.products.retrieve(productId);
    //     return product.name || "Unnamed Plan";
    //   } catch (e) {
    //     console.error(`Failed to retrieve product ${productId}`, e);
    //     return "Unknown Plan";
    //   }
    // }
    // For now, using a simple mapping or returning the ID
    if (productId === process.env.STRIPE_PRO_PLAN_PRODUCT_ID) return "Pro Plan";
    if (productId === process.env.STRIPE_TEAMS_PLAN_PRODUCT_ID) return "Teams Plan";
    return productId; // Fallback to product ID
}

/**
 * HTTP Cloud Function to handle Stripe Webhooks.
 */
export const stripeWebhook = http('stripeWebhook', async (req: Request, res: Response) => {
  console.log('Stripe webhook received...');
  
  try {
    await initializeClients();
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
        return res.status(200).send('Webhook Error: Missing user identifier'); 
      }
      if (!stripeSubscriptionId || !stripeCustomerId) {
        console.error('Webhook Error: Missing subscription ID or customer ID in checkout session', session.id);
        return res.status(400).send('Webhook Error: Missing subscription or customer ID');
      }
      
      try {
        // Retrieve the full subscription to get all details
        const subscription = await stripeClient.subscriptions.retrieve(stripeSubscriptionId, { expand: ['items.data.price.product'] });
        const price = subscription.items.data[0]?.price;
        const product = price?.product as Stripe.Product;

        const billingData: BillingInfo = {
          stripeCustomerId: stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          planId: typeof product === 'string' ? product : product?.id || null,
          priceId: price?.id || null,
          currentPeriodStart: Timestamp.fromMillis(subscription.current_period_start * 1000),
          currentPeriodEnd: Timestamp.fromMillis(subscription.current_period_end * 1000),
          status: subscription.status,
          seats: subscription.items.data[0]?.quantity,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          canceledAt: subscription.canceled_at ? Timestamp.fromMillis(subscription.canceled_at * 1000) : null,
          endedAt: subscription.ended_at ? Timestamp.fromMillis(subscription.ended_at * 1000) : null,
        };

        const userRef = db.collection('users').doc(userId);
        // Update billing sub-document and top-level convenience fields
        const planName = product?.name || (typeof product === 'string' ? product : 'Unknown Plan');
        await userRef.set({ 
            billing: billingData,
            stripeCustomerId: stripeCustomerId, // Keep top-level for convenience
            stripeSubscriptionId: subscription.id, // Keep top-level for convenience
            plan: planName, // Conceptual plan name for quick display
            planId: billingData.planId, // Stripe Product ID
            planActivatedAt: Timestamp.now(), // Reset activation date on new subscription
            // quota may be set by a separate mechanism or based on planId later
        }, { merge: true });
        console.log(`User ${userId} billing info and plan updated after checkout.`);

      } catch (dbOrStripeError) {
        console.error(`Error processing checkout for user ${userId}:`, dbOrStripeError);
        return res.status(500).send('Error processing checkout completion.'); 
      }
    } 
    // Handle subscription updates
    else if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

      if (!userId) {
        console.warn('Webhook Warning: Missing userId in subscription metadata for update.', subscription.id);
        // Potentially lookup user by stripeCustomerId if necessary, but metadata is preferred
        return res.status(200).send('Warning: Missing user identifier in subscription metadata.');
      }
      if (!stripeCustomerId) {
        console.error('Webhook Error: Missing customer ID in subscription update', subscription.id);
        return res.status(400).send('Webhook Error: Missing customer ID in subscription update');
      }
      
      console.log(`Processing customer.subscription.updated for user ${userId}, subscription ${subscription.id}`);
      try {
        // Expand price and product information if not already expanded or to ensure freshness
        const fullSubscription = await stripeClient.subscriptions.retrieve(subscription.id, { expand: ['items.data.price.product'] });
        const price = fullSubscription.items.data[0]?.price;
        const product = price?.product as Stripe.Product;

        const billingData: BillingInfo = {
          stripeCustomerId: stripeCustomerId,
          stripeSubscriptionId: fullSubscription.id,
          planId: typeof product === 'string' ? product : product?.id || null,
          priceId: price?.id || null,
          currentPeriodStart: Timestamp.fromMillis(fullSubscription.current_period_start * 1000),
          currentPeriodEnd: Timestamp.fromMillis(fullSubscription.current_period_end * 1000),
          status: fullSubscription.status,
          seats: fullSubscription.items.data[0]?.quantity,
          cancelAtPeriodEnd: fullSubscription.cancel_at_period_end,
          canceledAt: fullSubscription.canceled_at ? Timestamp.fromMillis(fullSubscription.canceled_at * 1000) : null,
          endedAt: fullSubscription.ended_at ? Timestamp.fromMillis(fullSubscription.ended_at * 1000) : null,
        };
        
        const userRef = db.collection('users').doc(userId);
        const planName = product?.name || (typeof product === 'string' ? product : 'Unknown Plan');
        const updatePayload: any = {
            billing: billingData,
            plan: planName,
            planId: billingData.planId,
        };

        // If subscription is canceled or ended, or will cancel at period end and period has ended
        const now = Date.now();
        const hasEnded = fullSubscription.status === 'canceled' || fullSubscription.status === 'unpaid' || (fullSubscription.ended_at && fullSubscription.ended_at * 1000 <= now);
        const willEnd = fullSubscription.cancel_at_period_end && fullSubscription.current_period_end * 1000 <= now;

        if (hasEnded || willEnd) {
            console.log(`Subscription ${fullSubscription.id} for user ${userId} is considered ended/canceled. Downgrading quota.`);
            updatePayload.quota = DEFAULT_USER_QUOTA;
            updatePayload.plan = DEFAULT_USER_QUOTA.planName; // Reflect free plan name
            updatePayload.planId = DEFAULT_USER_QUOTA.planId; // Reflect free plan conceptual ID

            if (posthogClient) {
                posthogClient.capture({
                    distinctId: userId,
                    event: 'plan_downgrade',
                    properties: {
                        stripeSubscriptionId: fullSubscription.id,
                        previousPlanId: billingData.planId, // The plan they were on
                        reason: `subscription_status_${fullSubscription.status}`
                    }
                });
            }
        } else {
           // TODO: If plan changed, update quota based on the new planId
           // This would require a mapping from planId to quota limits
           console.log(`Subscription ${fullSubscription.id} for user ${userId} updated. Status: ${fullSubscription.status}. Quota may need adjustment based on new plan.`);
        }
        
        await userRef.set(updatePayload, { merge: true });
        console.log(`User ${userId} billing info updated. Status: ${fullSubscription.status}`);

      } catch (dbOrStripeError) {
        console.error(`Error processing subscription update for user ${userId}:`, dbOrStripeError);
        return res.status(500).send('Error processing subscription update.');
      }
    }
    // Handle subscription deletions
    else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      
      if (!userId) {
        console.warn('Webhook Warning: Missing userId in subscription metadata for delete.', subscription.id);
        return res.status(200).send('Warning: Missing user identifier in subscription metadata.');
      }

      console.log(`Processing customer.subscription.deleted for user ${userId}, subscription ${subscription.id}`);
      try {
        const userRef = db.collection('users').doc(userId);
        // Update billing status and downgrade quota
        // The subscription object itself might be minimal, focus on marking as deleted and downgrading.
        const billingUpdate = {
            status: 'deleted', // Or use subscription.status if it's 'canceled'
            endedAt: subscription.ended_at ? Timestamp.fromMillis(subscription.ended_at * 1000) : Timestamp.now(),
        };

        await userRef.set({ 
            billing: billingUpdate, // Merge with existing billing info to update status
            quota: DEFAULT_USER_QUOTA,
            plan: DEFAULT_USER_QUOTA.planName,
            planId: DEFAULT_USER_QUOTA.planId,
        }, { merge: true });

        if (posthogClient) {
            posthogClient.capture({
                distinctId: userId,
                event: 'plan_downgrade',
                properties: {
                    stripeSubscriptionId: subscription.id,
                    reason: 'subscription_deleted'
                }
            });
            await posthogClient.shutdownAsync(); // Ensure event is sent before function terminates
        }
        console.log(`User ${userId} downgraded due to subscription deletion.`);

      } catch (dbError) {
        console.error(`Error processing subscription deletion for user ${userId}:`, dbError);
        return res.status(500).send('Error processing subscription deletion.');
      }
    }
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