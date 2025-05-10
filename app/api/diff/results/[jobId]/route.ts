import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getDb } from "@/lib/firestore"; // Changed to getDb
import type { SemanticDiffResult } from '@/types/diff'; // Import shared SemanticDiffResult
import { Timestamp } from '@google-cloud/firestore';
// Remove fs and path, as we'll fetch from Firestore now

export const runtime = 'nodejs';

// Define types (can be moved to a shared types file)
interface SemanticDiffRequest {
    userId: string;
    snapshotIdFrom: string;
    snapshotIdTo: string;
}

type ChangedItemDetail = {
    id: string;
    name?: string;
    itemType?: string;
    blockType?: string;
    changeType: 'hash_only_similar' | 'semantic_divergence' | 'pending_semantic_check' | 'no_embeddings_found' | 'structural_change';
    similarityScore?: number;
};

interface DiffResultParams {
  params: {
    jobId: string;
  };
}

export async function GET(request: Request, { params }: DiffResultParams) {
  const db = getDb(); // Get instance here
  const { userId } = getAuth(request as any); // TODO: Verify Clerk auth method here
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = params;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  console.log(`[API Diff Results] User: ${userId} requested results for job: ${jobId}`);

  try {
    const resultDocRef = db.collection('users').doc(userId).collection('diffResults').doc(jobId);
    const docSnap = await resultDocRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: `Diff results for job ${jobId} not found.` }, { status: 404 });
    }

    const resultData = docSnap.data() as SemanticDiffResult;
    // Convert Firestore Timestamps to ISO strings if they exist and are Timestamps
    if (resultData.createdAt && typeof (resultData.createdAt as Timestamp).toDate === 'function') {
      resultData.createdAt = (resultData.createdAt as Timestamp).toDate().toISOString();
    }
    if (resultData.updatedAt && typeof (resultData.updatedAt as Timestamp).toDate === 'function') {
      resultData.updatedAt = (resultData.updatedAt as Timestamp).toDate().toISOString();
    }

    return NextResponse.json(resultData);
    
  } catch (error: any) {
    console.error(`[API Diff Results] Error fetching results for job ${jobId}:`, error);
    return NextResponse.json({ error: "Failed to retrieve diff results.", details: error.message }, { status: 500 });
  }
} 