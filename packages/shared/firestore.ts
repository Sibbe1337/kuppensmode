import { Firestore, FieldValue, Timestamp, DocumentData } from '@google-cloud/firestore';

export interface FirestoreOptions {
  client?: Firestore;
  projectId?: string;
  keyJson?: string;
}

export function createFirestore(options: FirestoreOptions = {}): Firestore {
  if (options.client) return options.client;
  const projectId = options.projectId || process.env.GOOGLE_CLOUD_PROJECT;
  const keyJson = options.keyJson || process.env.GCP_SERVICE_ACCOUNT_KEY_JSON;
  const config: any = { ignoreUndefinedProperties: true };
  if (projectId) config.projectId = projectId;
  if (keyJson) {
    try {
      config.credentials = JSON.parse(keyJson);
    } catch (e) {
      throw new Error('Invalid Firestore credentials JSON');
    }
  }
  return new Firestore(config);
}

export { FieldValue, Timestamp };
export type { Firestore, DocumentData };
