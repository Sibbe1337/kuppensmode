import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/firestore'; // Use the central Firestore utility
import { FieldValue } from '@google-cloud/firestore'; // Corrected import for FieldValue

export async function DELETE(request: NextRequest) {
  const authResult = await auth();
  const userId = authResult.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  console.log(`Disconnecting Notion for user: ${userId}`);

  const userDocRef = db.collection('users').doc(userId);

  // --- Ensure parent user document exists ---
  const userSnap = await userDocRef.get();
  if (!userSnap.exists) {
    // create a shell doc so later updates don't fail
    await userDocRef.set({ notionConnected: false }, { merge: true });
  }
  // --- End ensure parent doc ---

  // Parent document is now guaranteed to exist.
  // Proceed to check/delete integration doc.
  const notionDocRef = userDocRef.collection('integrations').doc('notion');
  console.log(`[Notion-disconnect] Attempting to delete path: ${notionDocRef.path}`);

  try {
    const notionSnap = await notionDocRef.get();
    const updateData: { [key: string]: any } = {
      'settings.notionConnected': false,
      'settings.notionWorkspaceId': FieldValue.delete(),
      'settings.notionWorkspaceName': FieldValue.delete(),
      'settings.notionWorkspaceIcon': FieldValue.delete(),
      notionAccessDetails: FieldValue.delete(),
      notionAccessToken: FieldValue.delete(),
      notionWorkspaceId: FieldValue.delete(),
      notionWorkspaceName: FieldValue.delete(),
      notionWorkspaceIcon: FieldValue.delete(),
    };

    if (notionSnap.exists) {
      await notionDocRef.delete();
      console.log(`[Notion-disconnect] Successfully deleted ${notionDocRef.path}`);
      await userDocRef.update(updateData);
      console.log(`[Notion-disconnect] Successfully updated user ${userId} notionConnected status and cleared details.`);
      return NextResponse.json({ success: true, message: "Notion integration disconnected." });
    } else {
      console.log(`[Notion-disconnect] Integration document ${notionDocRef.path} not found. No action needed.`);
      await userDocRef.update(updateData);
      console.log(`[Notion-disconnect] Ensured user ${userId} notionConnected status is false and cleared details.`);
      return NextResponse.json({ success: true, message: "Notion integration not found, user status updated." });
    }
  } catch (error) {
    console.error(`[Notion-disconnect] Error deleting Notion integration for user ${userId}:`, error);
    return NextResponse.json({ error: 'Failed to disconnect Notion integration' }, { status: 500 });
  }
} 