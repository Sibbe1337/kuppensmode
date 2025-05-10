export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { faker } from '@faker-js/faker';

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
  console.log(`[Demo API] Received GET for: ${slugPath}`);

  try {
    let data;
    let rawJsonString;
    switch (slugPath) {
      case 'snapshots':
        rawJsonString = await fs.readFile(getDemoDataPath('snapshots.json'), 'utf-8');
        data = JSON.parse(rawJsonString).map((snapshot: any) => ({
          ...snapshot,
          // Randomize timestamp to be within the last 7 days, keeping time of day somewhat consistent if possible
          timestamp: faker.date.recent({ days: 7 }).toISOString(),
        }));
        // Sort by new timestamp descending
        data.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        break;
      case 'restores':
        rawJsonString = await fs.readFile(getDemoDataPath('restores.json'), 'utf-8');
        data = JSON.parse(rawJsonString).map((restore: any) => ({
          ...restore,
          requestedAt: faker.date.recent({ days: 3 }).toISOString(),
          updatedAt: faker.date.recent({ days: 1 }).toISOString(), 
        }));
        data.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
      // New analytics endpoints for demo mode
      case 'analytics/kpis':
        data = JSON.parse(await fs.readFile(getDemoDataPath('analytics_kpis.json'), 'utf-8'));
        break;
      case 'analytics/compare':
        data = JSON.parse(await fs.readFile(getDemoDataPath('analytics_compare.json'), 'utf-8'));
        break;
      case 'analytics/latest':
        // Randomize lastUpdated for latest analytics if it were part of this file
        data = JSON.parse(await fs.readFile(getDemoDataPath('analytics_latest.json'), 'utf-8'));
        break;
      case 'status': // Added demo data for /api/status as well
        data = {
          "status": "operational",
          "backupSuccessRate": faker.number.float({ min: 98, max: 99.9, fractionDigits: 1 }),
          "totalPagesStored": faker.number.int({ min: 12000, max: 15000 }),
          "lastUpdated": faker.date.recent({ days: 0.2 }).toISOString() // More recent for status
        };
        break;
      case 'snapshots/demo_snap_1/content': 
      case 'snapshots/demo_snap_2/content':
      case 'snapshots/demo_snap_3/content':
        data = {
            items: [
                { id: 'page1', name: 'Demo Page Alpha (from snap content)', type: 'page' },
                { id: 'db1', name: 'Demo Database Tasks (from snap content)', type: 'database' },
            ]
        };
        break;
      default:
        return NextResponse.json({ error: `Demo data not found for GET: ${slugPath}` }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`[Demo API] Error serving GET ${slugPath}:`, error);
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: `Demo data file not found for GET: ${slugPath}` }, { status: 404 });
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
  
  if (slugPath === 'snapshots/create') {
    const newSnapshotId = `demo_snap_optimistic_${Date.now()}`;
    // Create a somewhat realistic, small diff against the "latest" known demo snapshot
    const diffSummary = {
      added: faker.number.int({ min: 0, max: 3 }),
      removed: faker.number.int({ min: 0, max: 1 }),
      changed: faker.number.int({ min: 1, max: 4 }),
      previousSnapshotId: "demo_snap_3_actual" // Assuming this is the latest in static demo data
    };
    return NextResponse.json({ 
      success: true, 
      message: "Demo snapshot process initiated (mocked).", 
      snapshotId: newSnapshotId, // The optimistic ID for client to track
      // To make the demo more realistic, the client would get this actual data on re-fetch
      // For now, the client-side optimistic update will just use this diff.
      diffSummary: diffSummary 
    });
  }
  if (slugPath === 'restore') {
    return NextResponse.json({ success: true, message: "Demo restore process initiated (mocked).", restoreId: `demo_restore_${Date.now()}` });
  }

  return NextResponse.json({ success: true, message: `Demo POST to ${slugPath} received.` });
} 