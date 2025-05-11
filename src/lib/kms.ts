import { KeyManagementServiceClient } from "@google-cloud/kms";

const client = new KeyManagementServiceClient();

// Ensure KMS_KEY_NAME is set in your environment variables
// Format: projects/YOUR_PROJECT/locations/YOUR_LOCATION/keyRings/YOUR_KEYRING/cryptoKeys/YOUR_KEY
const keyName = process.env.KMS_KEY_NAME;

export async function encryptString(plaintext: string): Promise<string> {
  if (!keyName) {
    throw new Error("KMS_KEY_NAME environment variable is not set.");
  }
  if (!plaintext) {
    // Encrypting an empty string can sometimes lead to issues or return empty/null ciphertext
    // depending on the KMS implementation, which might be undesirable.
    // Decide if you want to return an empty string, throw an error, or handle differently.
    return ''; // Or throw new Error("Cannot encrypt an empty string");
  }
  const [result] = await client.encrypt({ name: keyName, plaintext: Buffer.from(plaintext) });
  if (!result.ciphertext) {
    throw new Error("KMS encryption resulted in no ciphertext.");
  }
  return Buffer.from(result.ciphertext).toString("base64");
}

export async function decryptString(ciphertextBase64: string): Promise<string> {
  if (!keyName) {
    throw new Error("KMS_KEY_NAME environment variable is not set.");
  }
  if (!ciphertextBase64) {
    // Decrypting an empty string will likely fail or return an empty string.
    return ''; // Or throw new Error("Cannot decrypt an empty string");
  }
  const [result] = await client.decrypt({ name: keyName, ciphertext: Buffer.from(ciphertextBase64, "base64") });
  if (!result.plaintext) {
    // This case might indicate an issue, or that an empty string was originally encrypted (if allowed)
    return ''; 
  }
  return Buffer.from(result.plaintext).toString();
} 