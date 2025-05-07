import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { db } from '@/lib/firestore'; // Import Firestore admin instance
import { FieldValue } from '@google-cloud/firestore'; // For potential atomic updates or deletions
import type { UserSettings, UserQuota } from '@/types/user'; // Assuming these are correctly aliased
import { DEFAULT_USER_SETTINGS, DEFAULT_USER_QUOTA } from '@/config/defaults'; // Assuming these are correctly aliased

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY environment variable not set.");
  throw new Error("Stripe configuration error");
}
if (!webhookSecret) {
  console.error("STRIPE_WEBHOOK_SECRET environment variable not set.");
  throw new Error("Stripe webhook configuration error");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
  typescript: true,
});

// Define your actual Stripe Price IDs for different plans
// Replace these with your real Price IDs from your Stripe Dashboard (Test mode for now)
const FREE_PLAN_ID = "free"; // Internal identifier for free plan
const PRO_PLAN_PRICE_ID = process.env.STRIPE_PRO_PLAN_PRICE_ID; 
const TEAMS_PLAN_PRICE_ID = process.env.STRIPE_TEAMS_PLAN_PRICE_ID;

// Define Quota objects for each plan
const FREE_PLAN_QUOTA: UserQuota = DEFAULT_USER_QUOTA; // Use from defaults

const PRO_PLAN_QUOTA: UserQuota = {
  planName: "Pro",
  planId: PRO_PLAN_PRICE_ID || "pro_fallback", // Use price ID or a local identifier
  snapshotsUsed: 0, // Reset usage, or adjust based on business logic
  snapshotsLimit: 50, // Example Pro plan limit
};

const TEAMS_PLAN_QUOTA: UserQuota = {
  planName: "Teams",
  planId: TEAMS_PLAN_PRICE_ID || "teams_fallback", // Use price ID or a local identifier
  snapshotsUsed: 0,
  snapshotsLimit: 500, // Example Teams plan limit (e.g., 10x Pro)
};

// Helper function to get plan details from Price ID
function getPlanDetailsFromPriceId(priceId: string | undefined): { planId: string; quota: UserQuota; planName: string } {
  // Ensure plan IDs from env vars are defined before using in switch cases
  const safeProPriceId = PRO_PLAN_PRICE_ID || 'pro_fallback_undefined';
  const safeTeamsPriceId = TEAMS_PLAN_PRICE_ID || 'teams_fallback_undefined';
  
  switch (priceId) {
    case safeProPriceId:
      return { planId: PRO_PLAN_PRICE_ID!, quota: PRO_PLAN_QUOTA, planName: "Pro" }; // Use assertion now
    case safeTeamsPriceId:
      return { planId: TEAMS_PLAN_PRICE_ID!, quota: TEAMS_PLAN_QUOTA, planName: "Teams" }; // Use assertion now
    default:
      console.warn(`Webhook: Unknown or missing priceId '${priceId}'. Defaulting to Free plan.`);
      return { planId: FREE_PLAN_ID, quota: FREE_PLAN_QUOTA, planName: "Free" };
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    console.error("Webhook error: Missing stripe-signature header");
    return new NextResponse("Webhook Error: Missing signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log(`Received Stripe event: ${event.type}, ID: ${event.id}`);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('Handling checkout.session.completed', session.id);
      
      // Get userId from client_reference_id
      const userId = session.client_reference_id;
      const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

      // Ensure userId is defined and assign to a new const for clearer type scope
      if (!userId) {
          console.error('Webhook Error: Missing userId (client_reference_id) in checkout session', session.id);
          break; // Breaking for safety
      }
      const confirmedUserId = userId; // userId is confirmed string here

      if (!stripeCustomerId) {
          console.error('Webhook Error: Missing customer ID in checkout session', session.id);
          break; // Breaking for safety
      }
      if (!stripeSubscriptionId) {
          console.error('Webhook Error: Missing subscription ID in checkout session (needed for subscription updates)', session.id);
          break; // Breaking for safety if mode=subscription
      }

      try {
        // Removed the redundant check `if (!userId)` here
        
        // --- Determine plan from session --- 
        let priceId: string | undefined;
        try {
            // Retrieve the session with line items expanded to get the price ID
            const sessionWithLineItems = await stripe.checkout.sessions.retrieve(
                session.id,
                { expand: ['line_items'] }
            );
            priceId = sessionWithLineItems.line_items?.data[0]?.price?.id;
        } catch (retrieveError) {
            console.error(`Webhook Error: Failed to retrieve session ${session.id} with line items:`, retrieveError);
            break; // Stop processing if we can't determine the plan
        }
        
        if (!priceId) {
             console.error('Webhook Error: Could not find priceId in checkout session line items', session.id);
             break; // Stop processing if we can't determine the plan
        }
        
        const { planId, quota, planName } = getPlanDetailsFromPriceId(priceId);
        // --- End Determine plan --- 

        // Prepare data for Firestore
        const userDataToUpdate: { [key: string]: any } = {
            stripeSubscriptionStatus: 'active',
            planId: planId, 
            planName: planName,
            quota: quota, // Set the full quota object
        };
        if (stripeCustomerId) {
            userDataToUpdate.stripeCustomerId = stripeCustomerId;
        }
        if (stripeSubscriptionId) {
            userDataToUpdate.stripeSubscriptionId = stripeSubscriptionId;
        }
        
        // Use confirmedUserId for Firestore operations
        const userRef = db.collection('users').doc(confirmedUserId as string); // Explicit cast
        await userRef.set(userDataToUpdate, { merge: true });
        
        console.log(`Updated Firestore for user ${confirmedUserId} to ${planName} plan. Data:`, userDataToUpdate);

      } catch (dbError) {
        console.error(`Firestore update error for checkout session ${session.id}:`, dbError);
        // Consider returning a 500 to signal Stripe to retry, depending on error
      }
      break;

    case 'customer.subscription.updated':
      const subscriptionUpdated = event.data.object as Stripe.Subscription;
      console.log('Handling customer.subscription.updated', subscriptionUpdated.id);
      // Common triggers: payment failure, cancellation, plan change via billing portal
      const customerIdUpdated = typeof subscriptionUpdated.customer === 'string' ? subscriptionUpdated.customer : subscriptionUpdated.customer?.id;
      
      if (customerIdUpdated) {
        try {
          // Find user by stripeCustomerId
          const usersRef = db.collection('users');
          const querySnapshot = await usersRef.where('stripeCustomerId', '==', customerIdUpdated).limit(1).get();
          
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userIdForUpdate = userDoc.id;
            const newStatus = subscriptionUpdated.status;
            const newPriceId = subscriptionUpdated.items.data[0]?.price.id; // Price ID from the updated subscription
            
            // --- Determine plan from updated subscription --- 
            const { planId: newPlanId, quota: newQuota, planName: newPlanName } = getPlanDetailsFromPriceId(newPriceId);
            // --- End Determine plan --- 

            console.log(`Updating subscription status for user ${userIdForUpdate} to ${newStatus}, plan: ${newPlanName}`);
            await userDoc.ref.update({
              stripeSubscriptionStatus: newStatus,
              stripeSubscriptionId: subscriptionUpdated.id,
              planId: newPlanId,
              planName: newPlanName,
              quota: newQuota,
              // Potentially adjust usage based on status, e.g., disable if 'past_due'?
            });
          } else {
            console.warn(`Webhook received subscription update for unknown customer: ${customerIdUpdated}`);
          }
        } catch (dbError) {
            console.error(`Firestore update error for subscription update ${subscriptionUpdated.id}:`, dbError);
        }
      }
      break;

    case 'customer.subscription.deleted':
      const subscriptionDeleted = event.data.object as Stripe.Subscription;
      console.log('Handling customer.subscription.deleted', subscriptionDeleted.id);
      // Occurs when a subscription is canceled immediately or at period end
      const customerIdDeleted = typeof subscriptionDeleted.customer === 'string' ? subscriptionDeleted.customer : subscriptionDeleted.customer?.id;
      
      if (customerIdDeleted) {
        try {
          // Find user by stripeCustomerId
          const usersRef = db.collection('users');
          const querySnapshot = await usersRef.where('stripeCustomerId', '==', customerIdDeleted).limit(1).get();

          if (!querySnapshot.empty) {
             const userDoc = querySnapshot.docs[0];
             const userIdForDelete = userDoc.id;
             console.log(`Updating subscription status for user ${userIdForDelete} to ${subscriptionDeleted.status} (canceled)`);
              
             // Revert to free plan details
              await userDoc.ref.update({
                stripeSubscriptionStatus: subscriptionDeleted.status, 
                planId: FREE_PLAN_ID,
                planName: FREE_PLAN_QUOTA.planName,
                quota: FREE_PLAN_QUOTA, // Set quota to free tier object
                stripeSubscriptionId: FieldValue.delete(), // Remove old subscription ID
              });
          } else {
             console.warn(`Webhook received subscription deletion for unknown customer: ${customerIdDeleted}`);
          }
        } catch (dbError) {
            console.error(`Firestore update error for subscription deletion ${subscriptionDeleted.id}:`, dbError);
        }
      }
      break;
    
    // --- ADDED: Handle Payment Failure ---
    case 'invoice.payment_failed':
      const invoice = event.data.object as Stripe.Invoice;
      console.log('Handling invoice.payment_failed', invoice.id);
      const subscriptionIdFailed = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;

      if (typeof subscriptionIdFailed === 'string') {
        const subId: string = subscriptionIdFailed;
        try {
          // Retrieve the subscription to get metadata (userId)
          const subscription = await stripe.subscriptions.retrieve(subId);
          
          const userIdFailed = subscription.metadata.userId;
          if (!userIdFailed) {
            console.warn(`Webhook Error: userId missing in metadata for failed subscription ${subId}`);
            break; // Cannot identify user to downgrade
          }

          console.log(`Payment failed for subscription ${subId}, user ${userIdFailed}. Downgrading to Free plan.`);

          // Revert user to the free plan
          const userRefFailed = db.collection('users').doc(userIdFailed);
          await userRefFailed.set({
            quota: FREE_PLAN_QUOTA, // Set quota to free tier object
            planId: FREE_PLAN_ID,
            planName: FREE_PLAN_QUOTA.planName,
            stripeSubscriptionStatus: 'past_due', // Or subscription.status based on what's relevant
          }, { merge: true }); // Use merge:true to avoid overwriting other user data

          console.log(`User ${userIdFailed} downgraded to Free plan due to payment failure.`);

        } catch (error) {
          console.error(`Error handling invoice.payment_failed for subscription ${subId}:`, error);
          // Decide if error is critical enough to return 500 for retry
        }
      } else {
        console.log(`Ignoring invoice.payment_failed for non-subscription invoice ${invoice.id}`);
      }
      break;
      // --- END: Handle Payment Failure ---

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Return a 200 response to acknowledge receipt of the event
  return NextResponse.json({ received: true });
}

// Removed old getUserIdByStripeCustomerId helper as lookup is inline now 