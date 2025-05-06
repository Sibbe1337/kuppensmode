export interface UserSettings {
  notionConnected: boolean;
  notionWorkspaceName: string | null;
  apiKey: string | null;
  notifications: {
    emailOnSnapshotSuccess: boolean;
    emailOnSnapshotFailure: boolean;
    webhookUrl: string | null;
  };
} 