import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
// import { db } from '@/lib/firestore'; // For actual status checking

export const runtime = 'nodejs';

interface DiffStatusParams {
  params: {
    jobId: string;
  };
}

// Mock in-memory store for job statuses for demo purposes
const jobStatuses: Record<string, { status: string; attempts: number; resultUrl?: string; message?: string; snapshotIdFrom?: string; snapshotIdTo?: string; }> = {};

// This would be populated by POST /api/diff/run (if it stored job details)
// For demo, we are not storing it from the POST yet.

export async function GET(request: Request, { params }: DiffStatusParams) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = params;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  console.log(`[API Diff Status] User: ${userId} requested status for job: ${jobId}`);

  // Initialize status if not seen before (simple mock)
  if (!jobStatuses[jobId]) {
    // In a real app, POST /api/diff/run would create this entry
    jobStatuses[jobId] = { status: 'pending', attempts: 0, snapshotIdFrom: 'mockFromId', snapshotIdTo: 'mockToId' };
  }

  const job = jobStatuses[jobId];
  job.attempts++;

  // Simulate status progression for demo
  if (job.status === 'pending' && job.attempts > 2) {
    job.status = 'processing';
    job.message = 'Comparison is currently in progress.';
  } else if (job.status === 'processing' && job.attempts > 5) {
    job.status = 'complete';
    job.message = 'Comparison complete. Results are ready.';
    // The actual result for this job ID would be fetched from /api/diff/results/[jobId]
    // or by using from/to IDs if the status endpoint knew them.
    job.resultUrl = `/api/diff/${job.snapshotIdFrom}/${job.snapshotIdTo}`; // Example using stored IDs
  }

  return NextResponse.json({ 
    jobId: jobId, 
    status: job.status,
    message: job.message,
    resultUrl: job.resultUrl,
    // snapshotIdFrom: job.snapshotIdFrom, // Optionally return these for the client
    // snapshotIdTo: job.snapshotIdTo
  });
} 