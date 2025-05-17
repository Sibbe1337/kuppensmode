import { http, Request, Response } from '@google-cloud/functions-framework';
import { db } from '../lib/firestore'; // Adjust path to your firestore lib
import { Timestamp } from '@google-cloud/firestore';

interface AddUserQuery {
  userId?: string;
  token?: string;
  email?: string;
  name?: string;
}

/**
 * HTTP Cloud Function to add/update a test user in Firestore.
 * Query params: userId, token, email (optional), name (optional)
 */
export const addTestUser = http('addTestUser', async (req: Request, res: Response) => {
  const mainFunctionName = 'addTestUser';
  console.log(`${mainFunctionName}: Received request.`);

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed. Use POST.');
  }

  const { 
    userId = `test-user-${Date.now()}`,
    token = 'YOUR_DEFAULT_TEST_NOTION_TOKEN', // IMPORTANT: Replace or expect via param
    email = `${userId}@example.com`,
    name = `Test User ${userId}` 
  } = (req.body ?? {}) as AddUserQuery;

  if (!userId || !token || token === 'YOUR_DEFAULT_TEST_NOTION_TOKEN') {
    console.error(`${mainFunctionName}: Missing required POST body params: userId and token (and ensure default token is replaced).`);
    return res.status(400).send('Missing required POST body params: userId and token. Provide them in the JSON request body.');
  }

  try {
    const userDocRef = db.collection('users').doc(userId);
    
    const userData = {
      email: email,
      name: name,
      notionAccessToken: token,
      clerkId: `test_clerk_id_${userId}`,
      createdAt: (await userDocRef.get()).exists
        ? (await userDocRef.get()).data()?.createdAt
        : Timestamp.now(),
      updatedAt: Timestamp.now(),
      plan: 'free', // Default to free plan for testing
      // Add any other fields your snapshot worker might expect
    };

    await userDocRef.set(userData, { merge: true });

    console.log(`${mainFunctionName}: User document for ${userId} created/updated successfully.`);
    res.status(200).send({ 
      message: `User ${userId} created/updated successfully.`, 
      userId: userId,
      userData 
    });

  } catch (error: unknown) {
    console.error(`${mainFunctionName}: Error creating/updating user ${userId}:`, error);
    res.status(500).json({
      error: 'internal',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}); 