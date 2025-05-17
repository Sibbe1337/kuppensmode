export type StorageProviderType = "s3" | "r2";

export interface UserStorageProvider {
  id: string;                // providerConfigId
  type: StorageProviderType;
  bucket: string;
  region?: string;           // S3 only
  endpoint?: string;         // R2 or custom S3
  encryptedAccessKeyId: string;
  encryptedSecretAccessKey: string;
  forcePathStyle?: boolean;
  isEnabled: boolean;
  replicationMode: "mirror" | "archive";
  adapterVersion: number;
  validationStatus: "pending" | "success" | "error";
  validationError?: string;
  createdAt: FirebaseFirestore.Timestamp; // Make sure to import or define this type if not globally available
  lastValidatedAt?: FirebaseFirestore.Timestamp;
} 