import { Webhook } from 'svix';
import { buffer } from 'micro'; // micro is often used with Next.js API routes for body parsing
import { db } from '@/lib/firestore'; // Assuming your Firestore instance is exported from here
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// Make sure to set CLERK_WEBHOOK_SECRET in your environment variables
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET is not set.');
    return NextResponse.json({ error: 'Internal server error: Webhook secret not configured.' }, { status: 500 });
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 });
  }

  // Get the body
  const payload = await req.json(); // Clerk sends JSON payload
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: any; // Use `any` or define a more specific type for ClerkWebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as any; // Cast to `any` or your defined event type
  } catch (err: any) {
    console.error('Error verifying webhook:', err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  // Handle the user.created event
  if (evt.type === 'user.created') {
    const { id, first_name, last_name, email_addresses, image_url, created_at } = evt.data;
    
    if (!id) {
        console.error('User ID missing in user.created event');
        return NextResponse.json({ error: 'User ID missing' }, { status: 400 });
    }

    try {
      await db.doc(`users/${id}`).set(
        {
          clerkId: id,
          email: email_addresses?.[0]?.email_address, // Primary email
          firstName: first_name,
          lastName: last_name,
          profileImageUrl: image_url,
          createdAt: new Date(created_at), // Clerk provides ISO string, convert to Firestore Timestamp or JS Date
          notionConnected: false,
          // Add any other default fields you need for a new user
        },
        { merge: true } // Use merge:true to make it idempotent
      );
      console.log(`Successfully created user document for ${id}`);
    } catch (error) {
      console.error(`Error creating user document for ${id}:`, error);
      // Consider how you want to handle Firestore errors. 
      // For now, just log and return 500. You might want retry logic or alerting.
      return NextResponse.json({ error: 'Failed to create user document in Firestore.' }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true }, { status: 200 });
}

// Optional: Add a GET handler for testing or other purposes if needed
// export async function GET() {
//   return NextResponse.json({ message: "Clerk Webhook Endpoint" });
// } 