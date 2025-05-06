import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { db } from '@/lib/firestore';
import { NextResponse } from 'next/server';
import type { UserSettings } from '@/types/user'; // Assuming UserSettings type
// Define UserQuota locally for now to avoid import path issues
interface UserQuota {
  planName: string;
  planId: string;
  snapshotsUsed: number;
  snapshotsLimit: number;
}

// --- Define Defaults (Consider moving to a shared constants file) ---
const DEFAULT_USER_QUOTA: UserQuota = {
  planName: "Free Tier",
  planId: "free",
  snapshotsUsed: 0,
  snapshotsLimit: 5,
};

const DEFAULT_USER_SETTINGS: UserSettings = {
  notionConnected: false,
  notionWorkspaceName: null,
  apiKey: null, // Represented by apiKeyHash in DB
  notifications: {
    emailOnSnapshotSuccess: true,
    emailOnSnapshotFailure: true,
    webhookUrl: null,
  },
};
// --- End Defaults ---

export async function POST(req: Request) {
  // Get the necessary headers
  const svix_id = headers().get("svix-id");
  const svix_timestamp = headers().get("svix-timestamp");
  const svix_signature = headers().get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('Clerk Webhook Error: Missing svix headers');
    return new Response('Error occured -- no svix headers', { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Get the Svix webhook secret from environment variables
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('Clerk Webhook Error: CLERK_WEBHOOK_SECRET environment variable not set.');
    return new Response('Error occured -- webhook secret not configured', { status: 500 });
  }

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Clerk Webhook Error: Could not verify webhook signature:', err);
    return new Response('Error occured -- invalid signature', { status: 400 });
  }

  // --- Handle the user.created event ---
  const eventType = evt.type;
  if (eventType === 'user.created') {
    const { id: userId, email_addresses } = evt.data;
    console.log(`Received user.created webhook for userId: ${userId}`);

    // Construct the initial data for the new user document
    const initialUserData = {
      createdAt: Date.now(),
      email: email_addresses?.[0]?.email_address ?? null,
      quota: DEFAULT_USER_QUOTA,
      settings: DEFAULT_USER_SETTINGS,
      apiKeyHash: null, // Explicitly set apiKeyHash to null initially
      // Add any other essential default fields for a new user
    };

    const userRef = db.collection('users').doc(userId);

    try {
      // Use set without merge to create the document - expects it not to exist
      await userRef.set(initialUserData);
      console.log(`Successfully created Firestore document for new user: ${userId}`);
    } catch (error) {
      console.error(`Error creating Firestore document for user ${userId}:`, error);
      // Return 500 so Clerk might retry the webhook if configured
      return new Response('Error occured -- failed to create user document in Firestore', { status: 500 });
    }
  } else {
    console.log(`Received Clerk webhook event: ${eventType}, skipping processing.`);
  }
  // --- End event handling ---

  // Acknowledge receipt of the webhook
  return new Response('', { status: 200 });
} 