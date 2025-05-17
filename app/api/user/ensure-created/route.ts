import { NextResponse } from 'next/server';
import { getAuth, clerkClient, type EmailAddress } from '@clerk/nextjs/server';
import { getDb } from "@/lib/firestore";
import { FieldValue } from '@google-cloud/firestore';

// Default activation status - can be imported if shared
const DEFAULT_ACTIVATION_STATUS = {
  connectedNotion: false,
  createdFirstBackup: false,
  initiatedFirstRestore: false,
};

export async function POST(request: Request) {
  const db = getDb();
  const { userId } = getAuth(request as any);

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userDocRef = db.collection('users').doc(userId);

  try {
    const docSnap = await userDocRef.get();

    if (!docSnap.exists) {
      console.log(`[Ensure User] User doc ${userId} not found. Creating now.`);
      
      let userEmail = null;
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        if (clerkUser && clerkUser.emailAddresses.length > 0) {
          const primaryEmail = clerkUser.emailAddresses.find((ea: EmailAddress) => ea.id === clerkUser.primaryEmailAddressId);
          userEmail = primaryEmail?.emailAddress || 
                      clerkUser.emailAddresses.find((ea: EmailAddress) => ea.verification?.status === 'verified')?.emailAddress || 
                      clerkUser.emailAddresses[0]?.emailAddress;
        }
      } catch (clerkError) {
        console.error(`[Ensure User] Failed to fetch user details from Clerk for ${userId}:`, clerkError);
      }

      const newUserDefaults = {
        clerkUserId: userId,
        email: userEmail,
        createdAt: FieldValue.serverTimestamp(),
        activation: DEFAULT_ACTIVATION_STATUS,
        plan: 'free',
      };

      await userDocRef.set(newUserDefaults);
      console.log(`[Ensure User] Successfully created user doc ${userId} with email: ${userEmail}`);
      return NextResponse.json({ status: 'created', userId, data: newUserDefaults }, { status: 201 });
    } else {
      console.log(`[Ensure User] User doc ${userId} already exists.`);
      return NextResponse.json({ status: 'exists', userId, data: docSnap.data() }, { status: 200 });
    }
  } catch (error: any) {
    console.error(`POST /api/user/ensure-created error for user ${userId}:`, error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
} 