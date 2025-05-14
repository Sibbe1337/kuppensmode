import crypto from 'node:crypto';

// --- PKCE Helper functions ---
export function base64URLEncode(str: Buffer): string {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function sha256(buffer: string): Buffer {
  return crypto.createHash('sha256').update(buffer).digest();
}
// --- End PKCE Helpers --- 