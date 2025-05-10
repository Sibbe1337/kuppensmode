export interface UserSettings {
  notionConnected: boolean;
  notionWorkspaceId: string | null;
  notionWorkspaceName: string | null;
  notionWorkspaceIcon: string | null;
  apiKey: string | null; // Could be hashed or just a display version
  // The actual stored value in Firestore for the API key might be a hash, e.g., apiKeyHash
  notifications: {
    emailOnSnapshotSuccess: boolean;
    emailOnSnapshotFailure: boolean;
    webhookUrl: string | null;
  };
  autoSnapshot: { // No longer optional at the top level, initialized in defaults
    enabled: boolean;
    frequency: 'daily' | 'weekly'; // Add more if needed
    // timeOfDay?: string; // e.g., '03:00' UTC
    // dayOfWeek?: number; // 0 for Sunday, 1 for Monday, etc. (if weekly)
  };
}

export interface UserQuota {
  planName: string;
  planId: string;
  snapshotsUsed: number;
  snapshotsLimit: number;
  // Consider adding storageUsedMB and storageLimitMB here if they become part of the quota object
}

// Add the new Snapshot interface
export interface Snapshot {
  id: string; 
  timestamp: string; // ISO date string
  sizeKB: number;
  status: string; // This is for the backup status itself
  latestRestoreUrl?: string; // URL of the latest successful restore in Notion
  latestRestoreStatus?: 'pending' | 'initiated' | 'completed' | 'failed' | string; // Status of the latest restore attempt
} 