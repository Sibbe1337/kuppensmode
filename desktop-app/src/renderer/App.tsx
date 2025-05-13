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

function parseSnapshotDisplay(snapshot: Snapshot) {
  // Example: user_abc/snap_2025-05-13T11-31-59-406Z.json.gz
  const parts = snapshot.id.split('/');
  const file = parts[parts.length - 1];
  const match = file.match(/snap_(.+)\.json\.gz/);
  let dateStr = '';
  if (match && match[1]) {
    // Convert 2025-05-13T11-31-59-406Z to a Date
    const iso = match[1].replace(/-/g, ':').replace(/:(\d{3,})Z$/, '.$1Z').replace('T', 'T');
    const date = new Date(match[1].replace(/-/g, ':').replace(/:(\d{3,})Z$/, '.$1Z'));
    dateStr = isNaN(date.getTime()) ? match[1] : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
  return {
    display: dateStr ? `${dateStr} (Test Snapshot)` : file,
    raw: file,
  };
}

function relativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}
// --- END MOVED TO TOP LEVEL ---

function App() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("");
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' }>({ message: "", type: 'info' });
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

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

  useEffect(() => {
    if (!localStorage.getItem('pagelifeline-welcome-shown')) {
      setShowWelcome(true);
      localStorage.setItem('pagelifeline-welcome-shown', '1');
    }
  }, []);

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
          onChange={e => setSelectedSnapshotId(e.target.value)}
          className="snapshot-select"
          disabled={isLoading || snapshots.length === 0}
        >
          <option value="">— Select Snapshot —</option>
          {snapshots.map(snap => {
            const { display } = parseSnapshotDisplay(snap);
            return (
              <option key={snap.id} value={snap.id}>
                {display}
              </option>
            );
          })}
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

        {snapshots.length === 0 && (
          <div style={{
            textAlign: 'center',
            margin: '32px 0 0 0',
            padding: '24px 0',
            color: 'var(--color-text)',
            opacity: 0.85,
            animation: 'fadeIn 0.5s'
          }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>🕰️</div>
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 6 }}>No snapshots yet!</div>
            <div style={{ fontSize: 15, marginBottom: 10 }}>
              PageLifeline will create your first snapshot soon,<br />
              or click <b>“Create Test Snapshot”</b> to try it out.
            </div>
            <a
              href="https://www.pagelifeline.app/help/snapshots"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--color-primary)',
                fontSize: 14,
                textDecoration: 'underline',
                opacity: 0.8
              }}
            >
              Learn more about snapshots
            </a>
          </div>
        )}

        {selectedSnap && (
          <div className="snapshot-details">
            <span className="icon" role="img" aria-label="Snapshot">🗂️</span>
            <div className="meta">
              <div><b>Name:</b> {parseSnapshotDisplay(selectedSnap).display}</div>
              {selectedSnap.createdAt && (
                <div>
                  <b>Created:</b> {formatDate(selectedSnap.createdAt)}
                  <span style={{ marginLeft: 8, color: 'var(--color-text)', opacity: 0.7, fontSize: 13 }}>
                    ({relativeTime(selectedSnap.createdAt)})
                  </span>
                </div>
              )}
              {selectedSnap.size !== undefined && (
                <div><b>Size:</b> {formatSize(selectedSnap.size)}</div>
              )}
              {selectedSnap.pageCount !== undefined && (
                <div><b>Pages:</b> {selectedSnap.pageCount}</div>
              )}
              <button
                style={{
                  marginTop: 12,
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
          </div>
        )}

        {/* Panic Button for most recent snapshot */}
        {snapshots.length > 0 && (
          <button
            className="btn-panic"
            style={{
              marginTop: 18,
              background: 'transparent',
              color: '#d32f2f',
              border: '1.5px solid #d32f2f',
              borderRadius: 8,
              padding: '13px 0',
              fontWeight: 600,
              fontSize: 16,
              width: '100%',
              margin: '10px 0 0 0',
              boxShadow: 'none',
              letterSpacing: '0.2px',
              cursor: 'pointer',
              transition: 'border-color 0.1s, color 0.1s, background 0.1s'
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
          className="btn-primary"
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

        {showWelcome && (
          <div style={{
            position: 'fixed',
            top: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(15,28,79,0.10)',
            padding: '24px 36px',
            zIndex: 9999,
            textAlign: 'center',
            animation: 'fadeIn 0.5s'
          }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>👋</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Welcome to PageLifeline!</div>
            <div style={{ fontSize: 15, marginBottom: 10 }}>
              Quickly restore any Notion snapshot if things go wrong.<br />
              Let's get you started!
            </div>
            <button
              className="btn-primary"
              style={{ width: 180, marginTop: 10 }}
              onClick={() => setShowWelcome(false)}
            >
              Get Started
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;