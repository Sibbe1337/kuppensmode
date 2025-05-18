import { KeyManagementServiceClient } from '@google-cloud/kms';

export interface KmsOptions {
  client?: KeyManagementServiceClient;
  keyName?: string;
}

function getClient(options?: KmsOptions): KeyManagementServiceClient {
  return options?.client || new KeyManagementServiceClient();
}

function getKeyName(options?: KmsOptions): string {
  const name = options?.keyName || process.env.KMS_KEY_NAME;
  if (!name) throw new Error('KMS_KEY_NAME environment variable is not set.');
  return name;
}

export async function encryptString(plaintext: string, options?: KmsOptions): Promise<string> {
  if (!plaintext) return '';
  const client = getClient(options);
  const keyName = getKeyName(options);
  const [result] = await client.encrypt({ name: keyName, plaintext: Buffer.from(plaintext) });
  if (!result.ciphertext) throw new Error('KMS encryption resulted in no ciphertext.');
  return Buffer.from(result.ciphertext).toString('base64');
}

export async function decryptString(ciphertextBase64: string, options?: KmsOptions): Promise<string> {
  if (!ciphertextBase64) return '';
  const client = getClient(options);
  const keyName = getKeyName(options);
  const [result] = await client.decrypt({ name: keyName, ciphertext: Buffer.from(ciphertextBase64, 'base64') });
  if (!result.plaintext) return '';
  return Buffer.from(result.plaintext).toString();
}
