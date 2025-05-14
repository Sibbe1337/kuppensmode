import { contextBridge, ipcRenderer } from 'electron';

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
});

// It's good practice to declare the types for the exposed API globally
// You can put this in a d.ts file in your project, e.g., src/electron.d.ts
/*
declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, payload?: any) => void;
      receive: (channel: string, func: (...args: any[]) => void) => () => void; // Updated to show it returns a cleanup function
      getSnapshots: () => Promise<any[]>; // Added example types
      createTestSnapshot: () => Promise<any>;
      getSnapshotDownloadUrl: (snapshotId: string) => Promise<any>;
      onUserSignedOut: (callback: () => void) => () => void; // Added new API
      getAuthStatus: () => Promise<{ isAuthenticated: boolean; userId?: string | null }>; // Added
      requestSignIn: () => void; // Added
    };
  }
}
*/ 