import { S3Client } from '@aws-sdk/client-s3';
import type { StorageAdapter } from './StorageAdapter';
export interface S3AdapterOptions {
    bucket: string;
    region?: string;
    endpoint?: string;
    forcePathStyle?: boolean;
    accessKeyId?: string;
    secretAccessKey?: string;
    client?: S3Client;
}
export declare class S3StorageAdapter implements StorageAdapter {
    private client;
    private bucketName;
    constructor(opts: S3AdapterOptions);
    write(path: string, data: Buffer | Uint8Array | string, metadata?: Record<string, any>): Promise<void>;
    exists(path: string): Promise<boolean>;
    private streamToBuffer;
    read(path: string): Promise<Buffer>;
    list(prefix: string): Promise<string[]>;
    delete(path: string): Promise<void>;
    getMetadata(path: string): Promise<Record<string, any> | null>;
    copy(srcPath: string, destPath: string): Promise<void>;
}
//# sourceMappingURL=S3StorageAdapter.d.ts.map