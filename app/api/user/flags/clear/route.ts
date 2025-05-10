import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/firestore';
import { FieldValue } from '@google-cloud/firestore';

interface ClearFlagRequestBody {
  flagName: string;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let body: ClearFlagRequestBody;
  try {
    body = await request.json();
  } catch (e) {
    return new NextResponse(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { flagName } = body;
  if (!flagName || typeof flagName !== 'string') {
    return new NextResponse(JSON.stringify({ error: "Invalid or missing flagName" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const userRef = db.collection('users').doc(userId);

  try {
    // Use dot notation to update a specific field within the flags map
    // Setting to false, or could use FieldValue.delete() to remove it
    const updatePath = `flags.${flagName}`;
    await userRef.update({ [updatePath]: false });
    // Alternatively, to ensure the flags map itself exists, or if deleting:
    // await userRef.set({ flags: { [flagName]: FieldValue.delete() } }, { mergeFields: [`flags.${flagName}`] });
    // For setting to false, update is fine if 'flags' map is generally expected to exist.

    console.log(`[API ClearFlag] Cleared flag '${flagName}' for user ${userId}`);
    return NextResponse.json({ success: true, message: `Flag '${flagName}' cleared.` });

  } catch (error: any) {
    console.error(`[API ClearFlag] Error clearing flag '${flagName}' for user ${userId}:`, error);
    return new NextResponse(JSON.stringify({ error: 'Failed to clear flag.', details: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
} 