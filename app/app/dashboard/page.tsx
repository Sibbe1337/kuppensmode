import React from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import SnapshotList from './snapshot-list'; // Import the client component

// TODO: Define type for snapshot data (could be moved to a shared types file)
interface Snapshot {
  pageId: string;
  timestamp: string;
}

async function getSnapshots(): Promise<Snapshot[]> {
  console.log('Dashboard page attempting to fetch snapshots...');
  // In a Server Component, we might fetch directly or call our API route.
  // Calling the API route keeps fetch logic centralized.
  // NOTE: This requires the app to be running or deployed.

  // Example of calling the API route (needs absolute URL or fetch wrapper)
  try {
    // Needs full URL in server components if calling own API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; 
    const res = await fetch(`${baseUrl}/api/snapshots`, {
      cache: 'no-store', // Don't cache snapshot list
      // Clerk's auth() provides server-side context, no header needed here
    });
    if (!res.ok) {
      console.error(`Error fetching snapshots: ${res.status} ${res.statusText}`);
      const errorBody = await res.text();
      console.error('Error body:', errorBody);
      return []; // Return empty on error for now
    }
    const data = await res.json();
    return data.snapshots || [];
  } catch (error) {
    console.error('Error fetching /api/snapshots:', error);
    return [];
  }

  // Placeholder:
  // console.log('getSnapshots: Returning empty array for now.');
  // return []; 
}

export default async function DashboardPage() {
  const { userId } = auth();

  if (!userId) {
    // This shouldn't strictly be necessary if middleware protects the route,
    // but acts as a safeguard.
    console.warn('Dashboard accessed without userId, redirecting to sign-in.');
    redirect('/sign-in');
  }

  console.log(`Dashboard accessed by userId: ${userId}`);

  // Fetch snapshots server-side
  const snapshots = await getSnapshots();

  // Get restore function URL (could also be from env vars)
  const restoreFunctionUrl = process.env.RESTORE_FUNCTION_URL || 'https://restoretrigger-36wqzjn5ka-ey.a.run.app';

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Your Notion Snapshots</h1>
      {/* Render the client component, passing data and URL */}
      <SnapshotList snapshots={snapshots} restoreFunctionUrl={restoreFunctionUrl} />
    </div>
  );
} 