import { contextBridge, ipcRenderer } from 'electron';
// Attempting relative path import from src/preload.ts to src/renderer/electron.d.ts
import type { RestoreProgressEventData } from './renderer/electron.d';

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, payload?: any) => ipcRenderer.send(channel, payload),
  receive: (channel: string, func: (...args: any[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, listener);
    // Return a cleanup function to remove the listener
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
  getSnapshots: () => ipcRenderer.invoke('get-snapshots'),
  createTestSnapshot: () => ipcRenderer.invoke('create-test-snapshot'),
  getSnapshotDownloadUrl: (snapshotId: string) => ipcRenderer.invoke('get-snapshot-download-url', snapshotId),
  // Specific listener for user sign-out
  onUserSignedOut: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('user-signed-out', listener);
    return () => {
      ipcRenderer.removeListener('user-signed-out', listener);
    };
  },
  // Added for AuthContext to check initial status
  getAuthStatus: () => ipcRenderer.invoke('get-auth-status'),
  // Added for renderer to trigger sign-in flow
  requestSignIn: () => ipcRenderer.send('request-sign-in'),
  restoreLatestGood: () => ipcRenderer.invoke('restore-latest-good'),
  // Listener for restore progress updates
  onRestoreProgressUpdate: (callback: (eventData: RestoreProgressEventData) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, eventData: RestoreProgressEventData) => callback(eventData);
    ipcRenderer.on('restore-progress-update', listener);
    return () => {
      ipcRenderer.removeListener('restore-progress-update', listener);
    };
  },
});

// Type definition for electronAPI should now solely reside in electron.d.ts
// Remove any commented out or duplicate declare global here. 