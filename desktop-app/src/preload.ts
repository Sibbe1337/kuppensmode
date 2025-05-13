import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, payload?: any) => ipcRenderer.send(channel, payload),
  receive: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => func(...args));
  },
  getSnapshots: () => ipcRenderer.invoke('get-snapshots'),
  createTestSnapshot: () => ipcRenderer.invoke('create-test-snapshot'),
  getSnapshotDownloadUrl: (snapshotId: string) => ipcRenderer.invoke('get-snapshot-download-url', snapshotId),
});

// It's good practice to declare the types for the exposed API globally
// You can put this in a d.ts file in your project, e.g., src/electron.d.ts
/*
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, func: (...args: any[]) => void) => () => void;
    };
  }
}
*/ 