import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
// This route would likely call the same underlying diff logic as /api/diff/semantic
// or fetch a pre-computed diff result based on the two snapshot IDs.

export const runtime = 'nodejs';

interface DiffResultParams {
  params: {
    snapshotIdFrom: string;
    snapshotIdTo: string;
  };
}

export async function GET(request: Request, { params }: DiffResultParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { snapshotIdFrom, snapshotIdTo } = params;

  if (!snapshotIdFrom || !snapshotIdTo) {
    return NextResponse.json({ error: 'Missing snapshot IDs in path' }, { status: 400 });
  }

  console.log(`[API Diff Get] User: ${userId} requested diff result between ${snapshotIdFrom} and ${snapshotIdTo}`);

  // TODO: Fetch pre-computed diff from Firestore (e.g., written by a diff worker)
  // or call a shared diffing service/logic.
  // For now, returning a simplified mock summary.

  const mockDiffSummary = {
    added: Math.floor(Math.random() * 5),
    deleted: Math.floor(Math.random() * 3),
    contentHashChanged: Math.floor(Math.random() * 10),
    semanticallySimilar: Math.floor(Math.random() * 2),
    semanticallyChanged: Math.floor(Math.random() * 2),
    message: "This is a placeholder diff result. Full diff view upcoming."
  };

  return NextResponse.json(mockDiffSummary);
} 