import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getDb } from "@/lib/firestore";

// Define the structure for activation status
export interface ActivationStatus {
  connectedNotion: boolean;
  createdFirstBackup: boolean;
  initiatedFirstRestore: boolean;
}

const DEFAULT_ACTIVATION_STATUS: ActivationStatus = {
  connectedNotion: false,
  createdFirstBackup: false,
  initiatedFirstRestore: false,
};

export async function GET(request: Request) {
  const db = getDb();
  const { userId } = getAuth(request as any);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const userDocRef = db.collection('users').doc(userId);

  try {
    const doc = await userDocRef.get();
    if (!doc.exists) {
      // If user doc doesn't exist, return default status 
      // (shouldn't happen if other routes create user doc, but good practice)
      console.warn(`[Activation Status] User doc ${userId} not found, returning default.`);
      return NextResponse.json(DEFAULT_ACTIVATION_STATUS);
    }
    
    const activationData = doc.data()?.activation;
    
    // Return existing activation data or default if it doesn't exist yet
    const statusToReturn = activationData 
      ? { ...DEFAULT_ACTIVATION_STATUS, ...activationData } 
      : DEFAULT_ACTIVATION_STATUS;
      
    return NextResponse.json(statusToReturn);

  } catch (error) {
    console.error(`GET /api/user/activation-status error for user ${userId}:`, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 