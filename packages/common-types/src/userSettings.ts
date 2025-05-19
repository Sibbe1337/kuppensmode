export interface UserSettings {
  apiKey?: string;
  apiKeyLastUsed?: string; // ISO timestamp or undefined
  notionConnected: boolean;
  notionWorkspaceName?: string | null;
  notifications: {
    emailOnSnapshotSuccess: boolean;
    emailOnSnapshotFailure: boolean;
    webhookUrl?: string | null;
  };
  autoSnapshot: {
    enabled: boolean;
    frequency: 'hourly' | 'daily';
  };
  stripeCustomerId?: string | null;
  billing?: {
    subscriptionActive?: boolean;
    subscriptionPlan?: string;
    subscriptionPeriodEnd?: string | number | Date;
  };
  referralCode?: string | null;
  referralsMadeCount?: number;
  // Add any other shared user settings properties here
} 