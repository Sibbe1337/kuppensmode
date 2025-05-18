import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getDb } from "@/lib/firestore"; // Changed to getDb
import { FieldValue } from '@shared/firestore';
import { v4 as uuidv4 } from 'uuid';
// For a real implementation, you'd use a crypto library for hashing
// import crypto from 'crypto'; 

// Placeholder for actual API key generation and hashing
async function generateAndHashApiKey(): Promise<{ apiKey: string, hashedApiKey: string }> {
  const apiKey = `nl_sk_new_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 15)}`;
  // In a real app, use a strong hashing algorithm like bcrypt or argon2
  // const hashedApiKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  const hashedApiKey = `hashed_${apiKey}`; // Placeholder hash
  return { apiKey, hashedApiKey };
}

export async function POST(request: Request) {
  const db = getDb(); // Get instance here
  const { userId } = getAuth(request as any);
  try {
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    console.log(`Regenerating API key for user: ${userId}`);

    const { apiKey: newApiKey, hashedApiKey: newApiKeyHash } = await generateAndHashApiKey();
    
    await db.collection('users').doc(userId).update({ 
      apiKeyHash: newApiKeyHash,
      apiKeyLastGeneratedAt: new Date() // Optional: track when it was last generated
    });

    console.log(`Successfully regenerated and stored API key hash for user ${userId}`);

    // Return the *new* raw API key to the user just this once.
    return NextResponse.json({ success: true, apiKey: newApiKey });

  } catch (error) {
    console.error("Error regenerating API key:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 