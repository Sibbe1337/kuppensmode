// src/lib/secrets.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const sm = new SecretManagerServiceClient();

export async function getSecret(name: string): Promise<string> {
  const [v] = await sm.accessSecretVersion({
    name: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/${name}/versions/latest`,
  });
  return v.payload?.data?.toString() ?? '';
} 