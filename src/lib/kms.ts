import { encryptString as sharedEncrypt, decryptString as sharedDecrypt } from '@shared/kms';

export const encryptString = (plaintext: string) => sharedEncrypt(plaintext);
export const decryptString = (ciphertextBase64: string) => sharedDecrypt(ciphertextBase64);
