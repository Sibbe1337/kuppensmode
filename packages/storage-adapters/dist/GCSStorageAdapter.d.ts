import { Storage } from '@google-cloud/storage';
import type { StorageAdapter } from './StorageAdapter';
export interface GCSStorageAdapterOptions {
    bucket: string;
    client?: Storage;
}
export declare class GCSStorageAdapter implements StorageAdapter {
    private bucketName;
    private client;
    constructor(options: GCSStorageAdapterOptions);
    write(path: string, data: Buffer | Uint8Array | string, metadata?: Record<string, any>): Promise<void>;
    read(path: string): Promise<Buffer>;
    list(pathPrefix: string): Promise<string[]>;
    delete(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    getMetadata(path: string): Promise<Record<string, any> | null>;
    copy(srcPath: string, destPath: string): Promise<void>;
}
//# sourceMappingURL=GCSStorageAdapter.d.ts.map