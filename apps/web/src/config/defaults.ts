import type { UserSettings, UserQuota } from '@/types/user';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  notionConnected: false,
  notionWorkspaceId: null,
  notionWorkspaceName: null,
  notionWorkspaceIcon: null,
  apiKey: null, // For display; apiKeyHash will be null in the DB initially
  notifications: {
    emailOnSnapshotSuccess: true,
    emailOnSnapshotFailure: true,
    webhookUrl: null,
  },
  autoSnapshot: {
    enabled: false,
    frequency: 'daily',
  }
};

export const DEFAULT_USER_QUOTA: UserQuota = {
  planName: "Free Tier",
  planId: "free",
  snapshotsUsed: 0,
  snapshotsLimit: 5, // Default free tier snapshot limit
}; 