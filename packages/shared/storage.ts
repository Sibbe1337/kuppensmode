import { Storage } from '@google-cloud/storage';

export interface StorageOptions {
  client?: Storage;
  projectId?: string;
  keyJson?: string;
}

export function createStorage(options: StorageOptions = {}): Storage {
  if (options.client) return options.client;
  const projectId = options.projectId || process.env.GOOGLE_CLOUD_PROJECT;
  const keyJson = options.keyJson || process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
  const config: any = {};
  if (projectId) config.projectId = projectId;
  if (keyJson) {
    try {
      config.credentials = JSON.parse(keyJson);
    } catch (e) {
      throw new Error('Invalid Storage credentials JSON');
    }
  }
  return new Storage(config);
}

export type { Storage };
