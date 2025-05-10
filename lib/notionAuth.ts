import { db } from '@/lib/firestore'; // Assuming db is accessible via this path

/**
 * Fetches a user-specific Notion access token from Firestore.
 * @param userId The ID of the user.
 * @returns The access token string, or null if not found or an error occurs.
 */
export async function getUserNotionAccessToken(userId: string): Promise<string | null> {
  if (!userId) {
    console.error('[notionAuth] getUserNotionAccessToken called without userId.');
    return null;
  }
  console.log(`[notionAuth] Fetching Notion access token for user ${userId}...`);
  try {
    // Path assumes user-specific tokens are stored under their user document
    // in a subcollection 'integrations' with a document named 'notion'.
    const integrationRef = db.collection('users').doc(userId).collection('integrations').doc('notion');
    const doc = await integrationRef.get();
    if (!doc.exists) {
      console.warn(`[notionAuth] Notion integration document not found for user ${userId}.`);
      return null;
    }
    const accessToken = doc.data()?.accessToken;
    if (!accessToken) {
        console.warn(`[notionAuth] Notion access token not found in integration document for user ${userId}.`);
        return null;
    }
    console.log(`[notionAuth] Successfully fetched Notion access token for user ${userId}.`);
    return accessToken;
  } catch (error) {
    console.error(`[notionAuth] Error fetching Notion access token for user ${userId}:`, error);
    return null;
  }
} 