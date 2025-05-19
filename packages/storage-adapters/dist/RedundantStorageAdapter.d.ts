import type { StorageAdapter } from './StorageAdapter';
export declare class RedundantStorageAdapter implements StorageAdapter {
    private primary;
    private mirrors;
    private defaultRetryAttempts;
    private retryDelayMs;
    constructor(primary: StorageAdapter, mirrors?: StorageAdapter[]);
    private attemptWithRetry;
    write(path: string, data: Buffer | Uint8Array | string, metadata?: Record<string, any>): Promise<void>;
    read(path: string): Promise<Buffer>;
    list(pathPrefix: string): Promise<string[]>;
    delete(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    getMetadata(path: string): Promise<Record<string, any> | null>;
    copy(srcPath: string, destPath: string): Promise<void>;
}
//# sourceMappingURL=RedundantStorageAdapter.d.ts.map