'use client';

import React, { useState, useTransition } from 'react';
import { useAuth } from '@clerk/nextjs'; // Import useAuth to get token

// Type definition (can be shared or defined here)
interface Snapshot {
  pageId: string;
  timestamp: string;
}

interface SnapshotListProps {
  snapshots: Snapshot[];
  restoreFunctionUrl: string;
}

export default function SnapshotList({ snapshots, restoreFunctionUrl }: SnapshotListProps) {
  const { getToken } = useAuth(); // Clerk hook to get JWT
  const [restoringKey, setRestoringKey] = useState<string | null>(null); // Key of item actively being restored via API call
  const [queuedKeys, setQueuedKeys] = useState<Set<string>>(new Set()); // Keys of successfully queued jobs
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRestore = async (pageId: string, timestamp: string) => {
    const restoreKey = `${pageId}-${timestamp}`;
    setRestoringKey(restoreKey);
    setError(null);
    // Don't clear queuedKeys here

    startTransition(async () => {
      console.log(`Attempting to restore page ${pageId} from snapshot ${timestamp}...`);
      try {
        const token = await getToken(); // Get Clerk JWT
        if (!token) {
          throw new Error('Authentication token not available.');
        }

        const response = await fetch(restoreFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Add token to header
          },
          body: JSON.stringify({ pageId, timestamp }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
          throw new Error(errorData.error || `Restore failed with status: ${response.status}`);
        }

        const result = await response.json().catch(() => ({})); 
        console.log('Restore request successful:', result);
        // Add to queued set on success
        setQueuedKeys(prev => new Set(prev).add(restoreKey)); 

      } catch (err: any) {
        console.error('Error calling restore function:', err);
        setError(err.message || 'An unknown error occurred during restore.');
      }
      finally {
        setRestoringKey(null); // Clear active restoring state regardless of outcome
      }
    });
  };

  if (snapshots.length === 0) {
    return <p>No snapshots found yet. Snapshots are taken automatically every 6 hours.</p>;
  }

  return (
    <div>
      {error && <p className="text-red-500 mb-4">Error: {error}</p>}
      <ul className="space-y-2">
        {snapshots.map((snapshot) => {
          const currentKey = `${snapshot.pageId}-${snapshot.timestamp}`;
          const isActiveRestore = restoringKey === currentKey;
          const isQueued = queuedKeys.has(currentKey);
          // Disable if actively restoring OR if successfully queued
          const isButtonDisabled = isActiveRestore || isQueued || isPending; 
          
          let buttonText = 'Restore';
          if (isActiveRestore) {
            buttonText = 'Restoring...';
          } else if (isQueued) {
            buttonText = 'Restore Queued';
          }

          return (
            <li key={currentKey} className="p-2 border rounded flex justify-between items-center">
              <span>
                Page ID: {snapshot.pageId} - Snapshot Time: {new Date(snapshot.timestamp).toLocaleString()}
              </span>
              <button
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handleRestore(snapshot.pageId, snapshot.timestamp)}
                disabled={isButtonDisabled}
              >
                {buttonText}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
} 