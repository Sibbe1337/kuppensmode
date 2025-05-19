// Stub for apps/web/src/lib/kms.ts
console.log("STUB: kms.ts loaded");

export async function encryptString(plaintext: string): Promise<string> {
  console.warn("STUB: encryptString called");
  return plaintext;
}

export async function decryptString(ciphertextBase64: string): Promise<string> {
  console.warn("STUB: decryptString called");
  return ciphertextBase64;
} 