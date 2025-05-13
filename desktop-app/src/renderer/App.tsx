import React, { useEffect, useState, useRef } from 'react';
import posthog from 'posthog-js';

// --- MOVED TO TOP LEVEL ---
declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, payload?: any) => void;
      receive: (channel: string, func: (...args: any[]) => void) => (() => void) | undefined;
      getSnapshots: () => Promise<Snapshot[]>;
      createTestSnapshot: () => Promise<{ success: boolean; error?: string }>;
      getSnapshotDownloadUrl?: (snapshotId: string) => Promise<{ url?: string; error?: string }>;
    };
  }
}

type Snapshot = {
  id: string;
  name?: string;
  createdAt?: string;
  // Add any other relevant snapshot properties you expect from the backend
  size?: number; // Example: size in bytes
  pageCount?: number; // Example
};

// Initialize PostHog (do this once)
// IMPORTANT: Replace with your actual PostHog API key and instance address
if (typeof window !== 'undefined') { // Ensure this only runs in the renderer
  posthog.init('phx_MNRROjJaQ2CriSfhevHhFzVNEQSal9B0IoQjiMQfrDxaRO6', {
    api_host: 'https://app.posthog.com', // e.g., 'https://app.posthog.com' or your self-hosted address
    capture_pageview: false, // We'll capture custom events
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') {
        ph.opt_in_capturing(); // Opt-in for development, ensure user opts-in for production
      }
    }
  });
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Date N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch (e) {
    return 'Invalid Date';
  }
}

function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return 'Size N/A';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
// --- END MOVED TO TOP LEVEL ---

function App() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("");
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' }>({ message: "", type: 'info' });
  const [isLoading, setIsLoading] = useState(false);

  // Refs to track timing
  const snapshotListRenderedTime = useRef<number | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setStatus({ message: 'Fetching snapshots...', type: 'info' });
    
    let unsubscribeRestore: (() => void) | undefined;

    window.electronAPI?.getSnapshots?.()
      .then((snaps) => {
        setSnapshots(snaps || []);
        setStatus({ message: (snaps && snaps.length > 0) ? "" : "No snapshots found.", type: 'info' });
        if (snaps && snaps.length > 0) {
          snapshotListRenderedTime.current = Date.now(); // Record time when options are available
        }
      })
      .catch(err => {
        console.error("Error fetching snapshots:", err);
        setStatus({ message: 'Failed to load snapshots.', type: 'error' });
        posthog.capture('snapshot_fetch_failed', { error: err.message });
      })
      .finally(() => {
        setIsLoading(false);
      });

    if (window.electronAPI && typeof window.electronAPI.receive === 'function') {
      unsubscribeRestore = window.electronAPI.receive('restore-result', (result: any) => {
        setIsLoading(false);
        if (result.success) {
          setStatus({ message: result.message || 'Restore initiated successfully!', type: 'success' });
          posthog.capture('restore_success', { snapshot_id: selectedSnapshotId });
        } else {
          setStatus({ message: `Restore failed: ${result.message || 'Unknown error'}`, type: 'error' });
          posthog.capture('restore_failed', { snapshot_id: selectedSnapshotId, error_message: result.message });
        }
      });
    }

    return () => {
      if (typeof unsubscribeRestore === 'function') {
        unsubscribeRestore();
      }
    };
  }, []); // selectedSnapshotId removed from deps to avoid re-triggering PostHog events excessively

  const handleRestore = () => {
    if (!selectedSnapshotId) {
      setStatus({ message: 'Please select a snapshot to restore.', type: 'error' });
      return;
    }

    let timeToSelectMs = null;
    if (snapshotListRenderedTime.current) {
      timeToSelectMs = Date.now() - snapshotListRenderedTime.current;
    }

    posthog.capture('snapshot_selection_initiated', {
      snapshot_id_selected: selectedSnapshotId,
      time_to_select_ms: timeToSelectMs,
      number_of_options_available: snapshots.length
    });

    setIsLoading(true);
    setStatus({ message: 'Preparing restore...', type: 'info' });
    window.electronAPI?.send('restore-latest', { snapshotId: selectedSnapshotId });
  };

  const selectedSnap = snapshots.find(s => s.id === selectedSnapshotId);

  return (
    <div className="app-container">
      <div className="content-card">
        <h1 className="header-main">PageLifeline Desktop</h1>
        <p className="sub-header">
          Select a snapshot to restore to your Notion workspace.
        </p>

        <select
          value={selectedSnapshotId}
          onChange={e => {
            setSelectedSnapshotId(e.target.value);
            // Optionally, you could record the time here if you only want to measure dropdown interaction time
            // independent of the restore button click.
          }}
          className="snapshot-select"
          disabled={isLoading || snapshots.length === 0}
        >
          <option value="">— Select Snapshot —</option>
          {snapshots.map(snap => (
            <option key={snap.id} value={snap.id}>
              {snap.name || snap.id} {snap.createdAt ? `(${formatDate(snap.createdAt)})` : ''}
            </option>
          ))}
        </select>

        <button
          style={{
            marginTop: 12,
            marginBottom: 12,
            background: 'var(--color-border)',
            color: 'var(--color-text)',
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 14,
            cursor: 'pointer',
            opacity: 0.8
          }}
          onClick={async () => {
            setStatus({ message: 'Creating test snapshot...', type: 'info' });
            const result = await window.electronAPI?.createTestSnapshot?.();
            if (result?.success) {
              setStatus({ message: 'Test snapshot created! Refreshing...', type: 'success' });
              // Re-fetch snapshots
              const snaps = await window.electronAPI?.getSnapshots?.();
              setSnapshots(snaps || []);
            } else {
              setStatus({ message: `Failed to create test snapshot: ${result?.error || 'Unknown error'}`, type: 'error' });
            }
          }}
        >
          + Create Test Snapshot
        </button>

        {selectedSnap && (
          <div className="snapshot-details">
            <div><b>Name:</b> {selectedSnap.name || selectedSnap.id}</div>
            {selectedSnap.createdAt && (
              <div><b>Created:</b> {formatDate(selectedSnap.createdAt)}</div>
            )}
            {selectedSnap.size !== undefined && (
              <div><b>Size:</b> {formatSize(selectedSnap.size)}</div>
            )}
            {selectedSnap.pageCount !== undefined && (
              <div><b>Pages:</b> {selectedSnap.pageCount}</div>
            )}
            {/* Download Button */}
            <button
              style={{
                marginTop: 10,
                background: 'var(--color-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 14,
                cursor: 'pointer',
                fontWeight: 500
              }}
              onClick={async () => {
                setStatus({ message: 'Generating download link...', type: 'info' });
                const result = await window.electronAPI?.getSnapshotDownloadUrl?.(selectedSnap.id);
                if (result?.url) {
                  setStatus({ message: 'Download started.', type: 'success' });
                  window.open(result.url, '_blank');
                } else {
                  setStatus({ message: `Failed to get download link: ${result?.error || 'Unknown error'}`, type: 'error' });
                }
              }}
            >
              ⬇️ Download Snapshot (.json.gz)
            </button>
          </div>
        )}

        {/* Panic Button for most recent snapshot */}
        {snapshots.length > 0 && (
          <button
            className="btn-restore"
            style={{
              marginTop: 18,
              background: '#d32f2f',
              fontWeight: 700,
              fontSize: 17,
              letterSpacing: 0.5,
              boxShadow: '0 2px 8px rgba(211,47,47,0.10)'
            }}
            onClick={() => {
              const mostRecent = snapshots[0];
              if (mostRecent) {
                setSelectedSnapshotId(mostRecent.id);
                handleRestore();
              }
            }}
            disabled={isLoading}
          >
            🚨 Panic Restore Now!
          </button>
        )}

        <button
          className="btn-restore"
          onClick={handleRestore} // This now triggers the event capture
          disabled={isLoading || !selectedSnapshotId}
        >
          {isLoading && (status.message === 'Preparing restore...' || status.message === 'Restoring...') ? (
            <>
              <span className="spinner" /> {status.message}
            </>
          ) : (
            'Restore Selected Snapshot'
          )}
        </button>

        <p style={{ 
            textAlign: 'center', 
            fontSize: '13px', 
            color: 'var(--color-text)', 
            opacity: 0.7, 
            marginTop: '12px' 
        }}>
          ℹ️ Creates a new copy – your original page stays untouched.
        </p>

        {status.message && status.message !== 'Fetching snapshots...' && (!isLoading || (status.type === 'error' || status.type === 'success')) && (
          <div className={`status-message ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;