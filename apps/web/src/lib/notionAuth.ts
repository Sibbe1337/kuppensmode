import { getDb } from '@/lib/firestore';

/**
 * Fetches a user-specific Notion access token from Firestore.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<string | null>} The access token, or null if not found or an error occurs.
 */
export async function getNotionAccessToken(userId: string): Promise<string | null> {
  if (!userId) {
    console.error("getNotionAccessToken: userId is required.");
    return null;
  }

  const db = getDb();
  try {
    const userDocRef = db.collection('users').doc(userId).collection('linkedAccounts').doc('notion');
    const doc = await userDocRef.get();
    if (doc.exists && doc.data()?.accessToken) {
      return doc.data()?.accessToken as string;
    } else {
      console.log("Notion access token not found for user:", userId);
      return null;
    }
  } catch (error) {
    console.error("Error fetching notion access token:", error);
    return null;
  }
} 