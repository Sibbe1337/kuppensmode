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
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  plan?: string | null; // Conceptual plan name
  planId?: string | null; // Stripe Product ID or conceptual plan ID like 'free'
  billing?: { // Mirroring structure from M1 webhook update
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    planId?: string | null;
    priceId?: string | null;
    status?: string; 
    seats?: number;
    // other fields from BillingInfo in stripeWebhook.ts if needed
  } | null;
  // B.5: Referral system fields
  referralCode?: string | null;
  referredBy?: string | null; // UserId of the person who referred this user
  referralsMadeCount?: number; // Count of users successfully referred by this user
  // B.4.B.1.1: Add flags field
  flags?: {
    needsCancellationSurvey?: boolean;
    // add other future flags here
  } | null;
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
  snapshotIdActual?: string; // Added for consistency with API
  timestamp: string; // ISO date string
  sizeKB: number;
  status: string; // This is for the backup status itself
  latestRestoreUrl?: string; // URL of the latest successful restore in Notion
  latestRestoreStatus?: 'pending' | 'initiated' | 'completed' | 'failed' | string; // Status of the latest restore attempt
  diffSummary?: { // For M4/A.1 and B.2
    added: number;
    removed: number;
    changed: number;
    previousSnapshotId?: string;
  } | null;
} 