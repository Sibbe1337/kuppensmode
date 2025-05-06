// src/types/user.ts
export interface UserSettings {
  notionConnected: boolean;
  notionWorkspaceName: string | null;
  apiKey: string | null; // Represents the API key for display (e.g., masked)
  // The actual stored value in Firestore for the API key might be a hash, e.g., apiKeyHash
  notifications: {
    emailOnSnapshotSuccess: boolean;
    emailOnSnapshotFailure: boolean;
    webhookUrl: string | null;
  };
}

export interface UserQuota { // <<<< THIS IS THE ADDED/CONFIRMED PART
  planName: string;
  planId: string;
  snapshotsUsed: number;
  snapshotsLimit: number;
  // Consider adding storageUsedMB and storageLimitMB here if they become part of the quota object
}