// This file (e.g., src/renderer/electron.d.ts) should contain the single source of truth
// for the types exposed on the window object by your preload script.

export type Snapshot = {
  id: string;
  name?: string;
  createdAt?: string;
  size?: number;
  pageCount?: number;
};

declare global {
  interface Window {
    electronAPI?: {
      // Methods for general IPC
      send: (channel: string, payload?: any) => void;
      receive: (channel: string, func: (...args: any[]) => void) => (() => void) | undefined;
      
      // Snapshot related methods
      // Ensure 'Snapshot' type is also globally available or imported here if defined elsewhere
      // For simplicity, using 'any[]' for now if Snapshot type isn't globally visible here.
      getSnapshots: () => Promise<Snapshot[]>; // Consider defining/importing Snapshot type properly
      createTestSnapshot: () => Promise<{ success: boolean; error?: string }>;
      getSnapshotDownloadUrl?: (snapshotId: string) => Promise<{ url?: string; error?: string }>;
      
      // Auth related methods
      onUserSignedOut?: (callback: () => void) => (() => void) | undefined;
      getAuthStatus?: () => Promise<{ isAuthenticated: boolean; userId?: string | null }>; 
      requestSignIn?: () => void; 
    };
  }
}

// If Snapshot type is defined in App.tsx and not globally, you might need to do this:
// (Or move Snapshot type definition also to a global .d.ts file)
// Assuming Snapshot might be something like this, adjust as needed:
/*
type Snapshot = {
  id: string;
  name?: string;
  createdAt?: string;
  size?: number; 
  pageCount?: number;
};
*/

// Export an empty object to make this a module if needed by your tsconfig, 
// though for global declarations it's often not required.
export {}; 