import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server'; // Or 'any' if WebhookEvent causes issues
import { getDb } from '@/lib/firestore';
import { NextResponse } from 'next/server'; // NextRequest might not be needed if req is just 'Request'
import type { UserSettings, UserQuota } from '@/types/user';
import { DEFAULT_USER_SETTINGS, DEFAULT_USER_QUOTA } from '@/config/defaults';
import { FieldValue } from '@shared/firestore';

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(req: Request) {
  const db = getDb();

  if (!WEBHOOK_SECRET) {
    console.error('Clerk Webhook Error: CLERK_WEBHOOK_SECRET environment variable not set.');
    return new Response('Error occured -- webhook secret not configured', { status: 500 });
  }

  const svix_id = headers().get("svix-id");
  const svix_timestamp = headers().get("svix-timestamp");
  const svix_signature = headers().get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('Clerk Webhook Error: Missing svix headers');
    return new Response('Error occured -- no svix headers', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err:any) {
    console.error('Clerk Webhook Error: Could not verify webhook signature:', err.message);
    return new Response('Error occured -- invalid signature', { status: 400 });
  }

  const eventType = evt.type;
  if (eventType === 'user.created') {
    const { id: userId, email_addresses, first_name, last_name, image_url, created_at } = evt.data;
    console.log(`Received user.created webhook for userId: ${userId}`);

    const initialUserData = {
      createdAt: created_at ? new Date(created_at) : new Date(),
      email: email_addresses?.[0]?.email_address ?? null,
      quota: DEFAULT_USER_QUOTA,
      settings: DEFAULT_USER_SETTINGS,
      apiKeyHash: null,
      firstName: first_name ?? null,
      lastName: last_name ?? null,
      profileImageUrl: image_url ?? null,
      clerkId: userId,
    };

    const userRef = db.collection('users').doc(userId);
    try {
      await userRef.set(initialUserData);
      console.log(`Successfully created Firestore document for new user: ${userId}`);
    } catch (error) {
      console.error(`Error creating Firestore document for user ${userId}:`, error);
      return new Response('Error occured -- failed to create user document in Firestore', { status: 500 });
    }
  } else {
    console.log(`Received Clerk webhook event: ${eventType}, skipping processing.`);
  }
  return new Response('', { status: 200 });
} 