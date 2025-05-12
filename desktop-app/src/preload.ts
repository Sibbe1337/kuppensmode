import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Example: send a message to the main process and get a response
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  // Example: send a message to the main process (one-way)
  send: (channel: string, payload: any) => {
    // Whitelist channels
    const validChannels = ["clerk-auth-success", "clerk-auth-error"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, payload);
    } else {
      console.warn(`Blocked IPC send on untrusted channel: ${channel}`);
    }
  },
  // Example: receive messages from the main process
  on: (channel: string, func: (...args: any[]) => void) => {
    const subscription = (event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
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