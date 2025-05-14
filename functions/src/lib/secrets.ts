// src/lib/secrets.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const sm = new SecretManagerServiceClient();

export async function getSecret(name: string): Promise<string> {
  const projectId = process.env.GCP_PROJECT_ID; // Use the env var name set during deployment
  if (!projectId) {
    console.error('GCP_PROJECT_ID environment variable is not set. Secret path construction will fail.');
    throw new Error("GCP_PROJECT_ID environment variable is not set.");
  }
  const [v] = await sm.accessSecretVersion({
    name: `projects/${projectId}/secrets/${name}/versions/latest`,
  });
  return v.payload?.data?.toString() ?? '';
} 