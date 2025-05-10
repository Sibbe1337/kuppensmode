export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Helper to construct the path to the demo data files
// This assumes the demo-data directory is at the root of the project
// and will be bundled with the deployment.
const getDemoDataPath = (fileName: string) => {
  // In Vercel Edge Functions, process.cwd() is the project root.
  return path.join(process.cwd(), 'demo-data', fileName);
};

export async function GET(
  request: Request,
  { params }: { params: { slug: string[] } }
) {
  const slugPath = params.slug.join('/');
  console.log(`[Demo API] Received request for: ${slugPath}`);

  try {
    let data;
    switch (slugPath) {
      case 'snapshots':
        data = JSON.parse(await fs.readFile(getDemoDataPath('snapshots.json'), 'utf-8'));
        break;
      case 'restores': // Assuming there might be an endpoint for this
        data = JSON.parse(await fs.readFile(getDemoDataPath('restores.json'), 'utf-8'));
        break;
      case 'user/quota': {
        const userData = JSON.parse(await fs.readFile(getDemoDataPath('user.json'), 'utf-8'));
        data = userData.quota;
        break;
      }
      case 'user/settings': {
        const userData = JSON.parse(await fs.readFile(getDemoDataPath('user.json'), 'utf-8'));
        data = userData.settings;
        break;
      }
      case 'user/activation-status': {
        const userData = JSON.parse(await fs.readFile(getDemoDataPath('user.json'), 'utf-8'));
        data = userData.activation;
        break;
      }
      // Example for a specific snapshot's content (if needed for preview)
      // The slug would be e.g., 'snapshots/demo_snap_1/content'
      case 'snapshots/demo_snap_1/content': // Fallback for specific demo snapshot
      case 'snapshots/demo_snap_2/content':
      case 'snapshots/demo_snap_3/content':
        // For simplicity, returning a generic content structure
        // In a real scenario, you might have individual content files or more complex logic
        data = {
            items: [
                { id: 'page1', name: 'Demo Page Alpha', type: 'page' },
                { id: 'db1', name: 'Demo Database Tasks', type: 'database' },
                { id: 'page2', name: 'Another Demo Page', type: 'page' },
            ]
        };
        break;
      default:
        return NextResponse.json({ error: `Demo data not found for: ${slugPath}` }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Demo API] Error serving ${slugPath}:`, error);
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: `Demo data file not found for: ${slugPath}` }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to load demo data', details: error.message }, { status: 500 });
  }
}

// Minimal POST handler to accept calls and return success, without actually doing anything
export async function POST(
  request: Request,
  { params }: { params: { slug: string[] } }
) {
  const slugPath = params.slug.join('/');
  console.log(`[Demo API] Received POST for: ${slugPath}`);
  // For demo mode, most POST operations are optimistic client-side.
  // This backend just needs to acknowledge the request.
  // Specific POSTs like creating a snapshot would just return success.
  
  // If it's a snapshot creation for demo
  if (slugPath === 'snapshots/create') {
    return NextResponse.json({ success: true, message: "Demo snapshot process initiated (mocked).", snapshotId: `demo_snap_${Date.now()}` });
  }
  // If it's a restore initiation for demo
  if (slugPath === 'restore') {
    return NextResponse.json({ success: true, message: "Demo restore process initiated (mocked).", restoreId: `demo_restore_${Date.now()}` });
  }

  return NextResponse.json({ success: true, message: `Demo POST to ${slugPath} received.` });
} 