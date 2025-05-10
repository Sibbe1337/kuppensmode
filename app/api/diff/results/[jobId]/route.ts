import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import fs from 'fs/promises';
import path from 'path';
// Assuming SemanticDiffResult and related types might be shared or defined here/imported

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

interface SemanticDiffResult {
    summary: {
        added: number;
        deleted: number;
        contentHashChanged: number;
        semanticallySimilar: number;
        semanticallyChanged: number;
    };
    details?: {
        addedItems: { id: string; name?: string; type?: string; blockType?: string }[];
        deletedItems: { id: string; name?: string; type?: string; blockType?: string }[];
        changedItems: ChangedItemDetail[];
    };
    error?: string;
    message?: string;
    // Include original snapshot IDs for context
    snapshotIdFrom?: string;
    snapshotIdTo?: string;
}

const getDemoDataPath = (fileName: string) => {
  return path.join(process.cwd(), 'demo-data', fileName);
};

interface DiffResultParams {
  params: {
    jobId: string;
  };
}

export async function GET(request: Request, { params }: DiffResultParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = params;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  console.log(`[API Diff Results] User: ${userId} requested results for job: ${jobId}`);

  // TODO: In a real implementation, fetch the stored diff result for this jobId from Firestore.
  // For now, return the content of demo-data/analytics_compare.json as a placeholder structure.
  try {
    const compareDataString = await fs.readFile(getDemoDataPath('analytics_compare.json'), 'utf-8');
    const demoCompareData = JSON.parse(compareDataString);

    // Adapt the demo data to the SemanticDiffResult structure
    const result: SemanticDiffResult = {
        snapshotIdFrom: demoCompareData.fromSnapshot.id,
        snapshotIdTo: demoCompareData.toSnapshot.id,
        summary: {
            added: demoCompareData.added || 0,
            deleted: Math.abs(demoCompareData.removed || 0), // Assuming removed is stored as negative
            contentHashChanged: (demoCompareData.modified || 0) + (demoCompareData.added || 0) + Math.abs(demoCompareData.removed || 0), // Example
            semanticallySimilar: 0, // Placeholder
            semanticallyChanged: 0, // Placeholder
        },
        details: {
            addedItems: demoCompareData.added > 0 ? [{id: 'added_item_1', name: 'New Demo Page', type: 'page'}] : [],
            deletedItems: demoCompareData.removed < 0 ? [{id: 'deleted_item_1', name: 'Old Demo Section', type: 'block'}] : [],
            changedItems: demoCompareData.modified > 0 ? [{
                id: 'changed_item_1',
                name: 'Updated Project Plan',
                itemType: 'page',
                changeType: 'pending_semantic_check',
            }] : [],
        },
        message: `Displaying mock diff results for job ${jobId}. Based on demo data.`
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API Diff Results] Error fetching/mocking diff results:", error);
    return NextResponse.json({ error: "Failed to retrieve diff results.", details: error.message }, { status: 500 });
  }
} 