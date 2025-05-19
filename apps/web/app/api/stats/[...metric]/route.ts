import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: { metric: string[] } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const metricPath = params.metric.join('/');
  console.log(`[API Stats] Requested metric: ${metricPath} for user: ${userId}`);

  // In a real implementation, you would fetch/calculate the specific metric.
  // For now, return a placeholder or a more specific mock based on metricPath.

  let data = {};
  switch (metricPath) {
    case 'snapshots':
      data = { count: 123, delta: '+5%', range: '30d' }; // Example
      break;
    case 'processing-time':
      data = { averageMs: 1200, delta: '-10%' }; // Example
      break;
    case 'datapoints':
      data = { total: 14300, delta: '+200' }; // Example
      break;
    default:
      return NextResponse.json({ error: `Metric '${metricPath}' not found or not implemented.` }, { status: 404 });
  }

  return NextResponse.json(data);
} 