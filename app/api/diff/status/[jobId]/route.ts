import { NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/firestore'; // Changed to getDb
import { Timestamp } from '@shared/firestore';

export const runtime = 'nodejs';

interface DiffStatusParams {
  params: {
    jobId: string;
  };
}

export async function GET(request: Request, { params }: DiffStatusParams) {
  const db = getDb(); // Get instance here
  const { userId } = getAuth(request as any); // Clerk auth
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { jobId } = params;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  console.log(`[API Diff Status] User: ${userId} requested status for job: ${jobId}`);

  try {
    const jobStatusRef = db.collection('users').doc(userId).collection('diffResults').doc(jobId);
    const docSnap = await jobStatusRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ jobId, status: 'not_found', message: 'Job not found or not yet initiated.' });
    }

    const data = docSnap.data();
    const status = data?.status || 'unknown';
    let message = data?.message || '';
    let resultUrl: string | undefined = undefined;

    if (status === 'pending' || status === 'processing') {
      message = message || (status === 'pending' ? 'Job is queued.' : 'Comparison is in progress.');
    } else if (status === 'complete') {
      message = message || 'Comparison complete. Results are ready.';
      // Construct result URL based on the jobId, assuming /api/diff/results/[jobId] exists
      resultUrl = `/api/diff/results/${jobId}`;
    } else if (status === 'error') {
      message = `Job failed: ${data?.error || 'Unknown error'}`;
    }

    return NextResponse.json({ 
      jobId: jobId, 
      status: status,
      message: message,
      resultUrl: resultUrl,
      updatedAt: (data?.updatedAt as Timestamp)?.toDate()?.toISOString() || new Date(0).toISOString()
    });

  } catch (error: any) {
    console.error(`[API Diff Status] Error fetching status for job ${jobId}:`, error);
    return NextResponse.json({ error: "Failed to get job status.", details: error.message }, { status: 500 });
  }
} 