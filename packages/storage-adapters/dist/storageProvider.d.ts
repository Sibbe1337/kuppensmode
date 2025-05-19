import type { Timestamp as FirebaseFirestoreTimestamp } from '@google-cloud/firestore';
export type StorageProviderType = "s3" | "r2";
export interface UserStorageProvider {
    id: string;
    type: StorageProviderType;
    bucket: string;
    region?: string;
    endpoint?: string;
    encryptedAccessKeyId: string;
    encryptedSecretAccessKey: string;
    forcePathStyle?: boolean;
    isEnabled: boolean;
    replicationMode: "mirror" | "archive";
    adapterVersion: number;
    validationStatus: "pending" | "success" | "error";
    validationError?: string;
    createdAt: FirebaseFirestoreTimestamp;
    lastValidatedAt?: FirebaseFirestoreTimestamp;
}
//# sourceMappingURL=storageProvider.d.ts.map