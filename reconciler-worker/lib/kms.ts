import { KeyManagementServiceClient } from "@google-cloud/kms";

const kmsClient = new KeyManagementServiceClient();

const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const KMS_LOCATION_ID = process.env.KMS_LOCATION_ID;
const KMS_KEY_RING_ID = process.env.KMS_KEY_RING_ID;
const KMS_KEY_ID = process.env.KMS_KEY_ID;

// Function to construct keyName, can be internal or exported if needed elsewhere
function getKmsKeyName(): string {
  if (!GCP_PROJECT_ID || !KMS_LOCATION_ID || !KMS_KEY_RING_ID || !KMS_KEY_ID) {
    console.error("KMS config missing in env: GCP_PROJECT_ID, KMS_LOCATION_ID, KMS_KEY_RING_ID, KMS_KEY_ID");
    throw new Error("KMS environment variables (PROJECT, LOCATION, KEYRING, KEY) are not fully set.");
  }
  return kmsClient.cryptoKeyPath(
    GCP_PROJECT_ID,
    KMS_LOCATION_ID,
    KMS_KEY_RING_ID,
    KMS_KEY_ID
  );
}

export async function encryptString(plaintext: string): Promise<string> {
  const keyName = getKmsKeyName();
  if (plaintext === null || plaintext === undefined || plaintext === '') { // Stricter check for empty/null
    // Consider behavior: throw error, or return specific value like empty string for empty plaintext?
    // Returning empty string for empty plaintext to avoid issues if an empty secret is "valid".
    console.warn("encryptString called with empty or null plaintext, returning empty string.");
    return ''; 
  }
  const [result] = await kmsClient.encrypt({ name: keyName, plaintext: Buffer.from(plaintext) });
  if (!result.ciphertext) {
    throw new Error("KMS encryption resulted in no ciphertext.");
  }
  return Buffer.from(result.ciphertext).toString("base64");
}

export async function decryptString(ciphertextBase64: string): Promise<string> {
  const keyName = getKmsKeyName();
  if (ciphertextBase64 === null || ciphertextBase64 === undefined || ciphertextBase64 === '') { // Stricter check
    console.warn("decryptString called with empty or null ciphertext, returning empty string.");
    return ''; 
  }
  const [result] = await kmsClient.decrypt({ name: keyName, ciphertext: Buffer.from(ciphertextBase64, "base64") });
  if (result.plaintext === null || result.plaintext === undefined) { // Check for null or undefined explicitly
    // This means an empty string was likely encrypted, or an error occurred but didn't throw for some reason.
    console.warn("KMS decryption resulted in null or undefined plaintext, returning empty string.");
    return ''; 
  }
  return Buffer.from(result.plaintext).toString();
} 